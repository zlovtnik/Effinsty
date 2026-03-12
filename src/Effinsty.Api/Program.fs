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
open Microsoft.Extensions.Options
open Microsoft.IdentityModel.Tokens

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
                let correlationId = tryGetCorrelationId ctx |> Option.defaultValue String.Empty

                let payload =
                    {
                        Code = "unexpected_error"
                        Message = "Unhandled server error."
                        Details = [ ex.Message ]
                        CorrelationId = correlationId
                    }

                ctx.Response.StatusCode <- 500
                return! ctx.Response.WriteAsJsonAsync(payload)
        }

    let private webApp =
        choose [
            GET >=> route "/api/health" >=> json {| status = "ok" |}

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

        builder.Services.AddGiraffe() |> ignore
        builder.Services.AddEffinstyInfrastructure(builder.Configuration) |> ignore

        let jwtOptions = builder.Configuration.GetSection("Jwt").Get<JwtOptions>()
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
