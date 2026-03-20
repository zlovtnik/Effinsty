module JwtTokenProviderScopeTests

open System
open System.Collections.Generic
open System.IdentityModel.Tokens.Jwt
open Effinsty.Application
open Effinsty.Domain
open Effinsty.Infrastructure
open Microsoft.Extensions.Options
open Xunit

let private buildUser tenantId =
    let now = DateTimeOffset.UtcNow

    { Id = UserId(Guid.NewGuid())
      TenantId = TenantId tenantId
      Username = "scope-test-user"
      Email = "scope-test@example.com"
      PasswordHash = "hash"
      Active = true
      CreatedAt = now
      UpdatedAt = now }

let private buildTenantContext tenantId =
    { TenantId = TenantId tenantId
      Schema = TenantSchema "TENANT_SCOPE_TEST"
      DataSourceAlias = "scope_test" }

let private buildJwtOptions () =
    { Issuer = "effinsty-test"
      Audience = "effinsty-test-clients"
      SigningKey = "0123456789abcdef0123456789abcdef"
      AccessTokenMinutes = 15
      RefreshTokenDays = 7
      DefaultAccessScopes = []
      TenantAccessScopes = Dictionary<string, string list>() }

let private getScopeClaim (jwt: string) =
    let token = JwtSecurityTokenHandler().ReadJwtToken(jwt)

    token.Claims
    |> Seq.tryFind (fun claim -> claim.Type = "scope")
    |> Option.map (fun claim -> claim.Value)

[<Fact>]
let ``issue tokens uses tenant-specific configured scopes`` () =
    let options = buildJwtOptions ()
    options.TenantAccessScopes["tenant-a"] <- [ "contacts.read"; "contacts.write" ]

    let provider = JwtTokenProvider(Options.Create(options)) :> ITokenProvider
    let user = buildUser "tenant-a"
    let tenant = buildTenantContext "tenant-a"

    match provider.IssueTokens(user, tenant) with
    | Error error -> Assert.Fail($"Expected success but got error: {error}")
    | Ok token ->
        let scope = getScopeClaim token.AccessToken
        Assert.Equal(Some "contacts.read contacts.write", scope)

[<Fact>]
let ``issue tokens falls back to legacy full contact scopes when config is empty`` () =
    let options = buildJwtOptions ()
    let provider = JwtTokenProvider(Options.Create(options)) :> ITokenProvider
    let user = buildUser "tenant-without-scope-config"
    let tenant = buildTenantContext "tenant-without-scope-config"

    match provider.IssueTokens(user, tenant) with
    | Error error -> Assert.Fail($"Expected success but got error: {error}")
    | Ok token ->
        let scope = getScopeClaim token.AccessToken
        Assert.Equal(Some "contacts.read contacts.write contacts.delete", scope)
