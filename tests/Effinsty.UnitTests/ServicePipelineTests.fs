module ServicePipelineTests

open System
open System.Threading
open System.Threading.Tasks
open Effinsty.Application
open Effinsty.Domain
open Xunit

type private FakeContactRepository() =
    interface IContactRepository with
        member _.ListAsync(_, _, _, _, _, _) = Task.FromResult([])
        member _.CountAsync(_, _, _, _) = Task.FromResult(0)
        member _.GetByIdAsync(_, _, _, _, _) = Task.FromResult(None)
        member _.ExistsByEmailAsync(_, _, _, _, _, _) = Task.FromResult(true)
        member _.CreateAsync(_, _, contact, _) = Task.FromResult(contact)
        member _.UpdateAsync(_, _, contact, _) = Task.FromResult(contact)
        member _.DeleteAsync(_, _, _, _, _) = Task.FromResult(false)

type private FakeUserRepository() =
    interface IUserRepository with
        member _.FindByUsernameAsync(_, _, _, _) = Task.FromResult(None)
        member _.FindByIdAsync(_, _, _, _) = Task.FromResult(None)

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

type private InactiveRefreshUserRepository(user: User) =
    interface IUserRepository with
        member _.FindByUsernameAsync(_, _, _, _) = Task.FromResult(None)
        member _.FindByIdAsync(_, _, _, _) = Task.FromResult(Some user)

type private CountingTokenProvider(payload: RefreshTokenPayload) =
    let mutable issueTokensCalls = 0

    member _.IssueTokensCalls = issueTokensCalls

    interface ITokenProvider with
        member _.IssueTokens(_, _) =
            issueTokensCalls <- issueTokensCalls + 1
            Error(UnexpectedError "IssueTokens should not be called for inactive users during refresh.")

        member _.ValidateRefreshToken(_) = Ok payload

type private TrackingSessionStore(session: SessionRecord) =
    let mutable deletedSessionIds: string list = []

    member _.DeletedSessionIds = deletedSessionIds

    interface ISessionStore with
        member _.SaveAsync(_, _) = Task.CompletedTask
        member _.GetAsync(_, _) = Task.FromResult(Some session)

        member _.DeleteAsync(sessionId, _) =
            deletedSessionIds <- sessionId :: deletedSessionIds
            Task.CompletedTask

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

        let! result = service.CreateAsync(tenant, "test-correlation-id", command, CancellationToken.None)

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
        let! result = service.LoginAsync(tenant, "test-correlation-id", command, CancellationToken.None)

        match result with
        | Ok _ -> Assert.Fail("Expected unauthorized")
        | Error (Unauthorized message) -> Assert.Contains("Invalid credentials", message)
        | Error _ -> Assert.Fail("Expected unauthorized error")
    }

[<Fact>]
let ``auth refresh rejects inactive user and revokes session`` () =
    task {
        let userId = UserId(Guid.NewGuid())
        let sessionId = Guid.NewGuid().ToString("N")
        let refreshToken = "refresh-token"
        let now = DateTimeOffset.UtcNow

        let inactiveUser =
            {
                Id = userId
                TenantId = tenant.TenantId
                Username = "disabled-user"
                Email = "disabled@example.com"
                PasswordHash = "hash"
                Active = false
                CreatedAt = now
                UpdatedAt = now
            }

        let payload =
            {
                UserId = userId
                TenantId = tenant.TenantId
                SessionId = sessionId
            }

        let session =
            {
                SessionId = sessionId
                UserId = userId
                TenantId = tenant.TenantId
                RefreshToken = refreshToken
                ExpiresAt = now.AddMinutes(10)
            }

        let tokenProvider = CountingTokenProvider(payload)
        let sessionStore = TrackingSessionStore(session)

        let service =
            AuthService(
                InactiveRefreshUserRepository(inactiveUser),
                FakePasswordHasher(),
                tokenProvider,
                sessionStore
            )
            :> IAuthService

        let! result = service.RefreshAsync(tenant, "test-correlation-id", { RefreshToken = refreshToken }, CancellationToken.None)

        match result with
        | Ok _ -> Assert.Fail("Expected forbidden error for inactive user refresh.")
        | Error (Forbidden message) ->
            Assert.Contains("disabled", message.ToLowerInvariant())
            Assert.Contains(sessionId, sessionStore.DeletedSessionIds)
            Assert.Equal(0, tokenProvider.IssueTokensCalls)
        | Error _ -> Assert.Fail("Expected forbidden error for inactive user refresh.")
    }

