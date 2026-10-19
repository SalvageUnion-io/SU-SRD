# AGENTS.md

Guidance for every coding agent here. Instructions only: history is in git.

## Where things are

- **Find a doc:** [`docs/README.md`](docs/README.md) maps a task to its doc. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is what is true now (Areas by slug, `#convex`) and the decisions (grep `ADR-NNN`); §-cited ADRs keep their text in [`docs/adr/`](docs/adr/).
- **Before rules work:** [ADR-021](docs/adr/021-cantina-surface-taxonomy.md) (which surface enforces a rule) and [ADR-007](docs/adr/007-automation-boundary.md) (never destroy without the player). Accounts and Games: [ADR-030](docs/adr/030-accounts-games-server-of-record.md).
- **Path rules:** the [`.claude/rules/`](.claude/rules/) whose `paths:` match your files, and the workspace's `CLAUDE.md`.
- **Rules text:** gitignored here; the private `SalvageUnion-io/su-rules` is the source. Locally `bun run rules:extract`; in the cloud attach `su-rules` as a second repo. Then `bun run rules:find <term>`.
- **Artwork** never lives in git: `apps/su-assets/` serves it from R2.

## Critical Rules

- Do NOT add features, schema changes, or UI elements that were not explicitly requested. Mention extra ideas as suggestions; do not implement them.
- When the user asks to 'plan' or 'prepare' something, the scope is the document/plan only — do not begin implementation unless explicitly asked.

## UI Development

- Reuse `apps/web/src/components` (`ReferenceEntityCard` for every SRD entity, `Box` for everything else) before building one-off UI.
- Get CSS right first time by reasoning about the rendering context (float does nothing in grid/flex). Verify a visual change yourself: `bun run shot </route|app:/route> --width phone|column|page` prints PNGs to read.
- Entity lists are compact, header-only, clickable; nested entities render inside the parent's expanded view, never as separate grids. Ask if unsure how much detail to show.
- Styling is tokens, style objects and one stylesheet ([`.claude/rules/styling.md`](.claude/rules/styling.md)); never a utility class.
- A prop that must reach nested entity cards is passed explicitly (there is no shared display context); typecheck immediately.

## Build & Validation

After any cross-package change, run typecheck, tests and lint, and check every consuming app (stylesheet imports, package `exports`).

```bash
bun install                        # postinstall builds the reference schemas and the git hooks
bun run dev                        # the app (reference pages + the client app at /build) on a local Convex backend
bun run check:fast                 # the inner loop: every gate but the suite, the network and regeneration
bun run check [<id> …]             # every gate (or just those); `--list` names each with its fix
bun run test                       # full suite; one workspace: bun --filter <workspace> test
bun run lint | format | typecheck  # Biome is the only formatter; .md/.yml are formatted by nothing
bun run build                      # reference generation + the app in one Vite pass
```

- A failed gate prints its fix. A new gate goes in the registry in `tools/check.ts`, which `check`, pre-push and CI all read.
- Pre-commit runs `biome check --write` on staged files; pre-push runs the gates but no tests, so run the suites you touched. Raise a test's timeout only for a measured intrinsic cost, never for contention.

## Code Conventions

- Biome is the authority on imports, types and exports (`bun run lint`). **Bun** only, never npm/yarn.
- Game-data types come from `salvageunion-reference` as `Ref*` (`RefChassis`, …). Generated files are never hand-edited.
- Entity links use slugs, never UUIDs: `/chassis/mule/`.
- Never run JSON data through a formatter that reflows arrays (`json.dump`); edit at the text level.
- Styling bug: check the stylesheet wiring (`entry.css`'s layers, the app's import of it) before component or data logic.

## Merging

`main` requires linear history and status checks; no merge queue. Squash-merge (`gh pr merge <pr> --squash`; cloud: [cloud sessions](docs/ARCHITECTURE.md#cloud)); the squash body is the PR body. Each PR bumps the root `package.json` version (CI-enforced); merging releases it.

Dependent PRs land only as a `gh stack` (local-only): `submit --auto --open`, then `merge --squash`; after a merge beneath you, `gh stack sync`. Never a hand rebase or `--force`. Stack state is per worktree (`gh stack checkout <pr>`).
