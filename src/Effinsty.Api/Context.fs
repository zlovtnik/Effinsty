namespace Effinsty.Api

open System
open System.Security.Claims
open Effinsty.Domain
open Microsoft.AspNetCore.Http

[<AutoOpen>]
module Context =
    let [<Literal>] CorrelationIdKey = "effinsty.correlationId"
    let [<Literal>] TenantContextKey = "effinsty.tenantContext"

    let setCorrelationId (ctx: HttpContext) (correlationId: string) =
        ctx.Items[CorrelationIdKey] <- correlationId

    let tryGetCorrelationId (ctx: HttpContext) =
        match ctx.Items.TryGetValue(CorrelationIdKey) with
        | true, value when not (isNull value) -> Some(string value)
        | _ -> None

    let setTenantContext (ctx: HttpContext) (tenant: TenantContext) =
        ctx.Items[TenantContextKey] <- tenant

    let tryGetTenantContext (ctx: HttpContext) =
        match ctx.Items.TryGetValue(TenantContextKey) with
        | true, (:? TenantContext as tenant) -> Some tenant
        | _ -> None

    let tryGetUserId (ctx: HttpContext) =
        let claim = ctx.User.FindFirst(ClaimTypes.NameIdentifier)

        if isNull claim then
            None
        else
            match Guid.TryParse(claim.Value) with
            | true, guid -> Some(UserId guid)
            | _ -> None
