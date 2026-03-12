namespace Effinsty.Api

open System
open System.Text.Json
open Effinsty.Api.Context
open Effinsty.Application
open Effinsty.Domain
open Giraffe
open Microsoft.AspNetCore.Http
open Microsoft.Extensions.DependencyInjection
open Microsoft.Extensions.Logging

module private HandlerHelpers =
    let stringToOption (value: string) =
        if String.IsNullOrWhiteSpace(value) then None else Some value

    let dictionaryToMap (value: System.Collections.Generic.IDictionary<string, string>) =
        if isNull value then
            Map.empty
        else
            value
            |> Seq.map (fun pair -> pair.Key, pair.Value)
            |> Map.ofSeq

    let withTenantAndUser (ctx: HttpContext) =
        match tryGetTenantContext ctx, tryGetUserId ctx with
        | Some tenant, Some userId -> Ok(tenant, userId)
        | None, _ -> Error(ValidationError [ "Tenant context is missing." ])
        | _, None -> Error(Unauthorized "Authenticated user id is missing.")

    let errorToResponse (ctx: HttpContext) (error: AppError) =
        let correlationId = tryGetCorrelationId ctx |> Option.defaultValue String.Empty

        match error with
        | InfrastructureError detail
        | UnexpectedError detail ->
            let logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Effinsty.Api.ErrorResponse")
            logger.LogError("Server error for correlation id {CorrelationId}: {ErrorDetail}", correlationId, detail)
        | _ -> ()

        let payload =
            {
                Code = ErrorHttp.toCode error
                Message = ErrorHttp.toMessage error
                Details = ErrorHttp.toDetails error
                CorrelationId = correlationId
            }

        setStatusCode (ErrorHttp.toStatusCode error) >=> json payload

    let fromResult result (onSuccess: 'T -> HttpHandler) : HttpHandler =
        match result with
        | Ok value -> onSuccess value
        | Error err -> fun next ctx -> errorToResponse ctx err next ctx

module AuthHandlers =
    let login: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IAuthService>()
                let! requestResult =
                    task {
                        try
                            let! parsed = ctx.BindJsonAsync<LoginRequest>()
                            return Ok parsed
                        with
                        | :? JsonException
                        | :? InvalidOperationException ->
                            return Error(ValidationError [ "Invalid login payload." ])
                    }

                match requestResult with
                | Error error -> return! HandlerHelpers.errorToResponse ctx error next ctx
                | Ok request ->
                    match tryGetTenantContext ctx with
                    | None ->
                        let error = ValidationError [ "Tenant context is missing." ]
                        return! HandlerHelpers.errorToResponse ctx error next ctx
                    | Some tenant ->
                        let command = {
                            Username = request.Username
                            Password = request.Password
                        }

                        let! result = service.LoginAsync(tenant, command, ctx.RequestAborted)

                        return!
                            HandlerHelpers.fromResult result (Mapping.toLoginResponse >> json)
                                next
                                ctx
            }

    let refresh: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IAuthService>()
                let! request = ctx.BindJsonAsync<RefreshRequest>()

                match tryGetTenantContext ctx with
                | None ->
                    let error = ValidationError [ "Tenant context is missing." ]
                    return! HandlerHelpers.errorToResponse ctx error next ctx
                | Some tenant ->
                    let command = { RefreshToken = request.RefreshToken }
                    let! result = service.RefreshAsync(tenant, command, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (Mapping.toLoginResponse >> json)
                            next
                            ctx
            }

    let logout: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IAuthService>()
                let! request = ctx.BindJsonAsync<RefreshRequest>()

                match tryGetTenantContext ctx with
                | None ->
                    let error = ValidationError [ "Tenant context is missing." ]
                    return! HandlerHelpers.errorToResponse ctx error next ctx
                | Some tenant ->
                    let command = { RefreshToken = request.RefreshToken }
                    let! result = service.LogoutAsync(tenant, command, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (fun _ -> json {| success = true |})
                            next
                            ctx
            }