type private ActiveRefreshUserRepository(user: User) =
    interface IUserRepository with
        member _.FindByUsernameAsync(_, _, _, _) = Task.FromResult(None)
        member _.FindByIdAsync(_, _, _, _) = Task.FromResult(Some user)

type private RotationTokenProvider(
    oldRefreshToken: string,
    oldPayload: RefreshTokenPayload,
    issuedTokens: AuthToken,
    newPayload: RefreshTokenPayload
) =
    interface ITokenProvider with
        member _.IssueTokens(_, _) = Ok issuedTokens

        member _.ValidateRefreshToken(token) =
            if token = oldRefreshToken then
                Ok oldPayload
            elif token = issuedTokens.RefreshToken then
                Ok newPayload
            else
                Error(Unauthorized "Unexpected token in test.")

type private RetryingDeleteSessionStore(
    existingSession: SessionRecord,
    oldSessionId: string,
    oldDeleteFailuresBeforeSuccess: int,
    rollbackDeleteFailuresBeforeSuccess: int
) =
    let mutable oldDeleteAttempts = 0
    let mutable rollbackDeleteAttempts = 0
    let mutable successfulDeletes: string list = []
    let mutable savedSessionIds: string list = []

    member _.OldDeleteAttempts = oldDeleteAttempts
    member _.RollbackDeleteAttempts = rollbackDeleteAttempts
    member _.SuccessfulDeletes = successfulDeletes
    member _.SavedSessionIds = savedSessionIds

    interface ISessionStore with
        member _.SaveAsync(record, _) =
            savedSessionIds <- record.SessionId :: savedSessionIds
            Task.CompletedTask

        member _.GetAsync(sessionId, _) =
            if sessionId = oldSessionId then
                Task.FromResult(Some existingSession)
            else
                Task.FromResult(None)

        member _.DeleteAsync(sessionId, _) =
            if sessionId = oldSessionId then
                oldDeleteAttempts <- oldDeleteAttempts + 1

                if oldDeleteAttempts <= oldDeleteFailuresBeforeSuccess then
                    raise (InvalidOperationException($"Simulated old-session delete failure #{oldDeleteAttempts}."))
            elif savedSessionIds |> List.contains sessionId then
                rollbackDeleteAttempts <- rollbackDeleteAttempts + 1

                if rollbackDeleteAttempts <= rollbackDeleteFailuresBeforeSuccess then
                    raise (InvalidOperationException($"Simulated rollback delete failure #{rollbackDeleteAttempts}."))

            successfulDeletes <- sessionId :: successfulDeletes
            Task.CompletedTask

