namespace Effinsty.Infrastructure

open System.Diagnostics
open System.Runtime.ExceptionServices
open System.Threading.Tasks
open Effinsty.Domain
open Microsoft.Extensions.Logging

module DbLogging =
    let private rethrowPreservingStack<'T> (ex: exn) : 'T =
        ExceptionDispatchInfo.Capture(ex).Throw()
        Unchecked.defaultof<'T>

    let execQuery
        (logger: ILogger)
        (eventId: EventId)
        (tenant: TenantContext)
        (correlationId: string)
        (queryName: string)
        (paramCount: int)
        (work: unit -> Task<'T>)
        =
        task {
            let sw = Stopwatch.StartNew()

            try
                let! result = work ()
                sw.Stop()

                logger.LogDebug(
                    eventId,
                    "DB query OK. Query={Query} Tenant={Tenant} Schema={Schema} ParamCount={ParamCount} ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    queryName,
                    TenantId.value tenant.TenantId,
                    TenantSchema.value tenant.Schema,
                    paramCount,
                    sw.ElapsedMilliseconds,
                    correlationId
                )

                return result
            with ex ->
                sw.Stop()

                logger.LogError(
                    Events.DbQueryFailed,
                    ex,
                    "DB query FAILED. Query={Query} Tenant={Tenant} Schema={Schema} ParamCount={ParamCount} ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    queryName,
                    TenantId.value tenant.TenantId,
                    TenantSchema.value tenant.Schema,
                    paramCount,
                    sw.ElapsedMilliseconds,
                    correlationId
                )

                return rethrowPreservingStack ex
        }

    let execCommand
        (logger: ILogger)
        (eventId: EventId)
        (tenant: TenantContext)
        (correlationId: string)
        (commandName: string)
        (paramCount: int)
        (work: unit -> Task<int>)
        =
        task {
            let sw = Stopwatch.StartNew()

            try
                let! rowsAffected = work ()
                sw.Stop()
                let level = if rowsAffected = 0 then LogLevel.Warning else LogLevel.Information

                logger.Log(
                    level,
                    eventId,
                    "DB command done. Command={Command} Tenant={Tenant} Schema={Schema} ParamCount={ParamCount} RowsAffected={RowsAffected} ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    commandName,
                    TenantId.value tenant.TenantId,
                    TenantSchema.value tenant.Schema,
                    paramCount,
                    rowsAffected,
                    sw.ElapsedMilliseconds,
                    correlationId
                )

                return rowsAffected
            with ex ->
                sw.Stop()

                logger.LogError(
                    Events.DbCommandFailed,
                    ex,
                    "DB command FAILED. Command={Command} Tenant={Tenant} Schema={Schema} ParamCount={ParamCount} ElapsedMs={ElapsedMs} CorrelationId={CorrelationId}",
                    commandName,
                    TenantId.value tenant.TenantId,
                    TenantSchema.value tenant.Schema,
                    paramCount,
                    sw.ElapsedMilliseconds,
                    correlationId
                )

                return rethrowPreservingStack ex
        }
