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

type OracleTenantHealthCheck(tenantOptions: IOptions<TenantOptions>, logger: ILogger<OracleTenantHealthCheck>) =
    interface IHealthCheck with
        member _.CheckHealthAsync(_context, ct: CancellationToken) =
            task {
                let mutable allHealthy = true
                let results = Dictionary<string, obj>()

                for kvp in tenantOptions.Value.Map do
                    let alias = kvp.Value.DataSourceAlias
                    let sw = Stopwatch.StartNew()

                    try
                        use conn = new OracleConnection($"User Id=/;Data Source={alias}")
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
