namespace Effinsty.Infrastructure

open System
open System.Text.Json
open System.Threading
open Dapper
open Effinsty.Application
open Effinsty.Domain
open Microsoft.Extensions.Logging

[<CLIMutable>]
type private UserRow = {
    ID: string
    TENANT_ID: string
    USERNAME: string
    EMAIL: string
    PASSWORD_HASH: string
    IS_ACTIVE: decimal
    CREATED_AT: DateTimeOffset
    UPDATED_AT: DateTimeOffset
}

[<CLIMutable>]
type private ContactRow = {
    ID: string
    TENANT_ID: string
    USER_ID: string
    FIRST_NAME: string
    LAST_NAME: string
    EMAIL: string
    PHONE: string
    ADDRESS: string
    METADATA_JSON: string
    CREATED_AT: DateTimeOffset
    UPDATED_AT: DateTimeOffset
}

module internal RepositoryMetadata =
    let deserializeContactMetadata (contactId: string) (userId: string) (value: string) =
        if String.IsNullOrWhiteSpace(value) then
            Map.empty
        else
            try
                let metadata = JsonSerializer.Deserialize<Map<string, string>>(value)

                if isNull (box metadata) then
                    raise (InvalidOperationException("CONTACTS.METADATA_JSON deserialized to null."))

                metadata
            with :? JsonException as ex ->
                let payloadLength = value.Length

                raise (
                    InvalidOperationException(
                        $"Invalid CONTACTS.METADATA_JSON for CONTACTS.ID='{contactId}', CONTACTS.USER_ID='{userId}', PayloadLength={payloadLength}.",
                        ex
                    )
                )

module private Mapping =
    let private parseGuid (fieldName: string) (value: string) =
        if String.IsNullOrWhiteSpace(value) then
            raise (InvalidOperationException($"{fieldName} cannot be null or empty."))

        match Guid.TryParse(value) with
        | true, guid -> guid
        | _ -> raise (InvalidOperationException($"Unable to parse GUID for field '{fieldName}' with value '{value}'."))

    let toUser (row: UserRow) =
        {
            Id = UserId(parseGuid "USERS.ID" row.ID)
            TenantId = TenantId row.TENANT_ID
            Username = row.USERNAME
            Email = row.EMAIL
            PasswordHash = row.PASSWORD_HASH
            Active = row.IS_ACTIVE > 0m
            CreatedAt = row.CREATED_AT
            UpdatedAt = row.UPDATED_AT
        }

    let toContact (row: ContactRow) =
        {
            Id = ContactId(parseGuid "CONTACTS.ID" row.ID)
            TenantId = TenantId row.TENANT_ID
            UserId = UserId(parseGuid "CONTACTS.USER_ID" row.USER_ID)
            FirstName = row.FIRST_NAME
            LastName = row.LAST_NAME
            Email = if String.IsNullOrWhiteSpace(row.EMAIL) then None else Some row.EMAIL
            Phone = if String.IsNullOrWhiteSpace(row.PHONE) then None else Some row.PHONE
            Address = if String.IsNullOrWhiteSpace(row.ADDRESS) then None else Some row.ADDRESS
            Metadata = RepositoryMetadata.deserializeContactMetadata row.ID row.USER_ID row.METADATA_JSON
            CreatedAt = row.CREATED_AT
            UpdatedAt = row.UPDATED_AT
        }

