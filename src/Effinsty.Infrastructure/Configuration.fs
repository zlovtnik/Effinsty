namespace Effinsty.Infrastructure

open System
open System.Collections.Generic
open System.Runtime.Serialization
open System.Text.Json.Serialization

[<AttributeUsage(AttributeTargets.Property ||| AttributeTargets.Field, AllowMultiple = false)>]
type SensitiveAttribute() =
    inherit Attribute()

[<CLIMutable>]
type OracleOptions = {
    WalletLocation: string
    TnsAdmin: string
    DataSource: string
    ConnectionTimeoutSeconds: int
    [<Sensitive; JsonIgnore; IgnoreDataMember>]
    UserId: string
    [<Sensitive; JsonIgnore; IgnoreDataMember>]
    Password: string
} with
    override this.ToString() =
        $"OracleOptions(WalletLocation={this.WalletLocation}, TnsAdmin={this.TnsAdmin}, DataSource={this.DataSource}, ConnectionTimeoutSeconds={this.ConnectionTimeoutSeconds}, UserId=<redacted>, Password=<redacted>)"

[<CLIMutable>]
type JwtOptions = {
    Issuer: string
    Audience: string
    SigningKey: string
    AccessTokenMinutes: int
    RefreshTokenDays: int
}

[<CLIMutable>]
type RedisOptions = {
    Configuration: string
    KeyPrefix: string
}

[<CLIMutable>]
type TenantMapEntry = {
    Schema: string
    DataSourceAlias: string
}

[<CLIMutable>]
type TenantOptions = {
    mutable Map: Dictionary<string, TenantMapEntry>
}
