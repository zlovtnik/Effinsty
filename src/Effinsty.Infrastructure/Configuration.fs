namespace Effinsty.Infrastructure

open System.Collections.Generic

[<CLIMutable>]
type OracleOptions = {
    WalletLocation: string
    TnsAdmin: string
    DataSource: string
    ConnectionTimeoutSeconds: int
}

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
    Map: Dictionary<string, TenantMapEntry>
}
