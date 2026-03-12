namespace Effinsty.Infrastructure

open System
open System.Threading
open System.Threading.Tasks
open Microsoft.Extensions.Diagnostics.HealthChecks
open Microsoft.Extensions.Options
open Oracle.ManagedDataAccess.Client

type OracleConnectivityHealthCheck(options: IOptions<OracleOptions>) =
    interface IHealthCheck with
        member _.CheckHealthAsync(_context, ct: CancellationToken) =
            task {
                try
                    let config = options.Value

                    if not (String.IsNullOrWhiteSpace(config.WalletLocation)) then
                        OracleConfiguration.WalletLocation <- config.WalletLocation

                    if not (String.IsNullOrWhiteSpace(config.TnsAdmin)) then
                        OracleConfiguration.TnsAdmin <- config.TnsAdmin

                    let timeout = if config.ConnectionTimeoutSeconds <= 0 then 30 else config.ConnectionTimeoutSeconds
                    let connectionString = $"User Id=/;Data Source={config.DataSource};Connection Timeout={timeout}"
                    use conn = new OracleConnection(connectionString)
                    do! conn.OpenAsync(ct)
                    return HealthCheckResult.Healthy("Oracle wallet connectivity is healthy.")
                with ex ->
                    return HealthCheckResult.Unhealthy("Oracle wallet connectivity check failed.", ex)
            }
