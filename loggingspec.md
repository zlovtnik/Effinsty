# Effinsty Developer Specification
### F# · Oracle DB · Dapper · ASP.NET Core
**Database Connectivity, Health Checks, Object Validation & Structured Logging**

| | |
|---|---|
| **Stack** | F# / .NET 10 / ASP.NET Core |
| **Database** | Oracle (Wallet auth / TNS) + Dapper |
| **Cache** | Redis (StackExchange.Redis) |
| **Logging** | Microsoft.Extensions.Logging (MEL) |
| **Web** | Giraffe 8.x |

Version 1.0 · March 2026

---

## 1. Overview & Goals

This specification defines design, implementation patterns, and operational requirements for Oracle DB connectivity, startup validation, query-level logging, and structured log output in the Effinsty API. All guidance is grounded in the actual codebase and aligns with the multi-tenant architecture (per-schema Oracle, Redis sessions, Giraffe routing).

| Pillar | What it solves |
|---|---|
| DB Connection Health Checks | Confirms Oracle wallet connectivity before traffic is served; exposes `/api/health/oracle` for orchestrators. |
| Startup DB Object Validation | Verifies USERS, CONTACTS, SESSIONS tables, indexes, and triggers exist for every tenant schema before accepting requests. |
| Query / Command Logging | Attaches correlation ID, tenant, elapsed time, and row-count to every Dapper call without leaking PII or query parameter values. |
| Structured Log Schema | Defines consistent log fields, category names, level contracts, and EventId ranges parseable by Console JSON, Seq, Datadog, etc. |

---

## 2. Architecture Snapshot

Understanding where logging hooks live requires mapping the request path:

| Layer / File | Responsibility |
|---|---|
| `Program.fs` | App bootstrap, middleware pipeline, OracleConfiguration (Wallet/TnsAdmin), health check registration. |
| `OracleConnectionFactory.fs` | Creates and opens an OracleConnection per-request using tenant DataSourceAlias. Primary logging injection point for connection events. |
| `Repositories.fs` | Dapper calls (QueryAsync, ExecuteAsync, ExecuteScalarAsync). Receives ILogger via constructor for per-query telemetry. |
| `OracleHealthCheck.fs` | IHealthCheck — opens a throwaway connection, returns Healthy / Unhealthy. |
| `TenantResolver.fs` | Resolves X-Tenant-ID header → TenantContext. Validates schema identifier before it reaches SQL. |
| `SqlTemplates.fs` | Builds parameterised SQL from validated schema name. Schema whitelisted via regex `^[A-Za-z_][A-Za-z0-9_]*$`. |
| `Handlers.fs` / `Program.fs` | Correlation ID generation, tenant resolution middleware, global error handler — already in place. |

> **NOTE** — `OracleConnectionFactory` uses wallet-based external auth (`User Id=/`). No username or password appears in connection strings. The full connection string is therefore safe to log at Debug level.

---

## 3. DB Connection Health Checks

### 3.1 Current State

`OracleConnectivityHealthCheck` is registered in `ServiceCollection.fs` and mapped to `/api/health/oracle`. It opens a connection and returns `Healthy` or `Unhealthy`. Two gaps exist:

- Only the default `DataSource` is tested — per-tenant `DataSourceAlias` values are not exercised.
- No validation query is run — a successful `OpenAsync` does not confirm query execution capability.

> **GAP** — Health check opens a connection but does not run `SELECT 1 FROM DUAL`, so a connected-but-broken Oracle instance can still return `Healthy`.

### 3.2 Enhanced Default Health Check

