namespace Effinsty.Infrastructure

open System
open System.Collections.Generic
open System.Diagnostics
open System.Runtime.ExceptionServices
open System.Threading
open Dapper
open Microsoft.Extensions.Diagnostics.HealthChecks
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options
open Oracle.ManagedDataAccess.Client

type OracleTenantHealthCheck(
    options: IOptions<OracleOptions>,
    tenantOptions: IOptions<TenantOptions>,
    logger: ILogger<OracleTenantHealthCheck>
) =
    let config = options.Value

    interface IHealthCheck with
        member _.CheckHealthAsync(_context, ct: CancellationToken) =
            task {
                let mutable allHealthy = true
                let results = Dictionary<string, obj>()
                let timeout = if config.ConnectionTimeoutSeconds <= 0 then 30 else config.ConnectionTimeoutSeconds
                let userId = if String.IsNullOrWhiteSpace(config.UserId) then Environment.GetEnvironmentVariable("ORACLE_USER_ID") else config.UserId

                let password =
                    if String.IsNullOrWhiteSpace(config.Password) then
                        Environment.GetEnvironmentVariable("ORACLE_PASSWORD")
                    else
                        config.Password

                let baseBuilder = OracleConnectionStringBuilder()
                baseBuilder.ConnectionTimeout <- timeout

                if String.IsNullOrWhiteSpace(userId) then
                    baseBuilder.UserID <- "/"
                elif String.IsNullOrWhiteSpace(password) then
                    baseBuilder.UserID <- userId
                else
                    baseBuilder.UserID <- userId
                    baseBuilder.Password <- password

                for kvp in tenantOptions.Value.Map do
                    let configuredAlias =
                        if String.IsNullOrWhiteSpace(kvp.Value.DataSourceAlias) then
                            config.DataSource
                        else
                            kvp.Value.DataSourceAlias

                    let alias =
                        if String.IsNullOrWhiteSpace(configuredAlias) then
                            let fromOracleEnv = Environment.GetEnvironmentVariable("ORACLE_DATA_SOURCE")

                            if String.IsNullOrWhiteSpace(fromOracleEnv) then
                                Environment.GetEnvironmentVariable("DATA_SOURCE")
                            else
                                fromOracleEnv
                        else
                            configuredAlias

                    let sw = Stopwatch.StartNew()

                    try
                        let builder = OracleConnectionStringBuilder(baseBuilder.ConnectionString)
                        builder.DataSource <- alias
                        use conn = new OracleConnection(builder.ConnectionString)
                        do! conn.OpenAsync(ct)
                        let! _ = conn.ExecuteScalarAsync<int>(CommandDefinition("SELECT 1 FROM DUAL", cancellationToken = ct))
                        sw.Stop()
                        results[kvp.Key] <- box $"OK ({sw.ElapsedMilliseconds}ms)"

                        logger.LogDebug(
                            Events.TenantDbHealthCheckPassed,
                            "Tenant DB OK. Tenant={Tenant} Alias={Alias} ElapsedMs={ElapsedMs}",
                            kvp.Key,
                            alias,
                            sw.ElapsedMilliseconds
                        )
                    with ex ->
                        match ex with
                        | :? OperationCanceledException ->
                            ExceptionDispatchInfo.Capture(ex).Throw()
                        | _ ->
                            sw.Stop()
                            allHealthy <- false
                            results[kvp.Key] <- box $"FAIL: {ex.Message}"

                            logger.LogError(
                                Events.TenantDbHealthCheckFailed,
                                ex,
                                "Tenant DB FAILED. Tenant={Tenant} Alias={Alias} ElapsedMs={ElapsedMs}",
                                kvp.Key,
                                alias,
                                sw.ElapsedMilliseconds
                            )

                if allHealthy then
                    return HealthCheckResult.Healthy("All tenant DB sources healthy.", results)
                else
                    return HealthCheckResult.Degraded("One or more tenant sources failed.", data = results)
            }
