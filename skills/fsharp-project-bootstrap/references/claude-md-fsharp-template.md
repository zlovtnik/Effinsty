# CLAUDE.md Template For F# Repositories

Copy this template into the root `CLAUDE.md` file and adapt project-specific names.

## Build And Test Commands

- Restore tools/packages: `dotnet restore`
- Build: `dotnet build`
- Test: `dotnet test`

Run build and tests before handing work back.

## F# Coding Rules

- Prefer records and discriminated unions for domain modeling.
- Prefer pure functions and explicit inputs/outputs over mutable shared state.
- Keep modules small and cohesive.
- Avoid hidden side effects in core business logic.
- Treat warnings and compiler messages as required follow-up work.

## Project Structure

- Place production code in `src/`.
- Place tests in `tests/`.
- Keep one primary project per folder with matching folder and `.fsproj` names.

## Quality Gate

Complete a task only when:

- `dotnet build` passes.
- `dotnet test` passes (if tests exist).
- New code aligns with domain-first F# modeling and functional style.
- Changes include brief rationale in commit or PR notes when architecture changes.

## Agent Behavior

- Explain tradeoffs when changing domain types or public APIs.
- Prefer minimal, safe edits over broad refactors unless explicitly requested.
- If project commands fail, report exact failing command and output summary.
