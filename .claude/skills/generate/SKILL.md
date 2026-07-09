---
name: generate
description: Run code generation for salvageunion-reference and validate output
allowed-tools: Bash
---

# Generate

Build the `salvageunion-reference` package (which generates JSON Schema files from Zod schemas) and validate the output.

JSON Schema generation (`generate:json-schemas`) runs automatically as part of `bun run build` in the package. There is no standalone `generate` command.

Steps:

1. Run `bun run build:package` from the repo root (compiles TypeScript and generates JSON schemas)
2. Run `bun run validate:all` from the repo root to check IDs and cross-references
3. Run `bun run typecheck` to verify types compile across all packages
4. Report any validation or type errors
