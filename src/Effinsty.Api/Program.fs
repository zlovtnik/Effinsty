namespace Effinsty.Api

open System
open System.Collections.Generic
open System.Text
open System.Text.Json
open Effinsty.Api.Context
open Effinsty.Api.ScopeAuthorization
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
    let private corsPolicyName = "EffinstyCorsPolicy"

    let private defaultDevelopmentCorsOrigins =
        [|
            "http://localhost:5173"
            "http://127.0.0.1:5173"
            "http://localhost:4173"
            "http://127.0.0.1:4173"
        |]

    let private firstNonEmpty (values: string seq) =
        values
        |> Seq.tryFind (fun value -> not (String.IsNullOrWhiteSpace(value)))

    let private splitOrigins (value: string) =
        value.Split([| ','; ';' |], StringSplitOptions.RemoveEmptyEntries)
        |> Seq.map (fun origin -> origin.Trim())
        |> Seq.filter (fun origin -> not (String.IsNullOrWhiteSpace(origin)))

    let private distinctOrigins (origins: string seq) =
        let seen = HashSet<string>(StringComparer.OrdinalIgnoreCase)

        origins
        |> Seq.filter (fun origin -> seen.Add(origin))
        |> Seq.toArray

    let private resolveConfigValue (configuration: IConfiguration) (configKeys: string list) (envVars: string list) =
        let fromConfig =
            configKeys
            |> Seq.tryPick (fun key ->
                let value = configuration.GetValue<string>(key)

                if String.IsNullOrWhiteSpace(value) then
                    None
                else
                    Some value)

        match fromConfig with
        | Some value -> Some value
        | None ->
            envVars
            |> Seq.tryPick (fun name ->
                let value = Environment.GetEnvironmentVariable(name)

                if String.IsNullOrWhiteSpace(value) then
                    None
                else
                    Some value)

    let private resolveCorsOrigins (configuration: IConfiguration) (isDevelopment: bool) =
        let sectionValues =
            configuration.GetSection("Cors:AllowedOrigins").GetChildren()
            |> Seq.choose (fun child ->
                if String.IsNullOrWhiteSpace(child.Value) then
                    None
                else
                    Some child.Value)
            |> Seq.collect splitOrigins

        let scalarValues =
            [ configuration.GetValue<string>("Cors:AllowedOrigins")
              Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS") ]
            |> Seq.choose (fun value ->
                if String.IsNullOrWhiteSpace(value) then
                    None
                else
                    Some value)
            |> Seq.collect splitOrigins

        let configuredOrigins =
            Seq.append sectionValues scalarValues
            |> distinctOrigins

        if configuredOrigins.Length > 0 then
            configuredOrigins
        elif isDevelopment then
            defaultDevelopmentCorsOrigins
        else
            [||]

    let private isHealthPath (path: PathString) =
        path.StartsWithSegments(PathString("/api/health"), StringComparison.OrdinalIgnoreCase)

    let resolveWalletLocationWithLegacySupport (configuration: IConfiguration) (configuredWalletLocation: string option) =
        let configured =
            configuredWalletLocation
            |> Option.bind (fun value -> if String.IsNullOrWhiteSpace(value) then None else Some value)

        match configured with
        | Some value -> Some value, false
        | None ->
            let configuredFromKeys = resolveConfigValue configuration [ "Oracle:WalletLocation"; "WalletLocation" ] []

            match configuredFromKeys with
            | Some value -> Some value, false
            | None ->
                let preferred = firstNonEmpty [ Environment.GetEnvironmentVariable("ORACLE_WALLET_PATH") ]

                match preferred with
                | Some value -> Some value, false
                | None ->
                    let legacy = firstNonEmpty [ Environment.GetEnvironmentVariable("ORACLE_WALLET_LOCATION") ]

                    match legacy with
                    | Some value -> Some value, true
                    | None ->
                        let fallback = firstNonEmpty [ Environment.GetEnvironmentVariable("WALLET_LOCATION") ]
                        fallback, false

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
            if HttpMethods.IsOptions(ctx.Request.Method) || isHealthPath ctx.Request.Path then
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

                logger.LogError(
                    Events.UnhandledError,
                    ex,
                    "Unhandled exception while processing request {Method} {Path}",
                    ctx.Request.Method,
                    ctx.Request.Path.Value
                )

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
                    GET >=> route "" >=> requireScope "contacts.read" >=> ContactHandlers.listContacts
                    POST >=> route "" >=> requireScope "contacts.write" >=> ContactHandlers.createContact
                    GET >=> routef "/%O" (fun contactId -> requireScope "contacts.read" >=> ContactHandlers.getContact contactId)
                    PUT >=> routef "/%O" (fun contactId -> requireScope "contacts.write" >=> ContactHandlers.updateContact contactId)
                    DELETE >=> routef "/%O" (fun contactId -> requireAnyScope [ "contacts.delete"; "contacts.write" ] >=> ContactHandlers.deleteContact contactId)
                ]
            )

            setStatusCode 404 >=> json {| code = "not_found"; message = "Route not found." |}
        ]

    [<EntryPoint>]
    let main args =
        let builder = WebApplication.CreateBuilder(args)
        let isDevelopment = builder.Environment.IsDevelopment()
        let corsOrigins = resolveCorsOrigins builder.Configuration isDevelopment
        let corsEnabled = corsOrigins.Length > 0

        if builder.Environment.IsProduction() then
            builder.Logging.ClearProviders() |> ignore

            builder.Logging
                .AddJsonConsole(fun options ->
                    options.JsonWriterOptions <- JsonWriterOptions(Indented = false)
                    options.IncludeScopes <- true
                    options.TimestampFormat <- "O")
            |> ignore
        else
            builder.Logging.ClearProviders() |> ignore
            builder.Logging.AddConsole() |> ignore

        let environmentSigningKey = Environment.GetEnvironmentVariable("JWT__SIGNINGKEY")

        if not (String.IsNullOrWhiteSpace(environmentSigningKey)) then
            builder.Configuration["Jwt:SigningKey"] <- environmentSigningKey

        let oracleOptions = builder.Configuration.GetSection("Oracle").Get<OracleOptions>()
        let configuredWalletLocation = if obj.ReferenceEquals(oracleOptions, null) then None else firstNonEmpty [ oracleOptions.WalletLocation ]
        let configuredTnsAdmin = if obj.ReferenceEquals(oracleOptions, null) then None else firstNonEmpty [ oracleOptions.TnsAdmin ]
        let configuredDataSource = if obj.ReferenceEquals(oracleOptions, null) then None else firstNonEmpty [ oracleOptions.DataSource ]

        let walletLocation, usedLegacyWalletEnv =
            resolveWalletLocationWithLegacySupport builder.Configuration configuredWalletLocation

        let tnsAdmin =
            configuredTnsAdmin
            |> Option.orElseWith (fun () ->
                resolveConfigValue builder.Configuration [ "Oracle:TnsAdmin"; "TnsAdmin" ] [ "ORACLE_TNS_ADMIN"; "TNS_ADMIN" ])

        let dataSource =
            configuredDataSource
            |> Option.orElseWith (fun () ->
                resolveConfigValue builder.Configuration [ "Oracle:DataSource"; "DataSource" ] [ "ORACLE_DATA_SOURCE"; "DATA_SOURCE" ])

        match walletLocation with
        | Some value ->
            builder.Configuration["Oracle:WalletLocation"] <- value
            OracleConfiguration.WalletLocation <- value
        | None -> ()

        match tnsAdmin with
        | Some value ->
            builder.Configuration["Oracle:TnsAdmin"] <- value
            OracleConfiguration.TnsAdmin <- value
        | None -> ()

        match dataSource with
        | Some value -> builder.Configuration["Oracle:DataSource"] <- value
        | None -> ()

        builder.Services.AddGiraffe() |> ignore
        builder.Services.AddEffinstyInfrastructure(builder.Configuration) |> ignore

        if corsEnabled then
            builder.Services
                .AddCors(fun options ->
                    options.AddPolicy(
                        corsPolicyName,
                        fun policy ->
                            policy
                                .WithOrigins(corsOrigins)
                                .AllowAnyHeader()
                                .AllowAnyMethod()
                                .AllowCredentials()
                                .WithExposedHeaders("X-Correlation-ID")
                            |> ignore
                    ))
            |> ignore

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
        let startupLogger = app.Services.GetRequiredService<ILoggerFactory>().CreateLogger("Effinsty.Api.Startup")

        if usedLegacyWalletEnv then
            startupLogger.LogWarning(
                "Environment variable ORACLE_WALLET_LOCATION is deprecated and will be removed in a future release. Use ORACLE_WALLET_PATH instead."
            )

        app.Use(fun next -> RequestDelegate(fun ctx -> errorHandlingMiddleware next ctx)) |> ignore
        app.Use(fun next -> RequestDelegate(fun ctx -> setCorrelationIdMiddleware next ctx)) |> ignore

        if corsEnabled then
            app.UseCors(corsPolicyName) |> ignore
        elif not isDevelopment then
            startupLogger.LogWarning(
                "CORS is disabled because no allowed origins were configured. Set Cors:AllowedOrigins or CORS_ALLOWED_ORIGINS."
            )

        app.Use(fun next -> RequestDelegate(fun ctx -> tenantResolutionMiddleware next ctx)) |> ignore

        app.UseAuthentication() |> ignore
        app.UseAuthorization() |> ignore

        app.MapHealthChecks(
            "/api/health/oracle",
            HealthCheckOptions(Predicate = fun registration -> registration.Tags.Contains("oracle"))
        )
        |> ignore

        app.UseGiraffe(webApp)

        app.Run()
        0
