namespace Effinsty.Application

open System
open System.Data
open System.Threading
open System.Threading.Tasks
open Effinsty.Domain

type LoginCommand = {
    Username: string
    Password: string
}

type RefreshCommand = {
    RefreshToken: string
}

type ContactCreateCommand = {
    UserId: UserId
    FirstName: string
    LastName: string
    Email: string option
    Phone: string option
    Address: string option
    Metadata: Map<string, string>
}

type ContactUpdateCommand = {
    ContactId: ContactId
    UserId: UserId
    FirstName: string option
    LastName: string option
    Email: string option
    Phone: string option
    Address: string option
    Metadata: Map<string, string> option
}

type PagedResult<'T> = {
    Items: 'T list
    Page: int
    PageSize: int
    TotalCount: int
}

type SessionRecord = {
    SessionId: string
    UserId: UserId
    TenantId: TenantId
    RefreshToken: string
    ExpiresAt: DateTimeOffset
}

type IAuthService =
    abstract member LoginAsync: TenantContext * string * LoginCommand * CancellationToken -> Task<Result<AuthToken, AppError>>
    abstract member RefreshAsync: TenantContext * string * RefreshCommand * CancellationToken -> Task<Result<AuthToken, AppError>>
    abstract member LogoutAsync: TenantContext * string * RefreshCommand * CancellationToken -> Task<Result<unit, AppError>>

type IContactService =
    abstract member ListAsync:
        TenantContext * string * UserId * int * int * CancellationToken -> Task<Result<PagedResult<Contact>, AppError>>

    abstract member GetAsync:
        TenantContext * string * UserId * ContactId * CancellationToken -> Task<Result<Contact, AppError>>

    abstract member CreateAsync:
        TenantContext * string * ContactCreateCommand * CancellationToken -> Task<Result<Contact, AppError>>

    abstract member UpdateAsync:
        TenantContext * string * ContactUpdateCommand * CancellationToken -> Task<Result<Contact, AppError>>

    abstract member DeleteAsync:
        TenantContext * string * UserId * ContactId * CancellationToken -> Task<Result<unit, AppError>>

type IContactRepository =
    abstract member ListAsync: TenantContext * string * UserId * int * int * CancellationToken -> Task<Contact list>
    abstract member CountAsync: TenantContext * string * UserId * CancellationToken -> Task<int>
    abstract member GetByIdAsync: TenantContext * string * UserId * ContactId * CancellationToken -> Task<Contact option>
    abstract member ExistsByEmailAsync:
        TenantContext * string * UserId * string * ContactId option * CancellationToken -> Task<bool>

    abstract member CreateAsync: TenantContext * string * Contact * CancellationToken -> Task<Contact>
    abstract member UpdateAsync: TenantContext * string * Contact * CancellationToken -> Task<Contact>
    abstract member DeleteAsync: TenantContext * string * UserId * ContactId * CancellationToken -> Task<bool>

type ITenantResolver =
    abstract member ResolveAsync: string option * CancellationToken -> Task<Result<TenantContext, AppError>>

type IOracleConnectionFactory =
    abstract member CreateOpenConnectionAsync: TenantContext * CancellationToken -> Task<IDbConnection>

type IUserRepository =
    abstract member FindByUsernameAsync: TenantContext * string * string * CancellationToken -> Task<User option>
    abstract member FindByIdAsync: TenantContext * string * UserId * CancellationToken -> Task<User option>

type IPasswordHasher =
    abstract member Verify: plainText: string * hashed: string -> bool

type ITokenProvider =
    abstract member IssueTokens: User * TenantContext -> Result<AuthToken, AppError>
    abstract member ValidateRefreshToken: string -> Result<RefreshTokenPayload, AppError>

type ISessionStore =
    abstract member SaveAsync: SessionRecord * CancellationToken -> Task
    abstract member GetAsync: sessionId: string * CancellationToken -> Task<SessionRecord option>
    abstract member DeleteAsync: sessionId: string * CancellationToken -> Task
