namespace Effinsty.Api

open System
open System.Collections.Generic
open Effinsty.Application
open Effinsty.Domain

[<CLIMutable>]
type LoginRequest = {
    Username: string
    Password: string
}

[<CLIMutable>]
type ContactCreateRequest = {
    FirstName: string
    LastName: string
    Email: string
    Phone: string
    Address: string
    Metadata: Dictionary<string, string>
}

[<CLIMutable>]
type ContactUpdateRequest = {
    FirstName: string
    LastName: string
    Email: string
    Phone: string
    Address: string
    Metadata: Dictionary<string, string>
}

[<CLIMutable>]
type AuthSessionResponse = {
    ExpiresAt: DateTimeOffset
}

[<CLIMutable>]
type ContactResponse = {
    Id: Guid
    FirstName: string
    LastName: string
    Email: string option
    Phone: string option
    Address: string option
    Metadata: Dictionary<string, string>
    CreatedAt: DateTimeOffset
    UpdatedAt: DateTimeOffset
}

[<CLIMutable>]
type PagedResponse<'T> = {
    Items: 'T list
    Page: int
    PageSize: int
    TotalCount: int
}

[<CLIMutable>]
type ErrorResponse = {
    Code: string
    Message: string
    Details: string list
    CorrelationId: string
}

module Mapping =
    let toAuthSessionResponse (token: AuthToken) =
        {
            ExpiresAt = token.ExpiresAt
        }

    let toContactResponse (contact: Contact) =
        let safeMetadata =
            if isNull (box contact.Metadata) then
                Map.empty
            else
                contact.Metadata

        {
            Id = ContactId.value contact.Id
            FirstName = contact.FirstName
            LastName = contact.LastName
            Email = contact.Email
            Phone = contact.Phone
            Address = contact.Address
            Metadata = Dictionary<string, string>(safeMetadata |> Map.toSeq |> dict)
            CreatedAt = contact.CreatedAt
            UpdatedAt = contact.UpdatedAt
        }

    let toPagedResponse (value: PagedResult<Contact>) : PagedResponse<ContactResponse> =
        {
            Items = value.Items |> List.map toContactResponse
            Page = value.Page
            PageSize = value.PageSize
            TotalCount = value.TotalCount
        }