```fsharp
// OracleHealthCheck.fs — add ILogger, run validation query
type OracleConnectivityHealthCheck
    (options: IOptions<OracleOptions>,
     logger: ILogger<OracleConnectivityHealthCheck>) =

    interface IHealthCheck with
        member _.CheckHealthAsync(_ctx, ct) = task {
            let cfg = options.Value
            if String.IsNullOrWhiteSpace(cfg.DataSource) then
                return HealthCheckResult.Unhealthy("DataSource missing.")
            else
                let sw = Stopwatch.StartNew()
                try
                    let cs = $"User Id=/;Data Source={cfg.DataSource}"
                    use conn = new OracleConnection(cs)
                    do! conn.OpenAsync(ct)
                    let! _ = conn.ExecuteScalarAsync<int>("SELECT 1 FROM DUAL")
                    sw.Stop()
                    logger.LogInformation(
                        Events.DbHealthCheckPassed,
                        "Oracle health check passed. DataSource={DataSource} ElapsedMs={ElapsedMs}",
                        cfg.DataSource, sw.ElapsedMilliseconds)
                    let data = dict ["elapsedMs", box sw.ElapsedMilliseconds]
                    return HealthCheckResult.Healthy("Oracle healthy.", data)
                with ex ->
                    sw.Stop()
                    logger.LogError(
                        Events.DbHealthCheckFailed, ex,
                        "Oracle health check FAILED. DataSource={DataSource} ElapsedMs={ElapsedMs}",
                        cfg.DataSource, sw.ElapsedMilliseconds)
                    return HealthCheckResult.Unhealthy("Oracle unhealthy.", ex)
        }
```

### 3.3 Per-Tenant Health Check

```fsharp
// OracleTenantHealthCheck.fs — validates every tenant DataSourceAlias
type OracleTenantHealthCheck
    (tenantOptions: IOptions<TenantOptions>,
     logger: ILogger<OracleTenantHealthCheck>) =

    interface IHealthCheck with
        member _.CheckHealthAsync(_ctx, ct) = task {
            let mutable allOk = true
            let results = System.Collections.Generic.Dictionary<string, obj>()

            for kvp in tenantOptions.Value.Map do
                let alias = kvp.Value.DataSourceAlias
                let sw = Stopwatch.StartNew()
                try
                    use conn = new OracleConnection($"User Id=/;Data Source={alias}")
                    do! conn.OpenAsync(ct)
                    let! _ = conn.ExecuteScalarAsync<int>("SELECT 1 FROM DUAL")
                    sw.Stop()
                    results[kvp.Key] <- box $"OK ({sw.ElapsedMilliseconds}ms)"
                    logger.LogDebug(Events.TenantDbHealthCheckPassed,
                        "Tenant DB OK. Tenant={Tenant} Alias={Alias} ElapsedMs={ElapsedMs}",
                        kvp.Key, alias, sw.ElapsedMilliseconds)
                with ex ->
                    sw.Stop()
                    allOk <- false
                    results[kvp.Key] <- box $"FAIL: {ex.Message}"
                    logger.LogError(Events.TenantDbHealthCheckFailed, ex,
                        "Tenant DB FAILED. Tenant={Tenant} Alias={Alias} ElapsedMs={ElapsedMs}",
                        kvp.Key, alias, sw.ElapsedMilliseconds)

            if allOk then
                return HealthCheckResult.Healthy("All tenant DB sources healthy.", results)
            else
                return HealthCheckResult.Degraded("One or more tenant sources failed.", data=results)
        }
```

### 3.4 Registration

```fsharp
// ServiceCollection.fs
this.AddHealthChecks()
    .AddCheck<OracleConnectivityHealthCheck>("oracle-default",
        tags = [| "db"; "oracle" |])
    .AddCheck<OracleTenantHealthCheck>("oracle-tenants",
        tags = [| "db"; "oracle"; "tenants" |])
    |> ignore

// Program.fs
app.MapHealthChecks("/api/health/oracle",
    HealthCheckOptions(Predicate = fun c -> c.Tags.Contains("oracle")))
    |> ignore
```

---

## 4. Startup DB Object Validation

### 4.1 Rationale

Migration `001_init.sql` must be applied manually per tenant schema. Without a startup guard, the API can start successfully against a schema where USERS, CONTACTS, or SESSIONS are missing — causing opaque runtime failures. Startup validation catches schema drift before traffic is served.

> **RULE** — Startup validation must run before the first request. Use `IHostedService` registered before the app starts listening. Validation failures **MUST** call `StopApplication()` and log at `Critical` level.

### 4.2 Objects to Validate per Tenant Schema

