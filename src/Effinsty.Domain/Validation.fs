namespace Effinsty.Domain

open System
open System.Text.RegularExpressions

type ContactDraft = {
    FirstName: string
    LastName: string
    Email: string option
    Phone: string option
    Address: string option
    Metadata: Map<string, string>
}

module Validation =
    let private emailRegex = Regex("^[^@\s]+@[^@\s]+\.[^@\s]+$", RegexOptions.Compiled)
    let private tenantRegex = Regex("^[a-zA-Z0-9_-]{1,64}$", RegexOptions.Compiled)
    let private schemaRegex = Regex("^[A-Z][A-Z0-9_]{0,29}$", RegexOptions.Compiled)

    let normalizeEmail (email: string) =
        if isNull email then
            nullArg (nameof email)

        email.Trim().ToLowerInvariant()

    let normalizePhone (phone: string) =
        if isNull phone then
            nullArg (nameof phone)

        phone
        |> Seq.filter Char.IsDigit
        |> Seq.toArray
        |> String

    let validateTenantId (value: string) =
        if String.IsNullOrWhiteSpace(value) then
            Error (ValidationError [ "Tenant id is required." ])
        else
            let trimmedValue = value.Trim()

            if tenantRegex.IsMatch(trimmedValue) then
                Ok (TenantId(trimmedValue.ToLowerInvariant()))
            else
                Error (ValidationError [ "Tenant id contains invalid characters." ])

    let validateTenantSchema (value: string) =
        if String.IsNullOrWhiteSpace(value) then
            Error (ValidationError [ "Tenant schema is required." ])
        elif schemaRegex.IsMatch(value.Trim().ToUpperInvariant()) then
            Ok (TenantSchema(value.Trim().ToUpperInvariant()))
        else
            Error (ValidationError [ "Tenant schema must match ^[A-Z][A-Z0-9_]{0,29}$." ])

    let validateContactDraft
        (firstName: string)
        (lastName: string)
        (email: string option)
        (phone: string option)
        (address: string option)
        (metadata: Map<string, string>) =
        let errors = ResizeArray<string>()

        if isNull firstName then
            nullArg (nameof firstName)

        if isNull lastName then
            nullArg (nameof lastName)

        let first = firstName.Trim()
        let last = lastName.Trim()

        if String.IsNullOrWhiteSpace(first) then
            errors.Add("FirstName is required.")

        if String.IsNullOrWhiteSpace(last) then
            errors.Add("LastName is required.")

        let normalizedEmail =
            email
            |> Option.map normalizeEmail
            |> Option.bind (fun item ->
                if String.IsNullOrWhiteSpace(item) then
                    None
                elif emailRegex.IsMatch(item) then
                    Some item
                else
                    errors.Add("Email format is invalid.")
                    None)

        let normalizedPhone =
            phone
            |> Option.map normalizePhone
            |> Option.bind (fun item ->
                if String.IsNullOrWhiteSpace(item) then
                    None
                elif item.Length < 10 || item.Length > 15 then
                    errors.Add("Phone number must contain 10 to 15 digits.")
                    None
                else
                    Some item)

        let normalizedAddress =
            address
            |> Option.map (fun item -> item.Trim())
            |> Option.bind (fun item -> if String.IsNullOrWhiteSpace(item) then None else Some item)

        let normalizedMetadata =
            metadata
            |> Map.toList
            |> List.choose (fun (key, value) ->
                let cleanKey = key.Trim()
                let cleanValue = value.Trim()

                if String.IsNullOrWhiteSpace(cleanKey) || String.IsNullOrWhiteSpace(cleanValue) then
                    None
                else
                    Some(cleanKey, cleanValue))
            |> Map.ofList

        if errors.Count > 0 then
            Error (ValidationError(List.ofSeq errors))
        else
            Ok {
                FirstName = first
                LastName = last
                Email = normalizedEmail
                Phone = normalizedPhone
                Address = normalizedAddress
                Metadata = normalizedMetadata
            }
