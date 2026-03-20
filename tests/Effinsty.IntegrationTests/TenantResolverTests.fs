module TenantResolverTests

open System.Collections.Generic
open System.Threading
open Effinsty.Application
open Effinsty.Domain
open Effinsty.Infrastructure
open Microsoft.Extensions.Options
open Xunit

[<Fact>]
let ``tenant resolver maps known tenant to whitelist schema`` () =
    task {
        let tenantMap = Dictionary<string, TenantMapEntry>()

        tenantMap["tenant-a"] <-
            { Schema = "TENANT_A"
              DataSourceAlias = "mydb_high" }

        let options = Options.Create({ Map = tenantMap })
        let resolver = TenantResolver(options) :> ITenantResolver

        let! result = resolver.ResolveAsync(Some "tenant-a", CancellationToken.None)

        match result with
        | Error _ -> Assert.Fail("Expected tenant resolution success")
        | Ok tenant -> Assert.Equal("TENANT_A", TenantSchema.value tenant.Schema)
    }

[<Fact>]
let ``tenant resolver rejects unknown tenant`` () =
    task {
        let options = Options.Create({ Map = Dictionary<string, TenantMapEntry>() })
        let resolver = TenantResolver(options) :> ITenantResolver
        let! result = resolver.ResolveAsync(Some "missing", CancellationToken.None)

        match result with
        | Ok _ -> Assert.Fail("Expected forbidden")
        | Error(Forbidden _) -> Assert.True(true)
        | Error _ -> Assert.Fail("Expected forbidden error")
    }
