module ApiContractLockTests

open System
open System.IO
open System.Security.Claims
open System.Text
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open Effinsty.Api
open Effinsty.Application
open Effinsty.Domain
open Giraffe
open Microsoft.AspNetCore.Http
open Microsoft.Extensions.DependencyInjection
open Xunit

type private SuccessfulAuthService() =
    let token =
        {
            AccessToken = "test-access-token"
            RefreshToken = "test-refresh-token"
            ExpiresAt = DateTimeOffset.Parse("2026-03-12T12:00:00Z")
        }

    interface IAuthService with
        member _.LoginAsync(_, _, _, _) = Task.FromResult(Ok token)
        member _.RefreshAsync(_, _, _, _) = Task.FromResult(Ok token)
        member _.LogoutAsync(_, _, _, _) = Task.FromResult(Ok())

type private SpyContactService() =
    let mutable lastRequestedPageSize = 0

    member _.LastRequestedPageSize = lastRequestedPageSize

    interface IContactService with
        member _.ListAsync(_, _, _, page, pageSize, _) =
            lastRequestedPageSize <- pageSize

            Task.FromResult(
                Ok {
                    Items = []
                    Page = page
                    PageSize = pageSize
                    TotalCount = 0
                }
            )

        member _.GetAsync(_, _, _, _, _) =
            Task.FromResult(Error(NotFound "Contact not found."))

        member _.CreateAsync(_, _, _, _) =
            Task.FromResult(Error(NotFound "Not implemented in contract tests."))

        member _.UpdateAsync(_, _, _, _) =
            Task.FromResult(Error(NotFound "Not implemented in contract tests."))

        member _.DeleteAsync(_, _, _, _, _) =
            Task.FromResult(Error(NotFound "Not implemented in contract tests."))

let private tenantContext =
    {
        TenantId = TenantId "tenant-a"
        Schema = TenantSchema "TENANT_A"
        DataSourceAlias = "mydb_high"
    }

let private buildServiceProvider (authService: IAuthService) (contactService: IContactService) =
    let services = ServiceCollection()
    services.AddGiraffe() |> ignore
    services.AddLogging() |> ignore
    services.AddSingleton<IAuthService>(authService) |> ignore
    services.AddSingleton<IContactService>(contactService) |> ignore
    services.BuildServiceProvider()

let private buildContext
    (services: IServiceProvider)
    (httpMethod: string)
    (path: string)
    (queryString: string option)
    (body: string option)
    =
    let ctx = DefaultHttpContext()
    ctx.RequestServices <- services
    ctx.Request.Method <- httpMethod
    ctx.Request.Path <- PathString(path)
    ctx.Response.Body <- new MemoryStream()

    match queryString with
    | Some query -> ctx.Request.QueryString <- QueryString(query)
    | None -> ()

    match body with
    | Some jsonBody ->
        let bytes = Encoding.UTF8.GetBytes(jsonBody)
        ctx.Request.ContentType <- "application/json"
        ctx.Request.ContentLength <- int64 bytes.Length
        ctx.Request.Body <- new MemoryStream(bytes)
    | None -> ()

    ctx

let private setAuthenticatedUser (ctx: HttpContext) (userId: Guid) =
    let claims = [ Claim(ClaimTypes.NameIdentifier, userId.ToString()) ]
    let identity = ClaimsIdentity(claims, "test-auth")
    ctx.User <- ClaimsPrincipal(identity)

let private setAuthenticatedUserWithScopes (ctx: HttpContext) (userId: Guid) (scopes: string list) =
    let scopeClaims =
        scopes
        |> List.filter (String.IsNullOrWhiteSpace >> not)
        |> List.map (fun scope -> Claim("scope", scope))

    let claims = Claim(ClaimTypes.NameIdentifier, userId.ToString()) :: scopeClaims
    let identity = ClaimsIdentity(claims, "test-auth")
    ctx.User <- ClaimsPrincipal(identity)

let private execute (handler: HttpHandler) (ctx: HttpContext) =
    task {
        let next: HttpFunc = fun httpContext -> Task.FromResult(Some httpContext)
        let! _ = handler next ctx
        return ctx.Response.StatusCode
    }

let private readResponseBody (ctx: HttpContext) =
    ctx.Response.Body.Seek(0L, SeekOrigin.Begin) |> ignore
    use reader = new StreamReader(ctx.Response.Body, Encoding.UTF8, true, 1024, true)
    reader.ReadToEnd()

let private getProperty (name: string) (element: JsonElement) =
    let mutable value = Unchecked.defaultof<JsonElement>

    if element.TryGetProperty(name, &value) then
        Some value
    else
        None

[<Fact>]
let ``login returns camelCase token keys`` () =
    task {
        let authService = SuccessfulAuthService() :> IAuthService
        let contactService = SpyContactService() :> IContactService
        use provider = buildServiceProvider authService contactService

        let ctx =
            buildContext
                provider
                HttpMethods.Post
                "/api/auth/login"
                None
                (Some """{"username":"alice","password":"password"}""")

        setTenantContext ctx tenantContext

        let! status = execute AuthHandlers.login ctx
        Assert.Equal(200, status)

        use payload = readResponseBody ctx |> JsonDocument.Parse
        let root = payload.RootElement

        Assert.True(getProperty "accessToken" root |> Option.isSome)
        Assert.True(getProperty "refreshToken" root |> Option.isSome)
        Assert.True(getProperty "expiresAt" root |> Option.isSome)
        Assert.True(getProperty "AccessToken" root |> Option.isNone)
        Assert.True(getProperty "RefreshToken" root |> Option.isNone)
        Assert.True(getProperty "ExpiresAt" root |> Option.isNone)
    }

