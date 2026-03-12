namespace Effinsty.Infrastructure

open Microsoft.Extensions.Logging

module Events =
    // DB Connection (1000–1099)
    let DbConnectionOpened = EventId(1000, "DbConnectionOpened")
    let DbConnectionFailed = EventId(1001, "DbConnectionFailed")

    // DB Health Checks (1100–1199)
    let DbHealthCheckPassed = EventId(1100, "DbHealthCheckPassed")
    let DbHealthCheckFailed = EventId(1101, "DbHealthCheckFailed")
    let TenantDbHealthCheckPassed = EventId(1102, "TenantDbHealthCheckPassed")
    let TenantDbHealthCheckFailed = EventId(1103, "TenantDbHealthCheckFailed")

    // Startup Validation (1200–1299)
    let DbStartupValidationBegin = EventId(1200, "DbStartupValidationBegin")
    let DbSchemaValid = EventId(1201, "DbSchemaValid")
    let DbObjectMissing = EventId(1202, "DbObjectMissing")
    let DbStartupValidationFailed = EventId(1203, "DbStartupValidationFailed")

    // Queries (1300–1399)
    let DbQueryContacts = EventId(1300, "DbQueryContacts")
    let DbQueryUsers = EventId(1301, "DbQueryUsers")
    let DbQueryFailed = EventId(1399, "DbQueryFailed")

    // Commands (1400–1499)
    let DbCommandContact = EventId(1400, "DbCommandContact")
    let DbCommandFailed = EventId(1499, "DbCommandFailed")

    // Tenant (2000–2099)
    let TenantResolved = EventId(2000, "TenantResolved")
    let TenantRejected = EventId(2001, "TenantRejected")

    // Unhandled (9000–9099)
    let UnhandledError = EventId(9000, "UnhandledError")
