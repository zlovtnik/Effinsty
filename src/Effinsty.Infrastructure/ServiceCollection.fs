namespace Effinsty.Infrastructure

open Effinsty.Application
open Microsoft.Extensions.Configuration
open Microsoft.Extensions.DependencyInjection
open StackExchange.Redis

[<AutoOpen>]
module ServiceCollectionExtensions =
    type IServiceCollection with
        member this.AddEffinstyInfrastructure(configuration: IConfiguration) =
            this.Configure<OracleOptions>(configuration.GetSection("Oracle")) |> ignore
            this.Configure<JwtOptions>(configuration.GetSection("Jwt")) |> ignore
            this.Configure<RedisOptions>(configuration.GetSection("Redis")) |> ignore
            this.Configure<TenantOptions>(configuration.GetSection("Tenancy")) |> ignore
            this.PostConfigure<TenantOptions>(fun options ->
                if obj.ReferenceEquals(options.Map, null) then
                    options.Map <- System.Collections.Generic.Dictionary<string, TenantMapEntry>())
            |> ignore

            let redisOptions = configuration.GetSection("Redis").Get<RedisOptions>()

            let redisConfiguration =
                if obj.ReferenceEquals(redisOptions, null) then
                    null
                else
                    redisOptions.Configuration

            if System.String.IsNullOrWhiteSpace(redisConfiguration) then
                raise (System.InvalidOperationException("Redis configuration is missing. Set Redis:Configuration in configuration sources."))

            this.AddSingleton<IOracleConnectionFactory, OracleConnectionFactory>() |> ignore
            this.AddSingleton<ITenantResolver, TenantResolver>() |> ignore
            this.AddScoped<IUserRepository, OracleUserRepository>() |> ignore
            this.AddScoped<IContactRepository, OracleContactRepository>() |> ignore
            this.AddSingleton<IPasswordHasher, PasswordHasher>() |> ignore
            this.AddSingleton<ITokenProvider, JwtTokenProvider>() |> ignore

            this.AddSingleton<IConnectionMultiplexer>(
                System.Func<System.IServiceProvider, IConnectionMultiplexer>(fun sp ->
                    ConnectionMultiplexer.Connect(redisConfiguration) :> IConnectionMultiplexer)
            )
            |> ignore

            this.AddScoped<ISessionStore, RedisSessionStore>() |> ignore
            this.AddScoped<IAuthService, AuthService>() |> ignore
            this.AddScoped<IContactService, ContactService>() |> ignore

            this.AddHealthChecks().AddCheck<OracleConnectivityHealthCheck>("oracle") |> ignore

            this
