module OracleWalletConnectivityTests

open System
open System.Threading
open Effinsty.Infrastructure
open Microsoft.Extensions.Diagnostics.HealthChecks
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options
open Xunit

let private firstNonEmpty (values: string list) =
    values
    |> List.tryFind (fun value -> not (String.IsNullOrWhiteSpace(value)))

let private mkOracleOptions wallet tns dataSource =
    {
        WalletLocation = wallet
        TnsAdmin = tns
        DataSource = dataSource
        ConnectionTimeoutSeconds = 10
        UserId = String.Empty
        Password = String.Empty
    }

[<Fact>]
let ``oracle wallet connectivity check runs when env vars are provided`` () =
    task {
        let wallet =
            firstNonEmpty [
                Environment.GetEnvironmentVariable("ORACLE_WALLET_PATH")
                Environment.GetEnvironmentVariable("ORACLE_WALLET_LOCATION")
                Environment.GetEnvironmentVariable("WALLET_LOCATION")
            ]
            |> Option.defaultValue String.Empty

        let tns = Environment.GetEnvironmentVariable("TNS_ADMIN")
        let dataSource = Environment.GetEnvironmentVariable("ORACLE_DATA_SOURCE")

        if String.IsNullOrWhiteSpace(wallet) || String.IsNullOrWhiteSpace(tns) || String.IsNullOrWhiteSpace(dataSource) then
            Assert.True(true)
        else
            let options = Options.Create(mkOracleOptions wallet tns dataSource)

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
        let options = Options.Create(mkOracleOptions String.Empty String.Empty String.Empty)

        use loggerFactory = LoggerFactory.Create(fun _ -> ())
        let logger = loggerFactory.CreateLogger<OracleConnectivityHealthCheck>()
        let check = OracleConnectivityHealthCheck(options, logger) :> IHealthCheck
        let context = HealthCheckContext()
        let! result = check.CheckHealthAsync(context, CancellationToken.None)
        Assert.Equal(HealthStatus.Unhealthy, result.Status)
    }
