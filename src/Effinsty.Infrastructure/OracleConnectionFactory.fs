namespace Effinsty.Infrastructure

open System
open System.Data
open System.Diagnostics
open System.Runtime.ExceptionServices
open System.Threading
open Effinsty.Application
open Effinsty.Domain
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options
open Oracle.ManagedDataAccess.Client

type OracleConnectionFactory(options: IOptions<OracleOptions>, logger: ILogger<OracleConnectionFactory>) =
    let config = options.Value

    interface IOracleConnectionFactory with
        member _.CreateOpenConnectionAsync(tenant, ct) =
            task {
                let dataSource =
                    if String.IsNullOrWhiteSpace(tenant.DataSourceAlias) then config.DataSource else tenant.DataSourceAlias

                let timeout = if config.ConnectionTimeoutSeconds <= 0 then 30 else config.ConnectionTimeoutSeconds

                let authSegment =
                    if String.IsNullOrWhiteSpace(config.UserId) then
                        "User Id=/"
                    elif String.IsNullOrWhiteSpace(config.Password) then
                        $"User Id={config.UserId}"
                    else
                        $"User Id={config.UserId};Password={config.Password}"

                let connectionString =
                    $"{authSegment};Data Source={dataSource};Connection Timeout={timeout}"

                let sw = Stopwatch.StartNew()
                let conn = new OracleConnection(connectionString)

                try
                    do! conn.OpenAsync(ct)
                    sw.Stop()

                    logger.LogDebug(
                        Events.DbConnectionOpened,
                        "Oracle connection opened. DataSource={DataSource} Tenant={Tenant} Schema={Schema} ElapsedMs={ElapsedMs}",
                        dataSource,
                        TenantId.value tenant.TenantId,
                        TenantSchema.value tenant.Schema,
                        sw.ElapsedMilliseconds
                    )

                    return conn :> IDbConnection
                with ex ->
                    sw.Stop()
                    conn.Dispose()

                    logger.LogError(
                        Events.DbConnectionFailed,
                        ex,
                        "Oracle connection FAILED. DataSource={DataSource} Tenant={Tenant} Schema={Schema} ElapsedMs={ElapsedMs}",
                        dataSource,
                        TenantId.value tenant.TenantId,
                        TenantSchema.value tenant.Schema,
                        sw.ElapsedMilliseconds
                    )

                    ExceptionDispatchInfo.Capture(ex).Throw()
                    return Unchecked.defaultof<IDbConnection>
            }
