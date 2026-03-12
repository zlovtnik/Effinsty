module ErrorHttpTests

open Effinsty.Api
open Effinsty.Domain
open Xunit

[<Fact>]
let ``error mapping covers expected status codes`` () =
    Assert.Equal(400, ErrorHttp.toStatusCode (ValidationError [ "bad" ]))
    Assert.Equal(401, ErrorHttp.toStatusCode (Unauthorized "x"))
    Assert.Equal(403, ErrorHttp.toStatusCode (Forbidden "x"))
    Assert.Equal(404, ErrorHttp.toStatusCode (NotFound "x"))
    Assert.Equal(409, ErrorHttp.toStatusCode (Conflict "x"))
    Assert.Equal(500, ErrorHttp.toStatusCode (InfrastructureError "x"))
    Assert.Equal(500, ErrorHttp.toStatusCode (UnexpectedError "x"))
