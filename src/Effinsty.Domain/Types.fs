namespace Effinsty.Domain

open System
open System.Runtime.Serialization
open System.Text.Json.Serialization

type TenantId = TenantId of string

type TenantSchema = TenantSchema of string

type TenantContext = {
    TenantId: TenantId
    Schema: TenantSchema
    DataSourceAlias: string
}

type UserId = UserId of Guid

type ContactId = ContactId of Guid

type User = {
    Id: UserId
    TenantId: TenantId
    Username: string
    [<JsonIgnore; IgnoreDataMember>]
    Email: string
    [<JsonIgnore; IgnoreDataMember>]
    PasswordHash: string
    Active: bool
    CreatedAt: DateTimeOffset
    UpdatedAt: DateTimeOffset
} with
    override this.ToString() =
        let (UserId userId) = this.Id
        let (TenantId tenantId) = this.TenantId
        $"User(Id={userId}, TenantId={tenantId}, Username={this.Username}, Active={this.Active})"

type Contact = {
    Id: ContactId
    TenantId: TenantId
    UserId: UserId
    FirstName: string
    LastName: string
    Email: string option
    Phone: string option
    Address: string option
    Metadata: Map<string, string>
    CreatedAt: DateTimeOffset
    UpdatedAt: DateTimeOffset
}

type AuthToken = {
    AccessToken: string
    RefreshToken: string
    ExpiresAt: DateTimeOffset
} with
    override this.ToString() =
        $"AuthToken(AccessToken=<redacted>, RefreshToken=<redacted>, ExpiresAt={this.ExpiresAt:O})"

type RefreshTokenPayload = {
    UserId: UserId
    TenantId: TenantId
    SessionId: string
}

type AppError =
    | ValidationError of string list
    | Unauthorized of string
    | Forbidden of string
    | NotFound of string
    | Conflict of string
    | InfrastructureError of string
    | UnexpectedError of string

module TenantId =
    let value (TenantId value) = value

module TenantSchema =
    let value (TenantSchema value) = value

module UserId =
    let value (UserId value) = value

module ContactId =
    let value (ContactId value) = value
