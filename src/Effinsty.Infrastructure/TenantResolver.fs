namespace Effinsty.Infrastructure

open System
open System.Threading
open System.Threading.Tasks
open Effinsty.Application
open Effinsty.Domain
open Microsoft.Extensions.Options

type TenantResolver(options: IOptions<TenantOptions>) =
    interface ITenantResolver with
        member _.ResolveAsync(headerValue, _ct) =
            task {
                match headerValue with
                | None ->
                    return Error(ValidationError [ "X-Tenant-ID header is required." ])
                | Some rawTenant ->
                    match Validation.validateTenantId rawTenant with
                    | Error err -> return Error err
                    | Ok tenantId ->
                        let tenantKey = TenantId.value tenantId
                        let knownTenants = options.Value.Map

                        if isNull knownTenants || not (knownTenants.ContainsKey(tenantKey)) then
                            return Error(Forbidden "Unknown tenant id.")
                        else
                            let entry = knownTenants.[tenantKey]

                            match Validation.validateTenantSchema entry.Schema with
                            | Error err ->
                                return Error err
                            | Ok schema ->
                                return
                                    Ok {
                                        TenantId = tenantId
                                        Schema = schema
                                        DataSourceAlias = entry.DataSourceAlias
                                    }
            }
