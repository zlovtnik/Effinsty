namespace Effinsty.Infrastructure

module SqlTemplates =
    let userByUsername (schema: string) =
        $"SELECT ID, TENANT_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE, CREATED_AT, UPDATED_AT FROM {schema}.USERS WHERE USERNAME = :username"

    let userById (schema: string) =
        $"SELECT ID, TENANT_ID, USERNAME, EMAIL, PASSWORD_HASH, IS_ACTIVE, CREATED_AT, UPDATED_AT FROM {schema}.USERS WHERE ID = :id"

    let contactsList (schema: string) =
        $"SELECT ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, CREATED_AT, UPDATED_AT FROM {schema}.CONTACTS WHERE USER_ID = :userId ORDER BY UPDATED_AT DESC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY"

    let contactsCount (schema: string) =
        $"SELECT COUNT(1) FROM {schema}.CONTACTS WHERE USER_ID = :userId"

    let contactById (schema: string) =
        $"SELECT ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, CREATED_AT, UPDATED_AT FROM {schema}.CONTACTS WHERE USER_ID = :userId AND ID = :id"

    let contactDuplicateEmail (schema: string) =
        $"SELECT COUNT(1) FROM {schema}.CONTACTS WHERE USER_ID = :userId AND EMAIL = :email AND (:excludeId IS NULL OR ID <> :excludeId)"

    let contactInsert (schema: string) =
        $"INSERT INTO {schema}.CONTACTS (ID, TENANT_ID, USER_ID, FIRST_NAME, LAST_NAME, EMAIL, PHONE, ADDRESS, METADATA_JSON, CREATED_AT, UPDATED_AT) VALUES (:id, :tenantId, :userId, :firstName, :lastName, :email, :phone, :address, :metadataJson, :createdAt, :updatedAt)"

    let contactUpdate (schema: string) =
        $"UPDATE {schema}.CONTACTS SET FIRST_NAME = :firstName, LAST_NAME = :lastName, EMAIL = :email, PHONE = :phone, ADDRESS = :address, METADATA_JSON = :metadataJson, UPDATED_AT = :updatedAt WHERE USER_ID = :userId AND ID = :id"

    let contactDelete (schema: string) =
        $"DELETE FROM {schema}.CONTACTS WHERE USER_ID = :userId AND ID = :id"
