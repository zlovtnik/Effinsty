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
                    let configuredDataSource =
                        if String.IsNullOrWhiteSpace(tenant.DataSourceAlias) then config.DataSource else tenant.DataSourceAlias

                    if String.IsNullOrWhiteSpace(configuredDataSource) then
                        let fromOracleEnv = Environment.GetEnvironmentVariable("ORACLE_DATA_SOURCE")

                        if String.IsNullOrWhiteSpace(fromOracleEnv) then
                            Environment.GetEnvironmentVariable("DATA_SOURCE")
                        else
                            fromOracleEnv
                    else
                        configuredDataSource

                let timeout = if config.ConnectionTimeoutSeconds <= 0 then 30 else config.ConnectionTimeoutSeconds
                let userId = if String.IsNullOrWhiteSpace(config.UserId) then Environment.GetEnvironmentVariable("ORACLE_USER_ID") else config.UserId

                let password =
                    if String.IsNullOrWhiteSpace(config.Password) then
                        Environment.GetEnvironmentVariable("ORACLE_PASSWORD")
                    else
                        config.Password

                let builder = OracleConnectionStringBuilder()
                builder.ConnectionTimeout <- timeout
                builder.DataSource <- dataSource

                if String.IsNullOrWhiteSpace(userId) then
                    builder.UserID <- "/"
                elif String.IsNullOrWhiteSpace(password) then
                    builder.UserID <- userId
                else
                    builder.UserID <- userId
                    builder.Password <- password

                let connectionString = builder.ConnectionString

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