type OracleUserRepository(factory: IOracleConnectionFactory, logger: ILogger<OracleUserRepository>) =
    let schema tenant = TenantSchema.value tenant.Schema

    interface IUserRepository with
        member _.FindByUsernameAsync(tenant, correlationId, username, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.userByUsername (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("username", username)

                let! row =
                    DbLogging.execQuery
                        logger
                        Events.DbQueryUsers
                        tenant
                        (CorrelationId.value correlationId)
                        "users.findByUsername"
                        1
                        (fun () -> conn.QuerySingleOrDefaultAsync<UserRow>(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return
                    if isNull (box row) then
                        None
                    else
                        Some(Mapping.toUser row)
            }

        member _.FindByIdAsync(tenant, correlationId, userId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.userById (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("id", UserId.value userId |> string)

                let! row =
                    DbLogging.execQuery
                        logger
                        Events.DbQueryUsers
                        tenant
                        (CorrelationId.value correlationId)
                        "users.findById"
                        1
                        (fun () -> conn.QuerySingleOrDefaultAsync<UserRow>(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return
                    if isNull (box row) then
                        None
                    else
                        Some(Mapping.toUser row)
            }

type OracleContactRepository(factory: IOracleConnectionFactory, logger: ILogger<OracleContactRepository>) =
    let schema tenant = TenantSchema.value tenant.Schema

    let serializeMetadata metadata = JsonSerializer.Serialize(metadata)

    interface IContactRepository with
        member _.ListAsync(tenant, correlationId, userId, page, pageSize, ct) =
            task {
                if page <= 0 then
                    raise (ArgumentOutOfRangeException("page", page, "Parameter 'page' must be greater than zero."))

                if pageSize <= 0 then
                    raise (ArgumentOutOfRangeException("pageSize", pageSize, "Parameter 'pageSize' must be greater than zero."))

                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactsList (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("offset", (page - 1) * pageSize)
                parameters.Add("pageSize", pageSize)

                let! rows =
                    DbLogging.execQuery
                        logger
                        Events.DbQueryContacts
                        tenant
                        correlationId
                        "contacts.list"
                        3
                        (fun () -> conn.QueryAsync<ContactRow>(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return rows |> Seq.map Mapping.toContact |> List.ofSeq
            }

        member _.CountAsync(tenant, correlationId, userId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactsCount (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)

                let! count =
                    DbLogging.execQuery
                        logger
                        Events.DbQueryContacts
                        tenant
                        correlationId
                        "contacts.count"
                        1
                        (fun () -> conn.ExecuteScalarAsync<int>(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return count
            }

        member _.GetByIdAsync(tenant, correlationId, userId, contactId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactById (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("id", ContactId.value contactId |> string)

                let! row =
                    DbLogging.execQuery
                        logger
                        Events.DbQueryContacts
                        tenant
                        correlationId
                        "contacts.getById"
                        2
                        (fun () -> conn.QuerySingleOrDefaultAsync<ContactRow>(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return
                    if isNull (box row) then
                        None
                    else
                        Some(Mapping.toContact row)
            }

        member _.ExistsByEmailAsync(tenant, correlationId, userId, email, excludeId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactDuplicateEmail (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("email", email)

                match excludeId with
                | Some id -> parameters.Add("excludeId", ContactId.value id |> string)
                | None -> parameters.Add("excludeId", null)

                let! count =
                    DbLogging.execQuery
                        logger
                        Events.DbQueryContacts
                        tenant
                        correlationId
                        "contacts.existsByEmail"
                        3
                        (fun () -> conn.ExecuteScalarAsync<int>(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return count > 0
            }

        member _.CreateAsync(tenant, correlationId, contact, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactInsert (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("id", ContactId.value contact.Id |> string)
                parameters.Add("tenantId", TenantId.value contact.TenantId)
                parameters.Add("userId", UserId.value contact.UserId |> string)
                parameters.Add("firstName", contact.FirstName)
                parameters.Add("lastName", contact.LastName)
                parameters.Add("email", contact.Email |> Option.toObj)
                parameters.Add("phone", contact.Phone |> Option.toObj)
                parameters.Add("address", contact.Address |> Option.toObj)
                parameters.Add("metadataJson", serializeMetadata contact.Metadata)
                parameters.Add("createdAt", contact.CreatedAt.UtcDateTime)
                parameters.Add("updatedAt", contact.UpdatedAt.UtcDateTime)

                let! _ =
                    DbLogging.execCommand
                        logger
                        Events.DbCommandContact
                        tenant
                        correlationId
                        "contacts.create"
                        11
                        (fun () -> conn.ExecuteAsync(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return contact
            }

        member _.UpdateAsync(tenant, correlationId, contact, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactUpdate (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("id", ContactId.value contact.Id |> string)
                parameters.Add("userId", UserId.value contact.UserId |> string)
                parameters.Add("firstName", contact.FirstName)
                parameters.Add("lastName", contact.LastName)
                parameters.Add("email", contact.Email |> Option.toObj)
                parameters.Add("phone", contact.Phone |> Option.toObj)
                parameters.Add("address", contact.Address |> Option.toObj)
                parameters.Add("metadataJson", serializeMetadata contact.Metadata)
                parameters.Add("updatedAt", contact.UpdatedAt.UtcDateTime)

                let! affected =
                    DbLogging.execCommand
                        logger
                        Events.DbCommandContact
                        tenant
                        correlationId
                        "contacts.update"
                        9
                        (fun () -> conn.ExecuteAsync(CommandDefinition(sql, parameters, cancellationToken = ct)))

                if affected = 0 then
                    return raise (InvalidOperationException("Contact update failed because no rows were affected."))
                else
                    return contact
            }

        member _.DeleteAsync(tenant, correlationId, userId, contactId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactDelete (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("id", ContactId.value contactId |> string)

                let! affected =
                    DbLogging.execCommand
                        logger
                        Events.DbCommandContact
                        tenant
                        correlationId
                        "contacts.delete"
                        2
                        (fun () -> conn.ExecuteAsync(CommandDefinition(sql, parameters, cancellationToken = ct)))

                return affected > 0
            }
