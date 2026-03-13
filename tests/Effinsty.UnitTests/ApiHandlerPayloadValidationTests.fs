module ApiHandlerPayloadValidationTests

open System
open System.IO
open System.Text
open System.Threading
open System.Threading.Tasks
open Effinsty.Api
open Effinsty.Application
open Effinsty.Domain
open Giraffe
open Microsoft.AspNetCore.Http
open Microsoft.Extensions.DependencyInjection
open Xunit

type private SpyAuthService() =
    let mutable loginCalls = 0
    let mutable refreshCalls = 0
    let mutable logoutCalls = 0

    member _.LoginCalls = loginCalls
    member _.RefreshCalls = refreshCalls
    member _.LogoutCalls = logoutCalls

    interface IAuthService with
        member _.LoginAsync(_, _, _, _) =
            loginCalls <- loginCalls + 1
            Task.FromResult(Error(UnexpectedError "Login should not be called for malformed payload tests."))

        member _.RefreshAsync(_, _, _, _) =
            refreshCalls <- refreshCalls + 1
            Task.FromResult(Error(UnexpectedError "Refresh should not be called for malformed payload tests."))

        member _.LogoutAsync(_, _, _, _) =
            logoutCalls <- logoutCalls + 1
            Task.FromResult(Error(UnexpectedError "Logout should not be called for malformed payload tests."))

type private SpyContactService() =
    let mutable createCalls = 0
    let mutable updateCalls = 0

    member _.CreateCalls = createCalls
    member _.UpdateCalls = updateCalls

    interface IContactService with
        member _.ListAsync(_, _, _, _, _, _) =
            Task.FromResult(Ok {
                Items = []
                Page = 1
                PageSize = 20
                TotalCount = 0
            })

        member _.GetAsync(_, _, _, _, _) =
            Task.FromResult(Error(NotFound "Contact not found."))

        member _.CreateAsync(_, _, _, _) =
            createCalls <- createCalls + 1
            Task.FromResult(Error(UnexpectedError "Create should not be called for malformed payload tests."))

        member _.UpdateAsync(_, _, _, _) =
            updateCalls <- updateCalls + 1
            Task.FromResult(Error(UnexpectedError "Update should not be called for malformed payload tests."))

        member _.DeleteAsync(_, _, _, _, _) =
            Task.FromResult(Error(NotFound "Contact not found."))

let private buildServiceProvider (authService: IAuthService) (contactService: IContactService) =
    let services = ServiceCollection()
    services.AddGiraffe() |> ignore
    services.AddLogging() |> ignore
    services.AddSingleton<IAuthService>(authService) |> ignore
    services.AddSingleton<IContactService>(contactService) |> ignore
    services.BuildServiceProvider()

let private buildContext (services: IServiceProvider) (body: string) =
    let bytes = Encoding.UTF8.GetBytes(body)
    let ctx = DefaultHttpContext()
    ctx.RequestServices <- services
    ctx.Request.Method <- HttpMethods.Post
    ctx.Request.ContentType <- "application/json"
    ctx.Request.ContentLength <- int64 bytes.Length
    ctx.Request.Body <- new MemoryStream(bytes)
    ctx.Response.Body <- new MemoryStream()
    ctx

let private execute (handler: HttpHandler) (ctx: HttpContext) =
    task {
        let next: HttpFunc = fun httpContext -> Task.FromResult(Some httpContext)
        let! _ = handler next ctx
        return ctx.Response.StatusCode
    }

[<Fact>]
let ``refresh returns 400 for malformed json and does not invoke auth service`` () =
    task {
        let authSpy = SpyAuthService()
        let contactSpy = SpyContactService()
        use provider = buildServiceProvider (authSpy :> IAuthService) (contactSpy :> IContactService)
        let ctx = buildContext provider """{"refreshToken":"""
        let! status = execute AuthHandlers.refresh ctx
        Assert.Equal(400, status)
        Assert.Equal(0, authSpy.RefreshCalls)
    }

[<Fact>]
let ``logout returns 400 for malformed json and does not invoke auth service`` () =
    task {
        let authSpy = SpyAuthService()
        let contactSpy = SpyContactService()
        use provider = buildServiceProvider (authSpy :> IAuthService) (contactSpy :> IContactService)
        let ctx = buildContext provider """{"refreshToken":"""
        let! status = execute AuthHandlers.logout ctx
        Assert.Equal(400, status)
        Assert.Equal(0, authSpy.LogoutCalls)
    }

[<Fact>]
let ``create contact returns 400 for malformed json and does not invoke contact service`` () =
    task {
        let authSpy = SpyAuthService()
        let contactSpy = SpyContactService()
        use provider = buildServiceProvider (authSpy :> IAuthService) (contactSpy :> IContactService)
        let ctx = buildContext provider """{"firstName":"Ada","lastName":"""
        let! status = execute ContactHandlers.createContact ctx
        Assert.Equal(400, status)
        Assert.Equal(0, contactSpy.CreateCalls)
    }

[<Fact>]
let ``update contact returns 400 for malformed json and does not invoke contact service`` () =
    task {
        let authSpy = SpyAuthService()
        let contactSpy = SpyContactService()
        use provider = buildServiceProvider (authSpy :> IAuthService) (contactSpy :> IContactService)
        let handler = ContactHandlers.updateContact (Guid.NewGuid())
        let ctx = buildContext provider """{"firstName":"Ada","lastName":"""
        let! status = execute handler ctx
        Assert.Equal(400, status)
        Assert.Equal(0, contactSpy.UpdateCalls)
    }