module ContactHandlers =
    let [<Literal>] MaxPageSize = 100

    let listContacts: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IContactService>()

                match HandlerHelpers.withTenantAndUser ctx with
                | Error err -> return! HandlerHelpers.errorToResponse ctx err next ctx
                | Ok(tenant, userId) ->
                    let parsePositiveInt (value: string option) =
                        value
                        |> Option.bind (fun raw ->
                            match Int32.TryParse(raw) with
                            | true, parsed when parsed > 0 -> Some parsed
                            | _ -> None)

                    let page =
                        ctx.TryGetQueryStringValue("page")
                        |> parsePositiveInt
                        |> Option.defaultValue 1

                    let pageSize =
                        ctx.TryGetQueryStringValue("pageSize")
                        |> parsePositiveInt
                        |> Option.map (fun value -> if value > MaxPageSize then MaxPageSize else value)
                        |> Option.defaultValue 20

                    let! result = service.ListAsync(tenant, userId, page, pageSize, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (Mapping.toPagedResponse >> json)
                            next
                            ctx
            }

    let getContact (contactId: Guid): HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IContactService>()

                match HandlerHelpers.withTenantAndUser ctx with
                | Error err -> return! HandlerHelpers.errorToResponse ctx err next ctx
                | Ok(tenant, userId) ->
                    let! result = service.GetAsync(tenant, userId, ContactId contactId, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (Mapping.toContactResponse >> json)
                            next
                            ctx
            }

    let createContact: HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IContactService>()
                let! request = ctx.BindJsonAsync<ContactCreateRequest>()

                match HandlerHelpers.withTenantAndUser ctx with
                | Error err -> return! HandlerHelpers.errorToResponse ctx err next ctx
                | Ok(tenant, userId) ->
                    let command = {
                        UserId = userId
                        FirstName = request.FirstName
                        LastName = request.LastName
                        Email = HandlerHelpers.stringToOption request.Email
                        Phone = HandlerHelpers.stringToOption request.Phone
                        Address = HandlerHelpers.stringToOption request.Address
                        Metadata = HandlerHelpers.dictionaryToMap request.Metadata
                    }

                    let! result = service.CreateAsync(tenant, command, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (Mapping.toContactResponse >> json)
                            next
                            ctx
            }

    let updateContact (contactId: Guid): HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IContactService>()
                let! request = ctx.BindJsonAsync<ContactUpdateRequest>()

                match HandlerHelpers.withTenantAndUser ctx with
                | Error err -> return! HandlerHelpers.errorToResponse ctx err next ctx
                | Ok(tenant, userId) ->
                    let command = {
                        ContactId = ContactId contactId
                        UserId = userId
                        FirstName = HandlerHelpers.stringToOption request.FirstName
                        LastName = HandlerHelpers.stringToOption request.LastName
                        Email = HandlerHelpers.stringToOption request.Email
                        Phone = HandlerHelpers.stringToOption request.Phone
                        Address = HandlerHelpers.stringToOption request.Address
                        Metadata =
                            if isNull request.Metadata then
                                None
                            else
                                Some(HandlerHelpers.dictionaryToMap request.Metadata)
                    }

                    let! result = service.UpdateAsync(tenant, command, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (Mapping.toContactResponse >> json)
                            next
                            ctx
            }

    let deleteContact (contactId: Guid): HttpHandler =
        fun next ctx ->
            task {
                let service = ctx.RequestServices.GetRequiredService<IContactService>()

                match HandlerHelpers.withTenantAndUser ctx with
                | Error err -> return! HandlerHelpers.errorToResponse ctx err next ctx
                | Ok(tenant, userId) ->
                    let! result = service.DeleteAsync(tenant, userId, ContactId contactId, ctx.RequestAborted)

                    return!
                        HandlerHelpers.fromResult result (fun _ -> json {| success = true |})
                            next
                            ctx
            }
