module SqlTemplateTests

open Effinsty.Infrastructure
open Xunit

[<Fact>]
let ``sql templates use bind variables`` () =
    let sql = SqlTemplates.contactById "TENANT_A"

    Assert.Contains(":userId", sql)
    Assert.Contains(":id", sql)
    Assert.DoesNotContain("'", sql)

[<Fact>]
let ``contact list template includes pagination bind variables`` () =
    let sql = SqlTemplates.contactsList "TENANT_A"

    Assert.Contains(":offset", sql)
    Assert.Contains(":pageSize", sql)
