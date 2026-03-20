module RepositoryMetadataTests

open System
open System.Text.Json
open Effinsty.Infrastructure
open Xunit

[<Fact>]
let ``metadata parser fails fast for invalid json`` () =
    let ex =
        Assert.Throws<InvalidOperationException>(fun () ->
            RepositoryMetadata.deserializeContactMetadata "contact-123" "user-456" """{"bad":"""
            |> ignore)

    Assert.Contains("CONTACTS.ID='contact-123'", ex.Message)
    Assert.Contains("CONTACTS.USER_ID='user-456'", ex.Message)
    Assert.IsType<JsonException>(ex.InnerException)

[<Fact>]
let ``metadata parser deserializes valid json object to map`` () =
    let metadata =
        RepositoryMetadata.deserializeContactMetadata "contact-123" "user-456" """{"source":"crm","segment":"vip"}"""

    let expected = Map.ofList [ "source", "crm"; "segment", "vip" ]

    Assert.Equal<Map<string, string>>(expected, metadata)
