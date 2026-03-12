namespace Effinsty.Application

open System
open System.Security.Cryptography
open System.Text
open System.Threading
open System.Threading.Tasks
open Effinsty.Domain

module private Helpers =
    let userOwnsContact (userId: UserId) (contact: Contact) =
        contact.UserId = userId

    let fixedTimeEquals (left: string) (right: string) =
        if isNull left || isNull right then
            false
        else
            let leftBytes = Encoding.UTF8.GetBytes(left)
            let rightBytes = Encoding.UTF8.GetBytes(right)
            CryptographicOperations.FixedTimeEquals(leftBytes, rightBytes)

    let formatException (ex: exn) =
        $"{ex.GetType().Name}: {ex.Message}"

    let deleteSessionWithRetry (sessionStore: ISessionStore) (sessionId: string) (ct: CancellationToken) =
        let maxAttempts = 3
        let retryDelay: TimeSpan = TimeSpan.FromMilliseconds(50.0)

        let rec attemptDelete attempt =
            task {
                try
                    do! sessionStore.DeleteAsync(sessionId, ct)
                    return Ok()
                with
                | :? OperationCanceledException as ex ->
                    return raise ex
                | ex when attempt < maxAttempts ->
                    do! Task.Delay(retryDelay, ct)
                    return! attemptDelete (attempt + 1)
                | ex ->
                    return Error ex
            }

        attemptDelete 1

type ContactService(repository: IContactRepository) =
    interface IContactService with
        member _.ListAsync(tenant, correlationId, userId, page, pageSize, ct) =
            task {
                let safePage = if page <= 0 then 1 else page
                let safePageSize = if pageSize <= 0 then 20 elif pageSize > 100 then 100 else pageSize

                let! items = repository.ListAsync(tenant, correlationId, userId, safePage, safePageSize, ct)
                let! total = repository.CountAsync(tenant, correlationId, userId, ct)

                return
                    Ok {
                        Items = items
                        Page = safePage
                        PageSize = safePageSize
                        TotalCount = total
                    }
            }

        member _.GetAsync(tenant, correlationId, userId, contactId, ct) =
            task {
                let! found = repository.GetByIdAsync(tenant, correlationId, userId, contactId, ct)

                return
                    match found with
                    | Some contact when Helpers.userOwnsContact userId contact -> Ok contact
                    | Some _ -> Error(Forbidden "Access to contact denied.")
                    | None -> Error(NotFound "Contact was not found.")
            }

        member _.CreateAsync(tenant, correlationId, command, ct) =
            task {
                match Validation.validateContactDraft command.FirstName command.LastName command.Email command.Phone command.Address command.Metadata with
                | Error err -> return Error err
                | Ok draft ->
                    match draft.Email with
                    | Some email ->
                        let! exists = repository.ExistsByEmailAsync(tenant, correlationId, command.UserId, email, None, ct)

                        if exists then
                            return Error(Conflict "A contact with this email already exists.")
                        else
                            let now = DateTimeOffset.UtcNow

                            let newContact = {
                                Id = ContactId(Guid.NewGuid())
                                TenantId = tenant.TenantId
                                UserId = command.UserId
                                FirstName = draft.FirstName
                                LastName = draft.LastName
                                Email = draft.Email
                                Phone = draft.Phone
                                Address = draft.Address
                                Metadata = draft.Metadata
                                CreatedAt = now
                                UpdatedAt = now
                            }

                            let! created = repository.CreateAsync(tenant, correlationId, newContact, ct)
                            return Ok created
                    | None ->
                        let now = DateTimeOffset.UtcNow

                        let newContact = {
                            Id = ContactId(Guid.NewGuid())
                            TenantId = tenant.TenantId
                            UserId = command.UserId
                            FirstName = draft.FirstName
                            LastName = draft.LastName
                            Email = None
                            Phone = draft.Phone
                            Address = draft.Address
                            Metadata = draft.Metadata
                            CreatedAt = now
                            UpdatedAt = now
                        }

                        let! created = repository.CreateAsync(tenant, correlationId, newContact, ct)
                        return Ok created
            }

        member _.UpdateAsync(tenant, correlationId, command, ct) =
            task {
                let! existing = repository.GetByIdAsync(tenant, correlationId, command.UserId, command.ContactId, ct)

                match existing with
                | None -> return Error(NotFound "Contact was not found.")
                | Some contact ->
                    let firstName = command.FirstName |> Option.defaultValue contact.FirstName
                    let lastName = command.LastName |> Option.defaultValue contact.LastName
                    let email = if command.Email.IsSome then command.Email else contact.Email
                    let phone = if command.Phone.IsSome then command.Phone else contact.Phone
                    let address = if command.Address.IsSome then command.Address else contact.Address
                    let metadata = command.Metadata |> Option.defaultValue contact.Metadata

                    match Validation.validateContactDraft firstName lastName email phone address metadata with
                    | Error err -> return Error err
                    | Ok draft ->
                        match draft.Email with
                        | Some normalizedEmail ->
                            let! duplicate =
                                repository.ExistsByEmailAsync(tenant, correlationId, command.UserId, normalizedEmail, Some command.ContactId, ct)

                            if duplicate then
                                return Error(Conflict "A contact with this email already exists.")
                            else
                                let updated = {
                                    contact with
                                        FirstName = draft.FirstName
                                        LastName = draft.LastName
                                        Email = draft.Email
                                        Phone = draft.Phone
                                        Address = draft.Address
                                        Metadata = draft.Metadata
                                        UpdatedAt = DateTimeOffset.UtcNow
                                }

                                let! saved = repository.UpdateAsync(tenant, correlationId, updated, ct)
                                return Ok saved
                        | None ->
                            let updated = {
                                contact with
                                    FirstName = draft.FirstName
                                    LastName = draft.LastName
                                    Email = None
                                    Phone = draft.Phone
                                    Address = draft.Address
                                    Metadata = draft.Metadata
                                    UpdatedAt = DateTimeOffset.UtcNow
                            }

                            let! saved = repository.UpdateAsync(tenant, correlationId, updated, ct)
                            return Ok saved
            }

        member _.DeleteAsync(tenant, correlationId, userId, contactId, ct) =
            task {
                let! deleted = repository.DeleteAsync(tenant, correlationId, userId, contactId, ct)

                if deleted then
                    return Ok()
                else
                    return Error(NotFound "Contact was not found.")
            }

