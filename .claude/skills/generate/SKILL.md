---
name: generate
description: Run code generation for salvageunion-reference and validate output
allowed-tools: Bash
---

# Generate

Run code generation for the `salvageunion-reference` package and validate the output.

Steps:
1. `cd packages/salvageunion-reference && bun run generate`
2. `bun run validate:all` from the repo root to check IDs and cross-references
3. `bun run typecheck` to verify generated types compile
4. Report any validation or type errors
