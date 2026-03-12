namespace Effinsty.Infrastructure

open System
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open Dapper
open Effinsty.Application
open Effinsty.Domain

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

module private Mapping =
    let private parseGuid (value: string) =
        match Guid.TryParse(value) with
        | true, guid -> guid
        | _ -> Guid.Empty

    let private deserializeMetadata (value: string) =
        if String.IsNullOrWhiteSpace(value) then
            Map.empty
        else
            try
                JsonSerializer.Deserialize<Map<string, string>>(value)
            with _ ->
                Map.empty

    let toUser (row: UserRow) =
        {
            Id = UserId(parseGuid row.ID)
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
            Id = ContactId(parseGuid row.ID)
            TenantId = TenantId row.TENANT_ID
            UserId = UserId(parseGuid row.USER_ID)
            FirstName = row.FIRST_NAME
            LastName = row.LAST_NAME
            Email = if String.IsNullOrWhiteSpace(row.EMAIL) then None else Some row.EMAIL
            Phone = if String.IsNullOrWhiteSpace(row.PHONE) then None else Some row.PHONE
            Address = if String.IsNullOrWhiteSpace(row.ADDRESS) then None else Some row.ADDRESS
            Metadata = deserializeMetadata row.METADATA_JSON
            CreatedAt = row.CREATED_AT
            UpdatedAt = row.UPDATED_AT
        }

type OracleUserRepository(factory: IOracleConnectionFactory) =
    let schema tenant = TenantSchema.value tenant.Schema

    interface IUserRepository with
        member _.FindByUsernameAsync(tenant, username, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.userByUsername (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("username", username)

                let! row = conn.QuerySingleOrDefaultAsync<UserRow>(CommandDefinition(sql, parameters, cancellationToken = ct))

                return
                    if isNull (box row) then
                        None
                    else
                        Some(Mapping.toUser row)
            }

        member _.FindByIdAsync(tenant, userId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.userById (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("id", UserId.value userId |> string)

                let! row = conn.QuerySingleOrDefaultAsync<UserRow>(CommandDefinition(sql, parameters, cancellationToken = ct))

                return
                    if isNull (box row) then
                        None
                    else
                        Some(Mapping.toUser row)
            }

type OracleContactRepository(factory: IOracleConnectionFactory) =
    let schema tenant = TenantSchema.value tenant.Schema

    let serializeMetadata metadata = JsonSerializer.Serialize(metadata)

    interface IContactRepository with
        member _.ListAsync(tenant, userId, page, pageSize, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactsList (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("offset", (page - 1) * pageSize)
                parameters.Add("pageSize", pageSize)

                let! rows = conn.QueryAsync<ContactRow>(CommandDefinition(sql, parameters, cancellationToken = ct))
                return rows |> Seq.map Mapping.toContact |> List.ofSeq
            }

        member _.CountAsync(tenant, userId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactsCount (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                let! count = conn.ExecuteScalarAsync<int>(CommandDefinition(sql, parameters, cancellationToken = ct))
                return count
            }

        member _.GetByIdAsync(tenant, userId, contactId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactById (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("id", ContactId.value contactId |> string)

                let! row = conn.QuerySingleOrDefaultAsync<ContactRow>(CommandDefinition(sql, parameters, cancellationToken = ct))

                return
                    if isNull (box row) then
                        None
                    else
                        Some(Mapping.toContact row)
            }

        member _.ExistsByEmailAsync(tenant, userId, email, excludeId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactDuplicateEmail (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("email", email)

                match excludeId with
                | Some id -> parameters.Add("excludeId", ContactId.value id |> string)
                | None -> parameters.Add("excludeId", null)

                let! count = conn.ExecuteScalarAsync<int>(CommandDefinition(sql, parameters, cancellationToken = ct))
                return count > 0
            }

        member _.CreateAsync(tenant, contact, ct) =
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

                let! _ = conn.ExecuteAsync(CommandDefinition(sql, parameters, cancellationToken = ct))
                return contact
            }

        member _.UpdateAsync(tenant, contact, ct) =
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

                let! affected = conn.ExecuteAsync(CommandDefinition(sql, parameters, cancellationToken = ct))

                if affected = 0 then
                    return raise (InvalidOperationException("Contact update failed because no rows were affected."))
                else
                    return contact
            }

        member _.DeleteAsync(tenant, userId, contactId, ct) =
            task {
                use! conn = factory.CreateOpenConnectionAsync(tenant, ct)
                let sql = SqlTemplates.contactDelete (schema tenant)
                let parameters = DynamicParameters()
                parameters.Add("userId", UserId.value userId |> string)
                parameters.Add("id", ContactId.value contactId |> string)

                let! affected = conn.ExecuteAsync(CommandDefinition(sql, parameters, cancellationToken = ct))
                return affected > 0
            }
