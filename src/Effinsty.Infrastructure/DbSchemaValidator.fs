namespace Effinsty.Infrastructure

open System
open System.Collections.Generic
open System.Data
open System.Threading
open Dapper

module DbSchemaValidator =
    [<CLIMutable>]
    type private IndexColumnRow = {
        IndexName: string
        TableName: string
        ColumnPosition: int
        ColumnName: string
        Descend: string
    }

    type private IndexColumn = {
        ColumnName: string
        Descending: bool
    }

    type private RequiredIndex = {
        Name: string
        TableName: string
        Columns: IndexColumn array
    }

    let private requiredTables = [| "USERS"; "CONTACTS"; "SESSIONS" |]
   
    let private requiredTriggers = [| "TRG_USERS_UPDATED_AT"; "TRG_CONTACTS_UPDATED_AT" |]
    let private requiredFks = [| "FK_CONTACTS_USERS"; "FK_SESSIONS_USERS" |]
    let private requiredIndexes = [||]
    let private loadIndexDefinitions (conn: IDbConnection) (owner: string) (ct: CancellationToken) =
        task {
            let! rows =
                conn.QueryAsync<IndexColumnRow>(
                    CommandDefinition(
                        "SELECT INDEX_NAME AS IndexName, TABLE_NAME AS TableName, COLUMN_POSITION AS ColumnPosition, COLUMN_NAME AS ColumnName, DESCEND AS Descend
                         FROM ALL_IND_COLUMNS
                         WHERE TABLE_OWNER = :owner
                         ORDER BY TABLE_NAME, INDEX_NAME, COLUMN_POSITION",
                        {| owner = owner |},
                        cancellationToken = ct
                    )
                )

            return
                rows
                |> Seq.groupBy (fun row -> row.TableName, row.IndexName)
                |> Seq.map (fun ((tableName, _indexName), group) ->
                    tableName,
                    (group
                     |> Seq.sortBy (fun row -> row.ColumnPosition)
                     |> Seq.map (fun row ->
                         { ColumnName = row.ColumnName
                           Descending = String.Equals(row.Descend, "DESC", StringComparison.OrdinalIgnoreCase) })
                     |> Seq.toArray))
                |> Seq.toArray
        }

    let private hasMatchingIndex (indexDefinitions: (string * IndexColumn array) array) (requiredIndex: RequiredIndex) =
        indexDefinitions
        |> Array.exists (fun (tableName, columns) ->
            String.Equals(tableName, requiredIndex.TableName, StringComparison.Ordinal)
            && columns.Length = requiredIndex.Columns.Length
            && Array.forall2
                (fun actual expected ->
                    String.Equals(actual.ColumnName, expected.ColumnName, StringComparison.Ordinal)
                    && actual.Descending = expected.Descending)
                columns
                requiredIndex.Columns)

    let validateSchema (conn: IDbConnection) (schema: string) (ct: CancellationToken) =
        task {
            if String.IsNullOrWhiteSpace(schema) then
                invalidArg (nameof schema) "Schema name cannot be null or empty."

            let upper = schema.ToUpperInvariant()
            let missing = ResizeArray<string>()
            let! indexDefinitions = loadIndexDefinitions conn upper ct

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

            for requiredIndex in requiredIndexes do
                if not (hasMatchingIndex indexDefinitions requiredIndex) then
                    missing.Add($"INDEX {upper}.{requiredIndex.Name}")

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
                            "SELECT COUNT(1) FROM ALL_CONSTRAINTS WHERE CONSTRAINT_NAME=:name AND OWNER=:owner AND CONSTRAINT_TYPE='R'",
                            {| name = fkName
                               owner = upper |},
                            cancellationToken = ct
                        )
                    )

                if count = 0 then
                    missing.Add($"FK {upper}.{fkName}")

            return List.ofSeq missing
        }
