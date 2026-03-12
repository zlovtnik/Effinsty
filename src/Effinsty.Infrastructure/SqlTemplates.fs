namespace Effinsty.Infrastructure

open System
open System.Text.RegularExpressions

module SqlTemplates =
    let private schemaRegex = Regex("^[A-Za-z_][A-Za-z0-9_]*$", RegexOptions.Compiled)

    let private validateSchema (schema: string) =
        if String.IsNullOrWhiteSpace(schema) then
            raise (ArgumentException("Schema cannot be null or whitespace.", nameof schema))

        let trimmed = schema.Trim()

        if schemaRegex.IsMatch(trimmed) then
            trimmed
        else
            raise (ArgumentException("Schema contains invalid characters. Expected identifier pattern ^[A-Za-z_][A-Za-z0-9_]*$.", nameof schema))

    let userByUsername (schema: string) =
        let s = validateSchema schema
        $"SELECT ID, TENANT_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE, CREATED_AT, UPDATED_AT FROM {s}.USERS WHERE USERNAME = :username"

    let userById (schema: string) =
        let s = validateSchema schema
        $"SELECT ID, TENANT_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE, CREATED_AT, UPDATED_AT FROM {s}.USERS WHERE ID = :id"

    let contactsList (schema: string) =
        let s = validateSchema schema
        $"SELECT ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, CREATED_AT, UPDATED_AT FROM {s}.CONTACTS WHERE USER_ID = :userId ORDER BY UPDATED_AT DESC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY"

    let contactsCount (schema: string) =
        let s = validateSchema schema
        $"SELECT COUNT(1) FROM {s}.CONTACTS WHERE USER_ID = :userId"

    let contactById (schema: string) =
        let s = validateSchema schema
        $"SELECT ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, CREATED_AT, UPDATED_AT FROM {s}.CONTACTS WHERE USER_ID = :userId AND ID = :id"

    let contactDuplicateEmail (schema: string) =
        let s = validateSchema schema
        $"SELECT COUNT(1) FROM {s}.CONTACTS WHERE USER_ID = :userId AND EMAIL = :email AND (:excludeId IS NULL OR ID <> :excludeId)"

    let contactInsert (schema: string) =
        let s = validateSchema schema
        $"INSERT INTO {s}.CONTACTS (ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, CREATED_AT, UPDATED_AT) VALUES (:id, :tenantId, :userId, :firstName, :lastName, :email, :phone, :address, :metadataJson, :createdAt, :updatedAt)"

    let contactUpdate (schema: string) =
        let s = validateSchema schema
        $"UPDATE {s}.CONTACTS SET FIRST_NAME = :firstName, LAST_NAME = :lastName, EMAIL = :email, PHONE = :phone, ADDRESS = :address, METADATA_JSON = :metadataJson, UPDATED_AT = :updatedAt WHERE USER_ID = :userId AND ID = :id"

    let contactDelete (schema: string) =
        let s = validateSchema schema
        $"DELETE FROM {s}.CONTACTS WHERE USER_ID = :userId AND ID = :id"