| Object | Oracle system view query |
|---|---|
| USERS table | `ALL_TABLES WHERE TABLE_NAME='USERS' AND OWNER=:schema` |
| CONTACTS table | `ALL_TABLES WHERE TABLE_NAME='CONTACTS' AND OWNER=:schema` |
| SESSIONS table | `ALL_TABLES WHERE TABLE_NAME='SESSIONS' AND OWNER=:schema` |
| FK_CONTACTS_USERS | `ALL_CONSTRAINTS WHERE CONSTRAINT_NAME='FK_CONTACTS_USERS' AND OWNER=:schema` |
| FK_SESSIONS_USERS | `ALL_CONSTRAINTS WHERE CONSTRAINT_NAME='FK_SESSIONS_USERS' AND OWNER=:schema` |
| IX_CONTACTS_USER_UPDATED | `ALL_INDEXES WHERE INDEX_NAME='IX_CONTACTS_USER_UPDATED' AND TABLE_OWNER=:schema` |
| IX_CONTACTS_USER_EMAIL | `ALL_INDEXES WHERE INDEX_NAME='IX_CONTACTS_USER_EMAIL' AND TABLE_OWNER=:schema` |
| TRG_USERS_UPDATED_AT | `ALL_TRIGGERS WHERE TRIGGER_NAME='TRG_USERS_UPDATED_AT' AND OWNER=:schema` |
| TRG_CONTACTS_UPDATED_AT | `ALL_TRIGGERS WHERE TRIGGER_NAME='TRG_CONTACTS_UPDATED_AT' AND OWNER=:schema` |

### 4.3 DbSchemaValidator Module

```fsharp
// DbSchemaValidator.fs
module DbSchemaValidator =
    let private requiredTables   = [| "USERS"; "CONTACTS"; "SESSIONS" |]
    let private requiredIndexes  = [| "IX_CONTACTS_USER_UPDATED"; "IX_CONTACTS_USER_EMAIL" |]
    let private requiredTriggers = [| "TRG_USERS_UPDATED_AT"; "TRG_CONTACTS_UPDATED_AT" |]
    let private requiredFKs      = [| "FK_CONTACTS_USERS"; "FK_SESSIONS_USERS" |]

    let validateSchema (conn: IDbConnection) (schema: string) (ct: CancellationToken) =
        task {
            let upper = schema.ToUpperInvariant()
            let missing = ResizeArray<string>()

            for tbl in requiredTables do
                let! n = conn.ExecuteScalarAsync<int>(CommandDefinition(
                    "SELECT COUNT(1) FROM ALL_TABLES WHERE TABLE_NAME=:name AND OWNER=:owner",
                    {| name=tbl; owner=upper |}, cancellationToken=ct))
                if n = 0 then missing.Add($"TABLE {upper}.{tbl}")

            for idx in requiredIndexes do
                let! n = conn.ExecuteScalarAsync<int>(CommandDefinition(
                    "SELECT COUNT(1) FROM ALL_INDEXES WHERE INDEX_NAME=:name AND TABLE_OWNER=:owner",
                    {| name=idx; owner=upper |}, cancellationToken=ct))
                if n = 0 then missing.Add($"INDEX {upper}.{idx}")

            for trg in requiredTriggers do
                let! n = conn.ExecuteScalarAsync<int>(CommandDefinition(
                    "SELECT COUNT(1) FROM ALL_TRIGGERS WHERE TRIGGER_NAME=:name AND OWNER=:owner",
                    {| name=trg; owner=upper |}, cancellationToken=ct))
                if n = 0 then missing.Add($"TRIGGER {upper}.{trg}")

            for fk in requiredFKs do
                let! n = conn.ExecuteScalarAsync<int>(CommandDefinition(
                    "SELECT COUNT(1) FROM ALL_CONSTRAINTS WHERE CONSTRAINT_NAME=:name AND OWNER=:owner",
                    {| name=fk; owner=upper |}, cancellationToken=ct))
                if n = 0 then missing.Add($"FK {upper}.{fk}")

            return List.ofSeq missing
        }
```

### 4.4 DbStartupValidationService

