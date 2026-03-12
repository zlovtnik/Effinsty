namespace Effinsty.Infrastructure

open System
open System.Threading
open System.Threading.Tasks
open Effinsty.Application
open Effinsty.Domain
open Microsoft.Extensions.Hosting
open Microsoft.Extensions.Logging
open Microsoft.Extensions.Options

type DbStartupValidationService(
    factory: IOracleConnectionFactory,
    tenantOptions: IOptions<TenantOptions>,
    hostLifetime: IHostApplicationLifetime,
    logger: ILogger<DbStartupValidationService>
) =
    interface IHostedService with
        member _.StartAsync(ct: CancellationToken) =
            task {
                logger.LogInformation(
                    Events.DbStartupValidationBegin,
                    "DB schema validation starting. TenantCount={TenantCount}",
                    tenantOptions.Value.Map.Count
                )

                let mutable allValid = true

                for kvp in tenantOptions.Value.Map do
                    match Validation.validateTenantSchema kvp.Value.Schema with
                    | Error _ ->
                        logger.LogCritical(
                            Events.DbStartupValidationFailed,
                            "Invalid schema identifier. Tenant={Tenant} Schema={Schema}",
                            kvp.Key,
                            kvp.Value.Schema
                        )

                        allValid <- false
                    | Ok schema ->
                        let tenantContext = {
                            TenantId = TenantId kvp.Key
                            Schema = schema
                            DataSourceAlias = kvp.Value.DataSourceAlias
                        }

                        try
                            use! conn = factory.CreateOpenConnectionAsync(tenantContext, ct)
                            let! missing = DbSchemaValidator.validateSchema conn (TenantSchema.value schema) ct

                            if missing.IsEmpty then
                                logger.LogInformation(
                                    Events.DbSchemaValid,
                                    "Schema valid. Tenant={Tenant} Schema={Schema}",
                                    kvp.Key,
                                    kvp.Value.Schema
                                )
                            else
                                for missingObject in missing do
                                    logger.LogCritical(
                                        Events.DbObjectMissing,
                                        "Missing DB object: {Object} Tenant={Tenant}",
                                        missingObject,
                                        kvp.Key
                                    )

                                allValid <- false
                        with ex ->
                            logger.LogCritical(
                                Events.DbStartupValidationFailed,
                                ex,
                                "Cannot connect for tenant '{Tenant}'. Aborting.",
                                kvp.Key
                            )

                            allValid <- false

                if not allValid then
                    logger.LogCritical(Events.DbStartupValidationFailed, "DB validation failed. Stopping application.")
                    hostLifetime.StopApplication()
                    return raise (InvalidOperationException("DB startup validation failed."))
            }

        member _.StopAsync(_ct: CancellationToken) = Task.CompletedTask
