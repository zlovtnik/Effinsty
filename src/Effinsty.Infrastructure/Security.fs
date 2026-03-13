namespace Effinsty.Infrastructure

open System
open System.IdentityModel.Tokens.Jwt
open System.Security.Claims
open System.Text
open Effinsty.Application
open Effinsty.Domain
open Microsoft.Extensions.Options
open Microsoft.IdentityModel.Tokens

type PasswordHasher() =
    interface IPasswordHasher with
        member _.Verify(plainText, hashed) = BCrypt.Net.BCrypt.Verify(plainText, hashed)

type JwtTokenProvider(options: IOptions<JwtOptions>) =
    let config = options.Value

    let tokenHandler = JwtSecurityTokenHandler()
    let legacyFallbackScopes = [ "contacts.read"; "contacts.write"; "contacts.delete" ]

    let signingCredentials () =
        let key = SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.SigningKey))
        SigningCredentials(key, SecurityAlgorithms.HmacSha256)

    let normalizeScopes (scopes: string seq) =
        scopes
        |> Seq.map (fun scope -> if isNull scope then String.Empty else scope.Trim())
        |> Seq.filter (String.IsNullOrWhiteSpace >> not)
        |> Seq.distinct
        |> Seq.toList

    let resolveAccessScopes (tenantId: string) =
        let configuredScopes =
            if not (obj.ReferenceEquals(config.TenantAccessScopes, null))
               && config.TenantAccessScopes.ContainsKey(tenantId) then
                config.TenantAccessScopes.[tenantId] |> Seq.ofList
            elif not (obj.ReferenceEquals(config.DefaultAccessScopes, null)) then
                config.DefaultAccessScopes |> Seq.ofList
            else
                Seq.empty

        match normalizeScopes configuredScopes with
        | [] -> legacyFallbackScopes
        | resolved -> resolved

    let createToken (claims: Claim list) (expiresAt: DateTime) =
        let descriptor = SecurityTokenDescriptor()
        descriptor.Subject <- ClaimsIdentity(claims)
        descriptor.Issuer <- config.Issuer
        descriptor.Audience <- config.Audience
        descriptor.Expires <- expiresAt
        descriptor.SigningCredentials <- signingCredentials ()
        let token = tokenHandler.CreateToken(descriptor)
        tokenHandler.WriteToken(token)

    interface ITokenProvider with
        member _.IssueTokens(user, tenant) =
            if String.IsNullOrWhiteSpace(config.SigningKey) then
                Error(InfrastructureError "JWT signing key is not configured.")
            else
                let now = DateTimeOffset.UtcNow
                let accessExpiry = now.AddMinutes(float (if config.AccessTokenMinutes <= 0 then 15 else config.AccessTokenMinutes))
                let refreshExpiry = now.AddDays(float (if config.RefreshTokenDays <= 0 then 7 else config.RefreshTokenDays))
                let sessionId = Guid.NewGuid().ToString("N")
                let userId = UserId.value user.Id |> string
                let tenantId = TenantId.value tenant.TenantId
                let accessScopes = resolveAccessScopes tenantId |> String.concat " "

                let accessClaims =
                    [ Claim(JwtRegisteredClaimNames.Sub, userId)
                      Claim(ClaimTypes.NameIdentifier, userId)
                      Claim(ClaimTypes.Name, user.Username)
                      Claim("scope", accessScopes)
                      Claim("tenant", tenantId)
                      Claim("sid", sessionId)
                      Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")) ]

                let refreshClaims =
                    [ Claim(JwtRegisteredClaimNames.Sub, userId)
                      Claim("tenant", tenantId)
                      Claim("sid", sessionId)
                      Claim("typ", "refresh")
                      Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")) ]

                let accessToken = createToken accessClaims accessExpiry.UtcDateTime
                let refreshToken = createToken refreshClaims refreshExpiry.UtcDateTime

                Ok {
                    AccessToken = accessToken
                    RefreshToken = refreshToken
                    ExpiresAt = accessExpiry
                }

        member _.ValidateRefreshToken(refreshToken) =
            if String.IsNullOrWhiteSpace(config.SigningKey) then
                Error(InfrastructureError "JWT signing key is not configured.")
            else
                try
                    let key = SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.SigningKey))
                    let parameters = TokenValidationParameters()
                    parameters.ValidateIssuer <- true
                    parameters.ValidIssuer <- config.Issuer
                    parameters.ValidateAudience <- true
                    parameters.ValidAudience <- config.Audience
                    parameters.ValidateIssuerSigningKey <- true
                    parameters.IssuerSigningKey <- key
                    parameters.ValidateLifetime <- true
                    parameters.ClockSkew <- TimeSpan.FromMinutes(1.0)

                    let principal, _ = tokenHandler.ValidateToken(refreshToken, parameters)

                    let typ = principal.FindFirst("typ")
                    let sid = principal.FindFirst("sid")
                    let tenant = principal.FindFirst("tenant")
                    let sub = principal.FindFirst(JwtRegisteredClaimNames.Sub)

                    if isNull typ || typ.Value <> "refresh" then
                        Error(Unauthorized "Token is not a refresh token.")
                    elif isNull sid || String.IsNullOrWhiteSpace(sid.Value) then
                        Error(Unauthorized "Refresh token is missing session id.")
                    elif isNull tenant || String.IsNullOrWhiteSpace(tenant.Value) then
                        Error(Unauthorized "Refresh token is missing tenant id.")
                    elif isNull sub || String.IsNullOrWhiteSpace(sub.Value) then
                        Error(Unauthorized "Refresh token is missing user id.")
                    else
                        match Guid.TryParse(sub.Value) with
                        | true, parsedUserId ->
                            Ok {
                                UserId = UserId parsedUserId
                                TenantId = TenantId tenant.Value
                                SessionId = sid.Value
                            }
                        | _ ->
                            Error(Unauthorized "Invalid subject claim: unable to parse user id.")
                with _ ->
                    Error(Unauthorized "Refresh token is invalid.")
