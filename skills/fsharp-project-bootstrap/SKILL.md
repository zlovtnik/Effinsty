---
name: fsharp-project-bootstrap
description: Scaffold new F# repositories with a consistent `src/` + `tests/` layout, solution wiring, and AI-agent coding conventions. Use when creating a new F# project, restructuring an early F# repo, or adding/refreshing `CLAUDE.md` guidance so coding agents follow idiomatic F# practices.
---

# Fsharp Project Bootstrap

Scaffold a production-ready baseline for F# projects quickly and consistently.

## Workflow

1. Inspect repository state.
- Detect `.sln` and `.fsproj` files with `rg --files -g '*.sln' -g '*.fsproj'`.
- If a solution already exists, skip full bootstrap and only add missing pieces.

2. Generate or extend the solution.
- For a brand-new repo, run `scripts/bootstrap_fsharp_project.sh`.
- Default to:
  - solution root at repository root
  - app project in `src/<ProjectName>/`
  - test project in `tests/<ProjectName>.Tests/`
- Use `--template webapi` for backend APIs, `--template classlib` for libraries, or leave default `console`.

3. Apply agent-facing coding conventions.
- Create or update `CLAUDE.md` at repository root.
- Use [references/claude-md-fsharp-template.md](references/claude-md-fsharp-template.md) as the baseline.
- Keep conventions concrete and executable (build command, test command, style constraints, definition of done).

4. Verify outputs.
- Confirm expected files exist: `.sln`, `src/*/*.fsproj`, `tests/*/*.fsproj`, `CLAUDE.md`.
- Run `dotnet build` and `dotnet test` when the environment supports .NET SDK.

## Commands

```bash
# console app + tests (default)
scripts/bootstrap_fsharp_project.sh MyApp

# web API + tests
scripts/bootstrap_fsharp_project.sh MyApi --template webapi

# class library without tests
scripts/bootstrap_fsharp_project.sh MyLibrary --template classlib --no-tests

# preview commands only
scripts/bootstrap_fsharp_project.sh MyApp --dry-run
```

## Conventions To Enforce

- Prefer immutable data and pure functions where possible.
- Model domain with discriminated unions and records before classes.
- Keep modules small and focused; avoid god modules.
- Treat compiler warnings as actionable work, not noise.
- Keep a green feedback loop: build frequently and run tests before finalizing.
