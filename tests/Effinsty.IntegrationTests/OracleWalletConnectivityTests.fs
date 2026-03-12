module OracleWalletConnectivityTests

open System
open System.Threading
open Effinsty.Infrastructure
open Microsoft.Extensions.Diagnostics.HealthChecks
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

            let check = OracleConnectivityHealthCheck(options) :> IHealthCheck
            let context = HealthCheckContext()
            let! result = check.CheckHealthAsync(context, CancellationToken.None)
            Assert.Equal(HealthStatus.Healthy, result.Status)
    }
