# Verify
Run the full verification suite in order:
1. `bun run typecheck` (TypeScript check all packages)
2. `bun run lint` (lint all packages)
3. `bun run format` (format check all packages)
4. `bun test` (run all tests)

Report results as a summary table. If any step fails, fix the issue and re-run only the failed step.
