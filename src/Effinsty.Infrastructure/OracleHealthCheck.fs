namespace Effinsty.Infrastructure

open System
open System.Collections.Generic
open System.Diagnostics
open System.Threading
open Dapper
open Microsoft.Extensions.Diagnostics.HealthChecks
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options
open Oracle.ManagedDataAccess.Client

type OracleConnectivityHealthCheck(options: IOptions<OracleOptions>, logger: ILogger<OracleConnectivityHealthCheck>) =
    interface IHealthCheck with
        member _.CheckHealthAsync(_context, ct: CancellationToken) =
            task {
                let config = options.Value

                let dataSource =
                    if String.IsNullOrWhiteSpace(config.DataSource) then
                        let fromOracleEnv = Environment.GetEnvironmentVariable("ORACLE_DATA_SOURCE")

                        if String.IsNullOrWhiteSpace(fromOracleEnv) then
                            Environment.GetEnvironmentVariable("DATA_SOURCE")
                        else
                            fromOracleEnv
                    else
                        config.DataSource

                if String.IsNullOrWhiteSpace(dataSource) then
                    return HealthCheckResult.Unhealthy("DataSource missing.")
                else
                    let sw = Stopwatch.StartNew()

                    try
                        let timeout =
                            if config.ConnectionTimeoutSeconds <= 0 then
                                30
                            else
                                config.ConnectionTimeoutSeconds

                        let userId =
                            if String.IsNullOrWhiteSpace(config.UserId) then
                                Environment.GetEnvironmentVariable("ORACLE_USER_ID")
                            else
                                config.UserId

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
                        use conn = new OracleConnection(connectionString)
                        do! conn.OpenAsync(ct)

                        let! _ =
                            conn.ExecuteScalarAsync<int>(
                                CommandDefinition("SELECT 1 FROM DUAL", cancellationToken = ct)
                            )

                        sw.Stop()

                        logger.LogInformation(
                            Events.DbHealthCheckPassed,
                            "Oracle health check passed. DataSource={DataSource} ElapsedMs={ElapsedMs}",
                            dataSource,
                            sw.ElapsedMilliseconds
                        )

                        let data = Dictionary<string, obj>()
                        data["elapsedMs"] <- box sw.ElapsedMilliseconds

                        return HealthCheckResult.Healthy("Oracle healthy.", data)
                    with ex ->
                        sw.Stop()

                        logger.LogError(
                            Events.DbHealthCheckFailed,
                            ex,
                            "Oracle health check FAILED. DataSource={DataSource} ElapsedMs={ElapsedMs}",
                            dataSource,
                            sw.ElapsedMilliseconds
                        )

                        return HealthCheckResult.Unhealthy("Oracle unhealthy.", ex)
            }
