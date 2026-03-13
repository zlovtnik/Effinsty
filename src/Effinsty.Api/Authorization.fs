namespace Effinsty.Api

open System
open System.Security.Claims
open Effinsty.Api.Context
open Giraffe
open Microsoft.AspNetCore.Http

module ScopeAuthorization =
    let private splitScopes (value: string) =
        value.Split([| ' '; ',' |], StringSplitOptions.RemoveEmptyEntries ||| StringSplitOptions.TrimEntries)

    let private normalizeRequiredScopes (scopes: string list) =
        scopes
        |> List.map (fun scope -> scope.Trim())
        |> List.filter (String.IsNullOrWhiteSpace >> not)
        |> Set.ofList

    let private userScopes (ctx: HttpContext) =
        ctx.User.Claims
        |> Seq.filter (fun claim -> claim.Type = "scope" || claim.Type = "scp" || claim.Type = ClaimTypes.Role)
        |> Seq.collect (fun claim -> splitScopes claim.Value)
        |> Set.ofSeq

    let private forbidden (requiredScopes: Set<string>) : HttpHandler =
        fun _ ctx ->
            task {
                let correlationId = tryGetCorrelationId ctx |> Option.defaultValue String.Empty
                let requiredScopeText = String.Join(" or ", requiredScopes)

                let payload: ErrorResponse =
                    {
                        Code = "forbidden"
                        Message = "Insufficient scope."
                        Details = [ $"Required scope: {requiredScopeText}." ]
                        CorrelationId = correlationId
                    }

                ctx.Response.StatusCode <- StatusCodes.Status403Forbidden
                do! ctx.Response.WriteAsJsonAsync(payload)
                return Some ctx
            }

    let requireAnyScope (scopes: string list) : HttpHandler =
        let requiredScopes = normalizeRequiredScopes scopes

        if Set.isEmpty requiredScopes then
            invalidArg (nameof scopes) "At least one scope is required."

        fun next ctx ->
            task {
                if Set.intersect requiredScopes (userScopes ctx) |> Set.isEmpty then
                    return! forbidden requiredScopes next ctx
                else
                    return! next ctx
            }

    let requireScope (scope: string) : HttpHandler = requireAnyScope [ scope ]
