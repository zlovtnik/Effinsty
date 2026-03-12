module InfrastructureLoggingAndStartupTests

open System
open System.Collections.Generic
open System.Data
open System.Threading
open System.Threading.Tasks
open Effinsty.Application
open Effinsty.Domain
open Effinsty.Infrastructure
open Microsoft.Extensions.Hosting
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options
open Xunit

type private NoOpConnectionFactory() =
    interface IOracleConnectionFactory with
        member _.CreateOpenConnectionAsync(_, _) =
            Task.FromException<IDbConnection>(InvalidOperationException("CreateOpenConnectionAsync should not be called in this test."))

type private TrackingHostApplicationLifetime() =
    let mutable stopCalled = false

    member _.StopCalled = stopCalled

    interface IHostApplicationLifetime with
        member _.ApplicationStarted = CancellationToken.None
        member _.ApplicationStopping = CancellationToken.None
        member _.ApplicationStopped = CancellationToken.None

        member _.StopApplication() =
            stopCalled <- true

type private CapturedLog = {
    Level: LogLevel
    EventId: EventId
    State: IReadOnlyDictionary<string, string>
}

type private CapturingLogger() =
    let entries = ResizeArray<CapturedLog>()

    member _.Entries = entries

    interface ILogger with
        member _.BeginScope<'TState>(_state: 'TState) = { new IDisposable with member _.Dispose() = () }

        member _.IsEnabled(_level) = true

        member _.Log<'TState>(level: LogLevel, eventId: EventId, state: 'TState, _ex: exn, _formatter: Func<'TState, exn, string>) =
            let values =
                match box state with
                | :? seq<KeyValuePair<string, obj>> as fields ->
                    let captured = Dictionary<string, string>()

                    fields
                    |> Seq.iter (fun field ->
                        let value = if isNull field.Value then String.Empty else string field.Value
                        captured[field.Key] <- value)

                    captured :> IReadOnlyDictionary<string, string>
                | _ -> Dictionary<string, string>() :> IReadOnlyDictionary<string, string>

            entries.Add(
                {
                    Level = level
                    EventId = eventId
                    State = values
                }
            )

[<Fact>]
let ``db startup validation stops host and throws when tenant schema is invalid`` () =
    task {
        let tenantMap = Dictionary<string, TenantMapEntry>()

        tenantMap["tenant-a"] <- {
            Schema = "INVALID SCHEMA"
            DataSourceAlias = "mydb_high"
        }

        let tenantOptions = Options.Create({ Map = tenantMap })
        let lifetime = TrackingHostApplicationLifetime()
        use loggerFactory = LoggerFactory.Create(fun _ -> ())
        let logger = loggerFactory.CreateLogger<DbStartupValidationService>()

        let service =
            DbStartupValidationService(NoOpConnectionFactory(), tenantOptions, lifetime, logger)
            :> IHostedService

        let! capturedEx = Assert.ThrowsAsync<InvalidOperationException>(fun () -> service.StartAsync(CancellationToken.None))
        Assert.Contains("DB startup validation failed", capturedEx.Message)
        Assert.True(lifetime.StopCalled)
    }

[<Fact>]
let ``db logging query wrapper logs structured fields without parameter values`` () =
    task {
        let logger = CapturingLogger()

        let tenant = {
            TenantId = TenantId "tenant-a"
            Schema = TenantSchema "TENANT_A"
            DataSourceAlias = "mydb_high"
        }

        let secretParameterValue = "sensitive@example.com"

        let! result =
            DbLogging.execQuery
                (logger :> ILogger)
                Events.DbQueryContacts
                tenant
                "corr-123"
                "contacts.list"
                3
                (fun () -> Task.FromResult(secretParameterValue.Length))

        Assert.True(result > 0)
        let _ = Assert.Single(logger.Entries)

        let entry = logger.Entries[0]
        Assert.Equal(LogLevel.Debug, entry.Level)
        Assert.Equal(Events.DbQueryContacts.Id, entry.EventId.Id)
        Assert.Equal("contacts.list", entry.State["Query"])
        Assert.Equal("tenant-a", entry.State["Tenant"])
        Assert.Equal("TENANT_A", entry.State["Schema"])
        Assert.Equal("3", entry.State["ParamCount"])
        Assert.Equal("corr-123", entry.State["CorrelationId"])
        Assert.DoesNotContain(secretParameterValue, entry.State.Values)
    }
