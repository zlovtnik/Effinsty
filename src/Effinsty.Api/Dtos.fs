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
type RefreshRequest = {
    RefreshToken: string
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
type LoginResponse = {
    AccessToken: string
    RefreshToken: string
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
    let toLoginResponse (token: AuthToken) =
        {
            AccessToken = token.AccessToken
            RefreshToken = token.RefreshToken
            ExpiresAt = token.ExpiresAt
        }

    let toContactResponse (contact: Contact) =
        {
            Id = ContactId.value contact.Id
            FirstName = contact.FirstName
            LastName = contact.LastName
            Email = contact.Email
            Phone = contact.Phone
            Address = contact.Address
            Metadata = Dictionary<string, string>(contact.Metadata)
            CreatedAt = contact.CreatedAt
            UpdatedAt = contact.UpdatedAt
        }

    let toPagedResponse (value: PagedResult<Contact>) =
        {
            Items = value.Items |> List.map toContactResponse
            Page = value.Page
            PageSize = value.PageSize
            TotalCount = value.TotalCount
        }
