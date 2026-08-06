---
name: validate
description: Run the full CI check suite (lint, format, typecheck, test, validate)
allowed-tools: Bash
---

# Validate

Run the full CI check suite to verify everything passes.

Steps:

1. Run `bun run check:all` from the repo root
2. Report any failures with clear context about what needs fixing

## What `check:all` actually runs

It is **not** one parallel batch — the order matters when you are reading a
failure:

1. `check:schemas` — first, and on its own.
2. `lint` + `format:check` — in parallel.
3. `typecheck` — **serially**, after those.
4. `test`, `validate:all`, `knip`, `check:audit`, `check:tokens`,
   `check:styling` — in parallel.

So a typecheck failure stops everything downstream of it, and knip / audit /
tokens / styling are part of this gate even though they are easy to forget.

For the ~12s inner-loop subset, use `bun run check:fast` instead.
