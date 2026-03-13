module DomainValidationTests

open Effinsty.Domain
open Xunit

[<Fact>]
let ``validateContactDraft normalizes email and phone`` () =
    let result =
        Validation.validateContactDraft
            "Ada"
            "Lovelace"
            (Some "  ADA@EXAMPLE.COM  ")
            (Some "(555) 123-4567")
            None
            Map.empty

    match result with
    | Error _ -> Assert.Fail("Validation should succeed")
    | Ok draft ->
        Assert.Equal(Some "ada@example.com", draft.Email)
        Assert.Equal(Some "5551234567", draft.Phone)

[<Fact>]
let ``validateTenantSchema rejects invalid schema`` () =
    let result = Validation.validateTenantSchema "tenant-a"

    match result with
    | Ok _ -> Assert.Fail("Schema should be rejected")
    | Error (ValidationError details) -> Assert.Contains("Tenant schema must match", details.Head)
    | Error _ -> Assert.Fail("Expected validation error")

[<Fact>]
let ``validateContactDraft ignores null and blank metadata values`` () =
    let metadata =
        Map.ofList [
            "tier", null
            "team", "   "
            " region ", " us-east "
            "   ", "value"
        ]

    let result = Validation.validateContactDraft "Ada" "Lovelace" None None None metadata

    match result with
    | Error _ -> Assert.Fail("Validation should succeed")
    | Ok draft ->
        Assert.Equal(1, draft.Metadata.Count)
        Assert.True(draft.Metadata.ContainsKey("region"))
        Assert.Equal("us-east", draft.Metadata["region"])