```fsharp
// DbStartupValidationService.fs
type DbStartupValidationService
    (factory: IOracleConnectionFactory,
     tenantOptions: IOptions<TenantOptions>,
     hostLifetime: IHostApplicationLifetime,
     logger: ILogger<DbStartupValidationService>) =

    interface IHostedService with
        member _.StartAsync(ct) = task {
            logger.LogInformation(Events.DbStartupValidationBegin,
                "DB schema validation starting. TenantCount={TenantCount}",
                tenantOptions.Value.Map.Count)
            let mutable allValid = true

            for kvp in tenantOptions.Value.Map do
                match Validation.validateTenantSchema kvp.Value.Schema with
                | Error _ ->
                    logger.LogCritical(Events.DbStartupValidationFailed,
                        "Invalid schema identifier. Tenant={Tenant} Schema={Schema}",
                        kvp.Key, kvp.Value.Schema)
                    allValid <- false
                | Ok schema ->
                    let fakeCtx = { TenantId=TenantId kvp.Key; Schema=schema
                                    DataSourceAlias=kvp.Value.DataSourceAlias }
                    try
                        use! conn = factory.CreateOpenConnectionAsync(fakeCtx, ct)
                        let! missing = DbSchemaValidator.validateSchema
                                           conn (TenantSchema.value schema) ct
                        if missing.IsEmpty then
                            logger.LogInformation(Events.DbSchemaValid,
                                "Schema valid. Tenant={Tenant} Schema={Schema}",
                                kvp.Key, kvp.Value.Schema)
                        else
                            for m in missing do
                                logger.LogCritical(Events.DbObjectMissing,
                                    "Missing DB object: {Object} Tenant={Tenant}",
                                    m, kvp.Key)
                            allValid <- false
                    with ex ->
                        logger.LogCritical(Events.DbStartupValidationFailed, ex,
                            "Cannot connect for tenant '{Tenant}'. Aborting.", kvp.Key)
                        allValid <- false

            if not allValid then
                logger.LogCritical(Events.DbStartupValidationFailed,
                    "DB validation failed. Stopping application.")
                hostLifetime.StopApplication()
        }
        member _.StopAsync(_ct) = Task.CompletedTask
```

Register in `ServiceCollection.fs`:

```fsharp
this.AddHostedService<DbStartupValidationService>() |> ignore
```

---

## 5. Query & Command Logging

### 5.1 Design Principles

- **Never log parameter values** — email, phone, address are PII. Log only parameter count and query name.
- **Always include correlation ID** — every DB log entry must carry the active `CorrelationId` from `HttpContext`.
- **Always include tenant and schema** — multi-tenant system; logs without `TenantId` are unactionable.
- **Structured fields only** — use message template placeholders. Never string interpolation in log calls.
- **Log at appropriate levels** — Debug for SELECT; Information for writes; Warning for zero-row mutations; Error for exceptions.
- **Include elapsed time** — `Stopwatch` around every Dapper call; emit `ElapsedMs` as a numeric field.

> **CRITICAL** — Never log SQL parameter values. Never log `AuthToken` fields, `PasswordHash`, or `RefreshToken` content anywhere. The domain types already guard this via `ToString()` overrides.

### 5.2 DbLogging Wrapper Module

```fsharp
// DbLogging.fs — centralised query/command logging wrappers
module DbLogging =

    let execQuery
        (logger: ILogger) (eventId: EventId)
        (tenant: TenantContext) (correlationId: string)
        (queryName: string) (paramCount: int)   // NEVER the parameter values
        (work: unit -> Task<'T>) =
        task {
            let sw = Stopwatch.StartNew()
            try
                let! result = work()
                sw.Stop()
                logger.LogDebug(eventId,
                    "DB query OK. Query={Query} Tenant={Tenant} Schema={Schema} " +
                    "ParamCount={ParamCount} ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    queryName, TenantId.value tenant.TenantId,
                    TenantSchema.value tenant.Schema,
                    paramCount, sw.ElapsedMilliseconds, correlationId)
                return result
            with ex ->
                sw.Stop()
                logger.LogError(Events.DbQueryFailed, ex,
                    "DB query FAILED. Query={Query} Tenant={Tenant} " +
                    "ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    queryName, TenantId.value tenant.TenantId,
                    sw.ElapsedMilliseconds, correlationId)
                return raise ex
        }

    let execCommand
        (logger: ILogger) (eventId: EventId)
        (tenant: TenantContext) (correlationId: string)
        (commandName: string) (paramCount: int)
        (work: unit -> Task<int>) =
        task {
            let sw = Stopwatch.StartNew()
            try
                let! rows = work()
                sw.Stop()
                let level = if rows = 0 then LogLevel.Warning else LogLevel.Information
                logger.Log(level, eventId,
                    "DB command done. Command={Command} Tenant={Tenant} " +
                    "RowsAffected={RowsAffected} ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    commandName, TenantId.value tenant.TenantId,
                    rows, sw.ElapsedMilliseconds, correlationId)
                return rows
            with ex ->
                sw.Stop()
                logger.LogError(Events.DbCommandFailed, ex,
                    "DB command FAILED. Command={Command} Tenant={Tenant} " +
                    "ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    commandName, TenantId.value tenant.TenantId,
                    sw.ElapsedMilliseconds, correlationId)
                return raise ex
        }
```

