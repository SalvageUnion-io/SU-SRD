---
name: build-package
description: Rebuild the salvageunion-reference package and typecheck the monorepo
allowed-tools: Bash
---

# Build Package

Rebuild the `salvageunion-reference` package and run typecheck across the monorepo.

Steps:

1. Run `bun run build:package` from the repo root
2. Run `bun run typecheck` to verify types across all packages
3. Report any errors found
