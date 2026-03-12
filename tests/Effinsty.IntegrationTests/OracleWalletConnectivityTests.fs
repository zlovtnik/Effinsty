module OracleWalletConnectivityTests

open System
open System.Threading
open Effinsty.Infrastructure
open Microsoft.Extensions.Diagnostics.HealthChecks
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options
open Xunit

[<Fact>]
let ``oracle wallet connectivity check runs when env vars are provided`` () =
    task {
        let wallet = Environment.GetEnvironmentVariable("ORACLE_WALLET_LOCATION")
        let tns = Environment.GetEnvironmentVariable("TNS_ADMIN")
        let dataSource = Environment.GetEnvironmentVariable("ORACLE_DATA_SOURCE")

        if String.IsNullOrWhiteSpace(wallet) || String.IsNullOrWhiteSpace(tns) || String.IsNullOrWhiteSpace(dataSource) then
            Assert.True(true)
        else
            let options =
                Options.Create(
                    {
                        WalletLocation = wallet
                        TnsAdmin = tns
                        DataSource = dataSource
                        ConnectionTimeoutSeconds = 10
                    }
                )

            use loggerFactory = LoggerFactory.Create(fun _ -> ())
            let logger = loggerFactory.CreateLogger<OracleConnectivityHealthCheck>()
            let check = OracleConnectivityHealthCheck(options, logger) :> IHealthCheck
            let context = HealthCheckContext()
            let! result = check.CheckHealthAsync(context, CancellationToken.None)
            Assert.Equal(HealthStatus.Healthy, result.Status)
    }

[<Fact>]
let ``oracle health check is unhealthy when datasource is missing`` () =
    task {
        let options =
            Options.Create(
                {
                    WalletLocation = String.Empty
                    TnsAdmin = String.Empty
                    DataSource = String.Empty
                    ConnectionTimeoutSeconds = 10
                }
            )

        use loggerFactory = LoggerFactory.Create(fun _ -> ())
        let logger = loggerFactory.CreateLogger<OracleConnectivityHealthCheck>()
        let check = OracleConnectivityHealthCheck(options, logger) :> IHealthCheck
        let context = HealthCheckContext()
        let! result = check.CheckHealthAsync(context, CancellationToken.None)
        Assert.Equal(HealthStatus.Unhealthy, result.Status)
    }
