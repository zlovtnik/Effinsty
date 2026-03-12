namespace Effinsty.Api

open Effinsty.Domain

module ErrorHttp =
    let toStatusCode = function
        | ValidationError _ -> 400
        | Unauthorized _ -> 401
        | Forbidden _ -> 403
        | NotFound _ -> 404
        | Conflict _ -> 409
        | InfrastructureError _
        | UnexpectedError _ -> 500

    let toCode = function
        | ValidationError _ -> "validation_error"
        | Unauthorized _ -> "unauthorized"
        | Forbidden _ -> "forbidden"
        | NotFound _ -> "not_found"
        | Conflict _ -> "conflict"
        | InfrastructureError _ -> "infrastructure_error"
        | UnexpectedError _ -> "unexpected_error"

    let toMessage = function
        | ValidationError _ -> "Request validation failed."
        | Unauthorized value
        | Forbidden value
        | NotFound value
        | Conflict value
        | InfrastructureError value
        | UnexpectedError value -> value

    let toDetails = function
        | ValidationError details -> details
        | _ -> []
