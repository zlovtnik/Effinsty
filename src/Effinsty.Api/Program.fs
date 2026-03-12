namespace Effinsty.Api

open System
open System.Text
open Effinsty.Api.Context
open Effinsty.Application
open Effinsty.Domain
open Effinsty.Infrastructure
open Giraffe
open Microsoft.AspNetCore.Authentication.JwtBearer
open Microsoft.AspNetCore.Builder
open Microsoft.AspNetCore.Diagnostics.HealthChecks
open Microsoft.AspNetCore.Http
open Microsoft.Extensions.Configuration
open Microsoft.Extensions.DependencyInjection
open Microsoft.Extensions.Hosting
open Microsoft.Extensions.Logging
open Microsoft.IdentityModel.Tokens
open Oracle.ManagedDataAccess.Client

module Program =
    let private isHealthPath (path: PathString) =
        path.StartsWithSegments(PathString("/api/health"), StringComparison.OrdinalIgnoreCase)
        || path.StartsWithSegments(PathString("/api/health/oracle"), StringComparison.OrdinalIgnoreCase)

    let private setCorrelationIdMiddleware (next: RequestDelegate) (ctx: HttpContext) =
        task {
            let correlationId =
                if ctx.Request.Headers.ContainsKey("X-Correlation-ID") then
                    ctx.Request.Headers["X-Correlation-ID"].ToString()
                else
                    Guid.NewGuid().ToString("N")

            setCorrelationId ctx correlationId
            ctx.Response.Headers["X-Correlation-ID"] <- correlationId
            return! next.Invoke(ctx)
        }

    let private tenantResolutionMiddleware (next: RequestDelegate) (ctx: HttpContext) =
        task {
            if isHealthPath ctx.Request.Path then
                return! next.Invoke(ctx)
            else
                let resolver = ctx.RequestServices.GetRequiredService<ITenantResolver>()

                let headerValue =
                    if ctx.Request.Headers.ContainsKey("X-Tenant-ID") then
                        Some(ctx.Request.Headers["X-Tenant-ID"].ToString())
                    else
                        None

                let! resolved = resolver.ResolveAsync(headerValue, ctx.RequestAborted)

                match resolved with
                | Ok tenant ->
                    setTenantContext ctx tenant
                    return! next.Invoke(ctx)
                | Error error ->
                    let correlationId = tryGetCorrelationId ctx |> Option.defaultValue String.Empty

                    let payload =
                        {
                            Code = ErrorHttp.toCode error
                            Message = ErrorHttp.toMessage error
                            Details = ErrorHttp.toDetails error
                            CorrelationId = correlationId
                        }

                    ctx.Response.StatusCode <- ErrorHttp.toStatusCode error
                    return! ctx.Response.WriteAsJsonAsync(payload)
        }

    let private errorHandlingMiddleware (next: RequestDelegate) (ctx: HttpContext) =
        task {
            try
                return! next.Invoke(ctx)
            with ex ->
                let logger = ctx.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("Effinsty.Api.ErrorHandlingMiddleware")
                logger.LogError(ex, "Unhandled exception while processing request {Method} {Path}", ctx.Request.Method, ctx.Request.Path.Value)

                let correlationId = tryGetCorrelationId ctx |> Option.defaultValue String.Empty

                let payload =
                    {
                        Code = "unexpected_error"
                        Message = "Unhandled server error."
                        Details = [ "An internal error occurred." ]
                        CorrelationId = correlationId
                    }

                if ctx.Response.HasStarted then
                    return ()
                else
                    ctx.Response.StatusCode <- 500
                    return! ctx.Response.WriteAsJsonAsync(payload)
        }

    let private webApp =
        choose [
            GET >=> route "/api/health" >=> json {| status = "ok" |}
            GET >=> route "/api/health/live" >=> json {| status = "live" |}

            POST >=> route "/api/auth/login" >=> AuthHandlers.login
            POST >=> route "/api/auth/refresh" >=> AuthHandlers.refresh
            POST >=> route "/api/auth/logout" >=> requiresAuthentication (challenge JwtBearerDefaults.AuthenticationScheme) >=> AuthHandlers.logout

            subRoute "/api/contacts" (
                requiresAuthentication (challenge JwtBearerDefaults.AuthenticationScheme)
                >=> choose [
                    GET >=> route "" >=> ContactHandlers.listContacts
                    POST >=> route "" >=> ContactHandlers.createContact
                    GET >=> routef "/%O" ContactHandlers.getContact
                    PUT >=> routef "/%O" ContactHandlers.updateContact
                    DELETE >=> routef "/%O" ContactHandlers.deleteContact
                ]
            )

            setStatusCode 404 >=> json {| code = "not_found"; message = "Route not found." |}
        ]

    [<EntryPoint>]
    let main args =
        let builder = WebApplication.CreateBuilder(args)

        let environmentSigningKey = Environment.GetEnvironmentVariable("JWT__SIGNINGKEY")

        if not (String.IsNullOrWhiteSpace(environmentSigningKey)) then
            builder.Configuration["Jwt:SigningKey"] <- environmentSigningKey

        let oracleOptions = builder.Configuration.GetSection("Oracle").Get<OracleOptions>()

        if not (obj.ReferenceEquals(oracleOptions, null)) then
            if not (String.IsNullOrWhiteSpace(oracleOptions.WalletLocation)) then
                OracleConfiguration.WalletLocation <- oracleOptions.WalletLocation

            if not (String.IsNullOrWhiteSpace(oracleOptions.TnsAdmin)) then
                OracleConfiguration.TnsAdmin <- oracleOptions.TnsAdmin

        builder.Services.AddGiraffe() |> ignore
        builder.Services.AddEffinstyInfrastructure(builder.Configuration) |> ignore

        let jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()

        if obj.ReferenceEquals(jwtOptions, null) then
            raise (InvalidOperationException("Jwt configuration section is missing or invalid. Ensure Jwt settings are configured."))

        if String.IsNullOrWhiteSpace(jwtOptions.SigningKey) then
            raise (InvalidOperationException("Jwt:SigningKey is required and must be provided via environment variable or secret store."))

        let signingKey = SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey))

        builder.Services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(fun options ->
                options.TokenValidationParameters <-
                    TokenValidationParameters(
                        ValidateIssuer = true,
                        ValidIssuer = jwtOptions.Issuer,
                        ValidateAudience = true,
                        ValidAudience = jwtOptions.Audience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = signingKey,
                        ValidateLifetime = true,
                        ClockSkew = TimeSpan.FromMinutes(1.0)
                    ))
        |> ignore

        builder.Services.AddAuthorization() |> ignore

        let app = builder.Build()

        app.UseMiddleware(fun next -> RequestDelegate(fun ctx -> errorHandlingMiddleware next ctx)) |> ignore
        app.UseMiddleware(fun next -> RequestDelegate(fun ctx -> setCorrelationIdMiddleware next ctx)) |> ignore
        app.UseMiddleware(fun next -> RequestDelegate(fun ctx -> tenantResolutionMiddleware next ctx)) |> ignore

        app.UseAuthentication() |> ignore
        app.UseAuthorization() |> ignore

        app.MapHealthChecks("/api/health/oracle", HealthCheckOptions()) |> ignore

        app.UseGiraffe(webApp)

        app.Run()
        0
