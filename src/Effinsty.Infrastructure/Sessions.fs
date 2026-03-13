namespace Effinsty.Infrastructure

open System
open System.Text.Json
open System.Threading
open System.Threading.Tasks
open Effinsty.Application
open Effinsty.Domain
open Microsoft.Extensions.Options
open StackExchange.Redis

[<CLIMutable>]
type private SessionDto = {
    SessionId: string
    UserId: Guid
    TenantId: string
    RefreshTokenHash: string
    ExpiresAtUtc: DateTimeOffset
}

type RedisSessionStore(redis: IConnectionMultiplexer, options: IOptions<RedisOptions>) =
    let db = redis.GetDatabase()

    let prefix =
        if String.IsNullOrWhiteSpace(options.Value.KeyPrefix) then
            "effinsty"
        else
            options.Value.KeyPrefix

    let makeKey sessionId = $"{prefix}:sessions:{sessionId}"

    interface ISessionStore with
        member _.SaveAsync(record, _ct) =
            task {
                let now = DateTimeOffset.UtcNow
                let expiry = record.ExpiresAt - now

                if expiry <= TimeSpan.Zero then
                    raise (InvalidOperationException("Cannot persist an already expired session record."))

                let dto = {
                    SessionId = record.SessionId
                    UserId = UserId.value record.UserId
                    TenantId = TenantId.value record.TenantId
                    RefreshTokenHash = record.RefreshTokenHash
                    ExpiresAtUtc = record.ExpiresAt
                }

                let payload = JsonSerializer.Serialize(dto)
                do! db.StringSetAsync(makeKey record.SessionId, payload, expiry) :> Task
            }

        member _.GetAsync(sessionId, _ct) =
            task {
                let! result = db.StringGetAsync(makeKey sessionId)

                if result.IsNullOrEmpty then
                    return None
                else
                    let dto = JsonSerializer.Deserialize<SessionDto>(result.ToString())

                    if obj.ReferenceEquals(dto, null) then
                        return None
                    else
                        return
                            Some {
                                SessionId = dto.SessionId
                                UserId = UserId dto.UserId
                                TenantId = TenantId dto.TenantId
                                RefreshTokenHash = dto.RefreshTokenHash
                                ExpiresAt = dto.ExpiresAtUtc
                            }
            }

        member _.DeleteAsync(sessionId, _ct) =
            task {
                do! db.KeyDeleteAsync(makeKey sessionId) :> Task
            }