### 5.3 OracleConnectionFactory with Logging

```fsharp
// OracleConnectionFactory.fs — inject ILogger, log open/fail with ElapsedMs
type OracleConnectionFactory
    (options: IOptions<OracleOptions>,
     logger: ILogger<OracleConnectionFactory>) =

    interface IOracleConnectionFactory with
        member _.CreateOpenConnectionAsync(tenant, ct) = task {
            let cfg = options.Value
            let ds = if String.IsNullOrWhiteSpace(tenant.DataSourceAlias)
                     then cfg.DataSource else tenant.DataSourceAlias
            let timeout = if cfg.ConnectionTimeoutSeconds <= 0 then 30
                          else cfg.ConnectionTimeoutSeconds
            // Wallet auth — safe to log full connection string
            let cs = $"User Id=/;Data Source={ds};Connection Timeout={timeout}"
            let sw = Stopwatch.StartNew()
            let conn = new OracleConnection(cs)
            try
                do! conn.OpenAsync(ct)
                sw.Stop()
                logger.LogDebug(Events.DbConnectionOpened,
                    "Oracle connection opened. DataSource={DataSource} " +
                    "Tenant={Tenant} Schema={Schema} ElapsedMs={ElapsedMs}",
                    ds, TenantId.value tenant.TenantId,
                    TenantSchema.value tenant.Schema, sw.ElapsedMilliseconds)
                return conn :> IDbConnection
            with ex ->
                sw.Stop()
                conn.Dispose()
                logger.LogError(Events.DbConnectionFailed, ex,
                    "Oracle connection FAILED. DataSource={DataSource} " +
                    "Tenant={Tenant} ElapsedMs={ElapsedMs}",
                    ds, TenantId.value tenant.TenantId, sw.ElapsedMilliseconds)
                ExceptionDispatchInfo.Capture(ex).Throw()
                return Unchecked.defaultof<IDbConnection>
        }
```

---

## 6. Structured Log Schema

### 6.1 Log Category Naming

| Category prefix | Source |
|---|---|
| `Effinsty.Api.*` | Giraffe handlers, middleware, request pipeline |
| `Effinsty.Infrastructure.OracleConnectionFactory` | Connection open/close/fail |
| `Effinsty.Infrastructure.OracleContactRepository` | Contact DB queries |
| `Effinsty.Infrastructure.OracleUserRepository` | User DB queries |
| `Effinsty.Infrastructure.OracleConnectivityHealthCheck` | Default health check |
| `Effinsty.Infrastructure.OracleTenantHealthCheck` | Per-tenant health check |
| `Effinsty.Infrastructure.DbStartupValidationService` | Startup schema validation |

### 6.2 EventId Registry

