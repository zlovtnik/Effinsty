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

                if String.IsNullOrWhiteSpace(config.DataSource) then
                    return HealthCheckResult.Unhealthy("DataSource missing.")
                else
                    let sw = Stopwatch.StartNew()

                    try
                        let timeout = if config.ConnectionTimeoutSeconds <= 0 then 30 else config.ConnectionTimeoutSeconds
                        let authSegment =
                            if String.IsNullOrWhiteSpace(config.UserId) then
                                "User Id=/"
                            elif String.IsNullOrWhiteSpace(config.Password) then
                                $"User Id={config.UserId}"
                            else
                                $"User Id={config.UserId};Password={config.Password}"

                        let connectionString = $"{authSegment};Data Source={config.DataSource};Connection Timeout={timeout}"
                        use conn = new OracleConnection(connectionString)
                        do! conn.OpenAsync(ct)
                        let! _ = conn.ExecuteScalarAsync<int>(CommandDefinition("SELECT 1 FROM DUAL", cancellationToken = ct))
                        sw.Stop()

                        logger.LogInformation(
                            Events.DbHealthCheckPassed,
                            "Oracle health check passed. DataSource={DataSource} ElapsedMs={ElapsedMs}",
                            config.DataSource,
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
                            config.DataSource,
                            sw.ElapsedMilliseconds
                        )

                        return HealthCheckResult.Unhealthy("Oracle unhealthy.", ex)
            }
