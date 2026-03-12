module ServicePipelineTests

open System
open System.Threading
open System.Threading.Tasks
open Effinsty.Application
open Effinsty.Domain
open Xunit

type private FakeContactRepository() =
    interface IContactRepository with
        member _.ListAsync(_, _, _, _, _) = Task.FromResult([])
        member _.CountAsync(_, _, _) = Task.FromResult(0)
        member _.GetByIdAsync(_, _, _, _) = Task.FromResult(None)
        member _.ExistsByEmailAsync(_, _, _, _, _) = Task.FromResult(true)
        member _.CreateAsync(_, contact, _) = Task.FromResult(contact)
        member _.UpdateAsync(_, contact, _) = Task.FromResult(contact)
        member _.DeleteAsync(_, _, _, _) = Task.FromResult(false)

type private FakeUserRepository() =
    interface IUserRepository with
        member _.FindByUsernameAsync(_, _, _) = Task.FromResult(None)
        member _.FindByIdAsync(_, _, _) = Task.FromResult(None)

type private FakePasswordHasher() =
    interface IPasswordHasher with
        member _.Verify(_, _) = false

type private FakeTokenProvider() =
    interface ITokenProvider with
        member _.IssueTokens(_, _) = Error(UnexpectedError "Not expected")
        member _.ValidateRefreshToken(_) = Error(Unauthorized "Not expected")

type private FakeSessionStore() =
    interface ISessionStore with
        member _.SaveAsync(_, _) = Task.CompletedTask
        member _.GetAsync(_, _) = Task.FromResult(None)
        member _.DeleteAsync(_, _) = Task.CompletedTask

let private tenant =
    {
        TenantId = TenantId "tenant-a"
        Schema = TenantSchema "TENANT_A"
        DataSourceAlias = "mydb_high"
    }

[<Fact>]
let ``contact create returns conflict when duplicate email exists`` () =
    task {
        let service = ContactService(FakeContactRepository()) :> IContactService

        let command =
            {
                UserId = UserId(Guid.NewGuid())
                FirstName = "John"
                LastName = "Doe"
                Email = Some "john@doe.com"
                Phone = None
                Address = None
                Metadata = Map.empty
            }

        let! result = service.CreateAsync(tenant, command, CancellationToken.None)

        match result with
        | Ok _ -> Assert.Fail("Expected conflict")
        | Error (Conflict message) -> Assert.Contains("already exists", message)
        | Error _ -> Assert.Fail("Expected conflict error")
    }

[<Fact>]
let ``auth login returns unauthorized when user is missing`` () =
    task {
        let service =
            AuthService(FakeUserRepository(), FakePasswordHasher(), FakeTokenProvider(), FakeSessionStore())
            :> IAuthService

        let command = { Username = "nobody"; Password = "password" }
        let! result = service.LoginAsync(tenant, command, CancellationToken.None)

        match result with
        | Ok _ -> Assert.Fail("Expected unauthorized")
        | Error (Unauthorized message) -> Assert.Contains("Invalid credentials", message)
        | Error _ -> Assert.Fail("Expected unauthorized error")
    }