```fsharp
// Events.fs — single source of truth for all EventIds
module Events =
    // DB Connection (1000–1099)
    let DbConnectionOpened  = EventId(1000, "DbConnectionOpened")
    let DbConnectionFailed  = EventId(1001, "DbConnectionFailed")

    // DB Health Checks (1100–1199)
    let DbHealthCheckPassed       = EventId(1100, "DbHealthCheckPassed")
    let DbHealthCheckFailed       = EventId(1101, "DbHealthCheckFailed")
    let TenantDbHealthCheckPassed = EventId(1102, "TenantDbHealthCheckPassed")
    let TenantDbHealthCheckFailed = EventId(1103, "TenantDbHealthCheckFailed")

    // Startup Validation (1200–1299)
    let DbStartupValidationBegin  = EventId(1200, "DbStartupValidationBegin")
    let DbSchemaValid             = EventId(1201, "DbSchemaValid")
    let DbObjectMissing           = EventId(1202, "DbObjectMissing")
    let DbStartupValidationFailed = EventId(1203, "DbStartupValidationFailed")

    // Queries (1300–1399)
    let DbQueryContacts = EventId(1300, "DbQueryContacts")
    let DbQueryUsers    = EventId(1301, "DbQueryUsers")
    let DbQueryFailed   = EventId(1399, "DbQueryFailed")

    // Commands (1400–1499)
    let DbCommandContact = EventId(1400, "DbCommandContact")
    let DbCommandFailed  = EventId(1499, "DbCommandFailed")

    // Tenant (2000–2099)
    let TenantResolved = EventId(2000, "TenantResolved")
    let TenantRejected = EventId(2001, "TenantRejected")

    // Unhandled (9000–9099)
    let UnhandledError = EventId(9000, "UnhandledError")
```

### 6.3 Standard Field Set

| Field | Description |
|---|---|
| `CorrelationId` | From `HttpContext.Items[effinsty.correlationId]`. Generated or forwarded from `X-Correlation-ID` header. |
| `Tenant` | `TenantId` string value. Never null for tenant-scoped operations. |
| `Schema` | `TenantSchema` string value. Present for all DB operations. |
| `DataSource` | Oracle TNS alias. Safe to log — no credentials. |
| `ElapsedMs` | `long`. Stopwatch elapsed milliseconds. Always present for DB/network operations. |
| `Query` / `Command` | Short logical name, e.g. `contacts.list`. Never raw SQL text. |
| `ParamCount` | `int`. Number of SQL parameters bound. Never the values themselves. |
| `RowsAffected` | `int`. Present for INSERT / UPDATE / DELETE outcomes. |
| `Object` | Missing DB object name during startup validation, e.g. `TABLE TENANT_A.USERS`. |
| `UserId` | Guid string. Only on auth events. Never on data queries. |

### 6.4 Log Level Contract

| Level | When to emit |
|---|---|
| Trace | Not used — too noisy for Oracle workloads. |
| Debug | Connection opened, SELECT completed, health check passed. Disabled in Production by default. |
| Information | INSERT/UPDATE/DELETE succeeded, startup validation passed, application started. |
| Warning | Zero rows affected on a mutation, health check degraded, session rotation partial failure. |
| Error | Connection failure, query exception, health check hard failure, `InfrastructureError` / `UnexpectedError`. |
| Critical | Startup validation failure, missing DB object, JWT key not configured. Must crash the process. |

### 6.5 appsettings Configuration

```json
// appsettings.json — production baseline
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning",
      "Effinsty.Infrastructure.OracleConnectionFactory": "Warning",
      "Effinsty.Infrastructure.OracleContactRepository": "Warning",
      "Effinsty.Infrastructure.OracleUserRepository": "Warning",
      "Effinsty.Infrastructure.DbStartupValidationService": "Information"
    }
  }
}
```

```json
// appsettings.Development.json — verbose for local debugging
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information",
      "Effinsty.Infrastructure": "Debug"
    }
  }
}
```

---

## 7. JSON Console Output (Production)

### 7.1 Enabling the JSON Formatter

```fsharp
// Program.fs — JSON for production, plain console for dev
if app.Environment.IsProduction() then
    builder.Logging
        .ClearProviders()
        .AddJsonConsole(fun opts ->
            opts.JsonWriterOptions <- JsonWriterOptions(Indented = false)
            opts.IncludeScopes <- true
            opts.TimestampFormat <- "O")  // ISO 8601
    |> ignore
else
    builder.Logging.AddConsole() |> ignore
```

### 7.2 Example JSON Log Entry

```json
{
  "Timestamp": "2025-03-12T14:32:01.4421000Z",
  "EventId": { "Id": 1300, "Name": "DbQueryContacts" },
  "LogLevel": "Debug",
  "Category": "Effinsty.Infrastructure.OracleContactRepository",
  "Message": "DB query OK. Query=contacts.list ...",
  "State": {
    "Query": "contacts.list",
    "Tenant": "tenant-a",
    "Schema": "TENANT_A",
    "ParamCount": 3,
    "ElapsedMs": 12,
    "CorrelationId": "a1b2c3d4e5f6"
  }
}
```