[<Fact>]
let ``auth refresh retries old session deletion and succeeds`` () =
    task {
        let now = DateTimeOffset.UtcNow
        let userId = UserId(Guid.NewGuid())
        let oldSessionId = Guid.NewGuid().ToString("N")
        let newSessionId = Guid.NewGuid().ToString("N")
        let incomingRefreshToken = "incoming-refresh-token"
        let issuedRefreshToken = "issued-refresh-token"

        let activeUser =
            {
                Id = userId
                TenantId = tenant.TenantId
                Username = "active-user"
                Email = "active@example.com"
                PasswordHash = "hash"
                Active = true
                CreatedAt = now
                UpdatedAt = now
            }

        let oldPayload =
            {
                UserId = userId
                TenantId = tenant.TenantId
                SessionId = oldSessionId
            }

        let newPayload =
            {
                UserId = userId
                TenantId = tenant.TenantId
                SessionId = newSessionId
            }

        let existingSession =
            {
                SessionId = oldSessionId
                UserId = userId
                TenantId = tenant.TenantId
                RefreshToken = incomingRefreshToken
                ExpiresAt = now.AddMinutes(10)
            }

        let issuedTokens =
            {
                AccessToken = "new-access-token"
                RefreshToken = issuedRefreshToken
                ExpiresAt = now.AddMinutes(15)
            }

        let tokenProvider = RotationTokenProvider(incomingRefreshToken, oldPayload, issuedTokens, newPayload)
        let sessionStore = RetryingDeleteSessionStore(existingSession, oldSessionId, 2, 0)

        let service =
            AuthService(
                ActiveRefreshUserRepository(activeUser),
                FakePasswordHasher(),
                tokenProvider,
                sessionStore
            )
            :> IAuthService

        let! result =
            service.RefreshAsync(tenant, "test-correlation-id", { RefreshToken = incomingRefreshToken }, CancellationToken.None)

        match result with
        | Ok refreshed ->
            Assert.Equal(issuedRefreshToken, refreshed.RefreshToken)
            Assert.Equal(3, sessionStore.OldDeleteAttempts)
            Assert.Equal(0, sessionStore.RollbackDeleteAttempts)
            Assert.True(sessionStore.SuccessfulDeletes |> List.contains oldSessionId)
            Assert.False(sessionStore.SuccessfulDeletes |> List.contains newSessionId)
        | Error err -> Assert.Fail($"Expected refresh success after retry, but got {err}.")
    }

[<Fact>]
let ``auth refresh revokes new session when old session deletion keeps failing`` () =
    task {
        let now = DateTimeOffset.UtcNow
        let userId = UserId(Guid.NewGuid())
        let oldSessionId = Guid.NewGuid().ToString("N")
        let newSessionId = Guid.NewGuid().ToString("N")
        let incomingRefreshToken = "incoming-refresh-token"
        let issuedRefreshToken = "issued-refresh-token"

        let activeUser =
            {
                Id = userId
                TenantId = tenant.TenantId
                Username = "active-user"
                Email = "active@example.com"
                PasswordHash = "hash"
                Active = true
                CreatedAt = now
                UpdatedAt = now
            }

        let oldPayload =
            {
                UserId = userId
                TenantId = tenant.TenantId
                SessionId = oldSessionId
            }

        let newPayload =
            {
                UserId = userId
                TenantId = tenant.TenantId
                SessionId = newSessionId
            }

        let existingSession =
            {
                SessionId = oldSessionId
                UserId = userId
                TenantId = tenant.TenantId
                RefreshToken = incomingRefreshToken
                ExpiresAt = now.AddMinutes(10)
            }

        let issuedTokens =
            {
                AccessToken = "new-access-token"
                RefreshToken = issuedRefreshToken
                ExpiresAt = now.AddMinutes(15)
            }

        let tokenProvider = RotationTokenProvider(incomingRefreshToken, oldPayload, issuedTokens, newPayload)
        let sessionStore = RetryingDeleteSessionStore(existingSession, oldSessionId, 10, 0)

        let service =
            AuthService(
                ActiveRefreshUserRepository(activeUser),
                FakePasswordHasher(),
                tokenProvider,
                sessionStore
            )
            :> IAuthService

        let! result =
            service.RefreshAsync(tenant, "test-correlation-id", { RefreshToken = incomingRefreshToken }, CancellationToken.None)

        match result with
        | Ok _ -> Assert.Fail("Expected InfrastructureError when old session deletion retries are exhausted.")
        | Error (InfrastructureError message) ->
            Assert.Contains("rotation failed", message.ToLowerInvariant())
            Assert.Equal(3, sessionStore.OldDeleteAttempts)
            Assert.Equal(1, sessionStore.RollbackDeleteAttempts)
            Assert.True(sessionStore.SuccessfulDeletes |> List.contains newSessionId)
        | Error _ -> Assert.Fail("Expected InfrastructureError when old-session deletion is not possible.")
    }
