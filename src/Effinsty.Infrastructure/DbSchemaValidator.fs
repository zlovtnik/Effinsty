namespace Effinsty.Infrastructure

open System.Collections.Generic
open System.Data
open System.Threading
open Dapper

module DbSchemaValidator =
    let private requiredTables = [| "USERS"; "CONTACTS"; "SESSIONS" |]
    let private requiredIndexes = [| "IX_CONTACTS_USER_UPDATED"; "IX_CONTACTS_USER_EMAIL" |]
    let private requiredTriggers = [| "TRG_USERS_UPDATED_AT"; "TRG_CONTACTS_UPDATED_AT" |]
    let private requiredFks = [| "FK_CONTACTS_USERS"; "FK_SESSIONS_USERS" |]

    let validateSchema (conn: IDbConnection) (schema: string) (ct: CancellationToken) =
        task {
            let upper = schema.ToUpperInvariant()
            let missing = ResizeArray<string>()

            for tableName in requiredTables do
                let! count =
                    conn.ExecuteScalarAsync<int>(
                        CommandDefinition(
                            "SELECT COUNT(1) FROM ALL_TABLES WHERE TABLE_NAME=:name AND OWNER=:owner",
                            {| name = tableName
                               owner = upper |},
                            cancellationToken = ct
                        )
                    )

                if count = 0 then
                    missing.Add($"TABLE {upper}.{tableName}")

            for indexName in requiredIndexes do
                let! count =
                    conn.ExecuteScalarAsync<int>(
                        CommandDefinition(
                            "SELECT COUNT(1) FROM ALL_INDEXES WHERE INDEX_NAME=:name AND TABLE_OWNER=:owner",
                            {| name = indexName
                               owner = upper |},
                            cancellationToken = ct
                        )
                    )

                if count = 0 then
                    missing.Add($"INDEX {upper}.{indexName}")

            for triggerName in requiredTriggers do
                let! count =
                    conn.ExecuteScalarAsync<int>(
                        CommandDefinition(
                            "SELECT COUNT(1) FROM ALL_TRIGGERS WHERE TRIGGER_NAME=:name AND OWNER=:owner",
                            {| name = triggerName
                               owner = upper |},
                            cancellationToken = ct
                        )
                    )

                if count = 0 then
                    missing.Add($"TRIGGER {upper}.{triggerName}")

            for fkName in requiredFks do
                let! count =
                    conn.ExecuteScalarAsync<int>(
                        CommandDefinition(
                            "SELECT COUNT(1) FROM ALL_CONSTRAINTS WHERE CONSTRAINT_NAME=:name AND OWNER=:owner",
                            {| name = fkName
                               owner = upper |},
                            cancellationToken = ct
                        )
                    )

                if count = 0 then
                    missing.Add($"FK {upper}.{fkName}")

            return List.ofSeq missing
        }