---

## 8. Implementation File Inventory

| File | Action |
|---|---|
| `Effinsty.Infrastructure/Events.fs` | **CREATE** — central EventId registry. Add to `.fsproj` at the top of the compile list. |
| `Effinsty.Infrastructure/DbLogging.fs` | **CREATE** — `execQuery` / `execCommand` wrappers with Stopwatch and structured logging. |
| `Effinsty.Infrastructure/DbSchemaValidator.fs` | **CREATE** — `validateSchema` using ALL_TABLES / ALL_INDEXES / ALL_TRIGGERS / ALL_CONSTRAINTS. |
| `Effinsty.Infrastructure/DbStartupValidationService.fs` | **CREATE** — `IHostedService`; calls `StopApplication()` on any validation failure. |
| `Effinsty.Infrastructure/OracleTenantHealthCheck.fs` | **CREATE** — per-tenant `DataSourceAlias` health check registered alongside default. |
| `Effinsty.Infrastructure/OracleConnectionFactory.fs` | **MODIFY** — inject `ILogger<T>`, add connection open/fail logging with `ElapsedMs`. |
| `Effinsty.Infrastructure/OracleHealthCheck.fs` | **MODIFY** — inject `ILogger<T>`, run `SELECT 1 FROM DUAL`, emit structured entries. |
| `Effinsty.Infrastructure/Repositories.fs` | **MODIFY** — inject `ILogger` per repository type, wrap Dapper calls with `DbLogging` helpers. |
| `Effinsty.Infrastructure/ServiceCollection.fs` | **MODIFY** — register `OracleTenantHealthCheck` and `DbStartupValidationService`. |
| `Effinsty.Api/Program.fs` | **MODIFY** — JSON console formatter for production environment. |
| `Effinsty.Application/Contracts.fs` | **MODIFY** — add `correlationId: string` to `IContactRepository` and `IUserRepository` method signatures. |

---

## 9. Security & Compliance Checklist

| Rule | How to verify |
|---|---|
| Never log `PasswordHash` | `User` has `[JsonIgnore; IgnoreDataMember]`. Ensure no logger receives a `User` record directly. |
| Never log `AccessToken` / `RefreshToken` | `AuthToken.ToString()` already returns `<redacted>`. Never log individual token fields. |
| Never log SQL parameter values | `DbLogging` wrappers accept `paramCount: int`, never the `DynamicParameters` object. |
| Never log PII field values | Log only field names as constants; never `contact.Email`, `contact.Phone`, or `contact.Address` values. |
| Connection string is safe to log | Wallet auth (`User Id=/`) — no credentials present. `DataSource` alias is not a secret. |
| Schema name is always whitelisted | `SqlTemplates.validateSchema` enforces `^[A-Za-z_][A-Za-z0-9_]*$` before every query string is built. |
| Correlation ID echoed in response | `setCorrelationIdMiddleware` already writes `X-Correlation-ID` response header. |
| Startup fails fast on schema gap | `DbStartupValidationService` calls `StopApplication()` for any `Critical`-level failure. |

---

## 10. Developer Quick-Start Checklist

- [ ] `appsettings.Development.json` has a valid `Oracle.DataSource` alias (e.g. `mydb_high`)
- [ ] Wallet files exist at `Oracle.WalletLocation` and `Oracle.TnsAdmin` paths
- [ ] Redis is reachable at `Redis.Configuration` address
- [ ] `001_init.sql` executed for every schema listed under `Tenancy.Map`
- [ ] `dotnet run` prints `DB schema validation starting` then `Schema valid` for each tenant
- [ ] `GET /api/health/oracle` returns HTTP 200 `{"status":"Healthy"}`
- [ ] `POST /api/auth/login` returns a valid access token for a seeded `USERS` row
- [ ] Debug logs show `DbConnectionOpened` and `DbQueryContacts` events with `ElapsedMs` values
- [ ] No log entry contains a raw email address, phone number, password hash, or token string

---

*End of Specification*