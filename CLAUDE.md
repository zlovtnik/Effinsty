# Effinsty.Api Agent Guidelines

## Build And Test Commands

- Restore: `dotnet restore Effinsty.Api.sln`
- Build: `dotnet build Effinsty.Api.sln`
- Test: `dotnet test Effinsty.Api.sln`

Run restore/build/tests before finishing implementation work.

## F# Coding Rules

- Prefer records and discriminated unions for domain modeling.
- Keep business logic in pure functions where possible.
- Keep modules focused; avoid large utility grab-bags.
- Favor `Result` and `Option` over exceptions for expected control flow.
- Treat compiler warnings as follow-up work.

## Project Structure

- `src/Effinsty.Domain`: domain types and validation.
- `src/Effinsty.Application`: use-cases and interfaces.
- `src/Effinsty.Infrastructure`: Oracle/Redis/JWT adapters.
- `src/Effinsty.Api`: Giraffe HTTP entrypoint.
- `tests/*`: unit and integration suites.
