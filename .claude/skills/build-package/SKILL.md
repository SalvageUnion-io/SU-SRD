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
3. **Commit whatever `build:package` regenerated.** CI runs the generator again
   and fails the build if the committed output differs, so stopping at step 2
   leaves CI red even though everything passed locally. The four paths it
   checks:
   - `packages/salvageunion-reference/schemas/`
   - `packages/salvageunion-reference/lib/generated/`
   - `packages/salvageunion-reference/lib/index.ts` (the marker-injected
     static-accessor block)
   - `packages/salvageunion-reference/etc/`
4. Report any errors found

`git diff --stat -- packages/salvageunion-reference` after step 1 is the quick
way to see whether step 3 has anything to do.