type AuthService(
    userRepository: IUserRepository,
    passwordHasher: IPasswordHasher,
    tokenProvider: ITokenProvider,
    sessionStore: ISessionStore
) =
    interface IAuthService with
        member _.LoginAsync(tenant, correlationId, command, ct) =
            task {
                let username =
                    if String.IsNullOrWhiteSpace(command.Username) then
                        String.Empty
                    else
                        command.Username.Trim().ToLowerInvariant()

                if String.IsNullOrWhiteSpace(username) || String.IsNullOrWhiteSpace(command.Password) then
                    return Error(ValidationError [ "Username and password are required." ])
                else
                    let! found = userRepository.FindByUsernameAsync(tenant, correlationId, username, ct)

                    match found with
                    | None -> return Error(Unauthorized "Invalid credentials.")
                    | Some user when not user.Active -> return Error(Forbidden "User account is disabled.")
                    | Some user when not (passwordHasher.Verify(command.Password, user.PasswordHash)) ->
                        return Error(Unauthorized "Invalid credentials.")
                    | Some user ->
                        match tokenProvider.IssueTokens(user, tenant) with
                        | Error err -> return Error err
                        | Ok tokens ->
                            match tokenProvider.ValidateRefreshToken(tokens.RefreshToken) with
                            | Error err -> return Error err
                            | Ok payload ->
                                let session = {
                                    SessionId = payload.SessionId
                                    UserId = user.Id
                                    TenantId = tenant.TenantId
                                    RefreshToken = tokens.RefreshToken
                                    ExpiresAt = tokens.ExpiresAt
                                }

                                do! sessionStore.SaveAsync(session, ct)
                                return Ok tokens
            }

        member _.RefreshAsync(tenant, correlationId, command, ct) =
            task {
                if String.IsNullOrWhiteSpace(command.RefreshToken) then
                    return Error(ValidationError [ "RefreshToken is required." ])
                else
                    match tokenProvider.ValidateRefreshToken(command.RefreshToken) with
                    | Error err -> return Error err
                    | Ok payload when payload.TenantId <> tenant.TenantId ->
                        return Error(Forbidden "Refresh token does not belong to this tenant.")
                    | Ok payload ->
                        let! session = sessionStore.GetAsync(payload.SessionId, ct)

                        match session with
                        | None -> return Error(Unauthorized "Session not found.")
                        | Some stored when not (Helpers.fixedTimeEquals stored.RefreshToken command.RefreshToken) ->
                            return Error(Unauthorized "Session token mismatch.")
                        | Some stored when stored.ExpiresAt <= DateTimeOffset.UtcNow ->
                            do! sessionStore.DeleteAsync(stored.SessionId, ct)
                            return Error(Unauthorized "Session is expired.")
                        | Some _ ->
                            let! user = userRepository.FindByIdAsync(tenant, correlationId, payload.UserId, ct)

                            match user with
                            | None -> return Error(Unauthorized "User not found for this session.")
                            | Some foundUser when not foundUser.Active ->
                                do! sessionStore.DeleteAsync(payload.SessionId, ct)
                                return Error(Forbidden "User account is disabled.")
                            | Some foundUser ->
                                match tokenProvider.IssueTokens(foundUser, tenant) with
                                | Error err -> return Error err
                                | Ok tokens ->
                                    match tokenProvider.ValidateRefreshToken(tokens.RefreshToken) with
                                    | Error err -> return Error err
                                    | Ok newPayload ->
                                        let newSession = {
                                            SessionId = newPayload.SessionId
                                            UserId = foundUser.Id
                                            TenantId = tenant.TenantId
                                            RefreshToken = tokens.RefreshToken
                                            ExpiresAt = tokens.ExpiresAt
                                        }

                                        do! sessionStore.SaveAsync(newSession, ct)
                                        let! oldSessionDeleteResult = Helpers.deleteSessionWithRetry sessionStore payload.SessionId ct

                                        match oldSessionDeleteResult with
                                        | Ok () -> return Ok tokens
                                        | Error oldSessionDeleteError ->
                                            let! rollbackResult = Helpers.deleteSessionWithRetry sessionStore newSession.SessionId ct
                                            let tenantId = TenantId.value tenant.TenantId
                                            let oldDeleteDetail = Helpers.formatException oldSessionDeleteError

                                            match rollbackResult with
                                            | Ok () ->
                                                return
                                                    Error(
                                                        InfrastructureError(
                                                            $"Refresh token rotation failed for tenant '{tenantId}' while deleting old session '{payload.SessionId}' ({oldDeleteDetail}). New session '{newSession.SessionId}' was revoked to prevent dual-valid tokens."
                                                        )
                                                    )
                                            | Error rollbackError ->
                                                let rollbackDetail = Helpers.formatException rollbackError

                                                return
                                                    Error(
                                                        InfrastructureError(
                                                            $"Refresh token rotation failed for tenant '{tenantId}'. Old session '{payload.SessionId}' deletion failed ({oldDeleteDetail}) and rollback deletion for new session '{newSession.SessionId}' also failed ({rollbackDetail})."
                                                        )
                                                    )
            }

        member _.LogoutAsync(tenant, _correlationId, command, ct) =
            task {
                match tokenProvider.ValidateRefreshToken(command.RefreshToken) with
                | Error _ -> return Ok()
                | Ok payload when payload.TenantId <> tenant.TenantId ->
                    return Error(Forbidden "Session does not belong to this tenant.")
                | Ok payload ->
                    do! sessionStore.DeleteAsync(payload.SessionId, ct)
                    return Ok()
            }