[<Fact>]
let ``contacts list clamps pageSize to 100 and returns camelCase paged payload`` () =
    task {
        let authService = SuccessfulAuthService() :> IAuthService
        let contactSpy = SpyContactService()
        use provider = buildServiceProvider authService (contactSpy :> IContactService)

        let ctx = buildContext provider HttpMethods.Get "/api/contacts" (Some "?page=1&pageSize=200") None
        setTenantContext ctx tenantContext
        setAuthenticatedUser ctx (Guid.NewGuid())

        let! status = execute ContactHandlers.listContacts ctx
        Assert.Equal(200, status)
        Assert.Equal(100, contactSpy.LastRequestedPageSize)

        use payload = readResponseBody ctx |> JsonDocument.Parse
        let root = payload.RootElement

        Assert.True(getProperty "items" root |> Option.isSome)
        Assert.True(getProperty "page" root |> Option.isSome)
        Assert.True(getProperty "pageSize" root |> Option.isSome)
        Assert.True(getProperty "totalCount" root |> Option.isSome)
        Assert.True(getProperty "PageSize" root |> Option.isNone)

        let pageSize =
            getProperty "pageSize" root
            |> Option.map (fun value -> value.GetInt32())

        Assert.Equal(Some 100, pageSize)
    }

[<Fact>]
let ``missing tenant context returns structured 4xx error with correlationId key`` () =
    task {
        let authService = SuccessfulAuthService() :> IAuthService
        let contactService = SpyContactService() :> IContactService
        use provider = buildServiceProvider authService contactService

        let ctx = buildContext provider HttpMethods.Get "/api/contacts" (Some "?page=1&pageSize=20") None
        setAuthenticatedUser ctx (Guid.NewGuid())
        setCorrelationId ctx "test-correlation-id"

        let! status = execute ContactHandlers.listContacts ctx

        Assert.True(status >= 400 && status < 500)

        use payload = readResponseBody ctx |> JsonDocument.Parse
        let root = payload.RootElement

        Assert.True(getProperty "code" root |> Option.isSome)
        Assert.True(getProperty "message" root |> Option.isSome)
        Assert.True(getProperty "details" root |> Option.isSome)
        Assert.True(getProperty "correlationId" root |> Option.isSome)
        Assert.True(getProperty "CorrelationId" root |> Option.isNone)

        let correlationId =
            getProperty "correlationId" root
            |> Option.map (fun value -> value.GetString())

        Assert.Equal(Some "test-correlation-id", correlationId)
    }

[<Fact>]
let ``program source keeps correlation-id echo and generation middleware contract`` () =
    let programPath =
        Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "..", "..", "src", "Effinsty.Api", "Program.fs"))

    let source = File.ReadAllText(programPath)

    Assert.Contains("""ctx.Request.Headers.ContainsKey("X-Correlation-ID")""", source)
    Assert.Contains("""Guid.NewGuid().ToString("N")""", source)
    Assert.Contains("""ctx.Response.Headers["X-Correlation-ID"] <- correlationId""", source)

[<Fact>]
let ``scope middleware returns 403 with structured payload when scope is missing`` () =
    task {
        let authService = SuccessfulAuthService() :> IAuthService
        let contactService = SpyContactService() :> IContactService
        use provider = buildServiceProvider authService contactService

        let ctx = buildContext provider HttpMethods.Get "/api/contacts" None None
        setCorrelationId ctx "scope-correlation-id"
        setAuthenticatedUserWithScopes ctx (Guid.NewGuid()) []

        let handler = ScopeAuthorization.requireScope "contacts.read" >=> setStatusCode 200
        let! status = execute handler ctx

        Assert.Equal(403, status)

        use payload = readResponseBody ctx |> JsonDocument.Parse
        let root = payload.RootElement

        Assert.Equal(Some "forbidden", getProperty "code" root |> Option.map (fun value -> value.GetString()))
        Assert.Equal(
            Some "scope-correlation-id",
            getProperty "correlationId" root |> Option.map (fun value -> value.GetString())
        )
    }

[<Fact>]
let ``scope middleware allows delete route when write scope exists`` () =
    task {
        let authService = SuccessfulAuthService() :> IAuthService
        let contactService = SpyContactService() :> IContactService
        use provider = buildServiceProvider authService contactService

        let ctx = buildContext provider HttpMethods.Delete "/api/contacts/00000000-0000-0000-0000-000000000001" None None
        setAuthenticatedUserWithScopes ctx (Guid.NewGuid()) [ "contacts.write" ]

        let handler = ScopeAuthorization.requireAnyScope [ "contacts.delete"; "contacts.write" ] >=> setStatusCode 204
        let! status = execute handler ctx

        Assert.Equal(204, status)
    }

[<Fact>]
let ``program source enforces contact scopes on route handlers`` () =
    let programPath =
        Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "..", "..", "src", "Effinsty.Api", "Program.fs"))

    let source = File.ReadAllText(programPath)

    Assert.Contains("""route "" >=> requireScope "contacts.read" >=> ContactHandlers.listContacts""", source)
    Assert.Contains("""route "" >=> requireScope "contacts.write" >=> ContactHandlers.createContact""", source)
    Assert.Contains("""requireScope "contacts.read" >=> ContactHandlers.getContact""", source)
    Assert.Contains("""requireScope "contacts.write" >=> ContactHandlers.updateContact""", source)
    Assert.Contains("""requireAnyScope [ "contacts.delete"; "contacts.write" ] >=> ContactHandlers.deleteContact""", source)
