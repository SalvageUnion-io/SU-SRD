# In The Union Now — Legacy Archive

> **Frozen.** This directory is preserved as a read-only reference snapshot of
> the pre-revamp ITUN. The active character builder lives at
> [`../in-the-union-now/`](../in-the-union-now/).

## Status

- **Archived:** Wave 0 of the ITUN revamp (commit `700d5e56`, 2026-05-17). The
  directory was renamed `apps/in-the-union-now → apps/itun-legacy` via `git mv`
  so commit history is preserved on the files themselves.
- **Maintenance policy:** None. No new features, no bug fixes, no dependency
  bumps. CI skips this package for tests and knip analysis; lint/format/
  typecheck still run.
- **Buildability:** Not guaranteed. Per `ideate/PRD.md` R-8, the archive's
  reference value is **conceptual, not executable** — dependencies will rot
  and the app may stop building over time. If it still runs today, that is a
  bonus, not a promise.
- **Backend:** The legacy Supabase project (`dshtuchbleipwqacyokz`) is
  decommissioned. Any `bun run dev:itun-legacy` against current Supabase
  state will fail at auth / first query.

## Why it exists

Two purposes only:

1. **Pattern mining.** When implementing a feature in the new app, search
   here first for prior-art implementation — UI primitives, Zod schemas,
   Zustand store shapes, Supabase query patterns. Don't import; transcribe
   intentionally.
2. **Provenance.** The revamp's PRD (`ideate/PRD.md`) and architecture
   audit reference legacy decisions; this archive lets those references
   resolve to actual code instead of dangling commit SHAs.

## What replaced it

| Concern       | Legacy location                      | Replacement                                      |
| :------------ | :----------------------------------- | :----------------------------------------------- |
| Builder app   | `apps/itun-legacy/`                  | [`apps/in-the-union-now/`](../in-the-union-now/) |
| Dev command   | `bun run dev:itun-legacy`            | `bun run dev:itun`                               |
| Build command | `bun run build:itun-legacy`          | `bun run build:itun`                             |
| Game data     | `salvageunion-reference` (unchanged) | `salvageunion-reference` (unchanged)             |
| Shared UI     | `suref-react` (unchanged)            | `suref-react` (unchanged)                        |

## Release tag

The release process for the revamp tags this archive at deploy-swap time
so the legacy state is permanently addressable from the GitHub tag list:

```bash
# Run by maintainer at M3 release (do not push from agent sessions):
git tag -a itun-legacy-archive 700d5e56 \
  -m "Final legacy ITUN state; archived Wave 0 of itun-revamp"
git push origin itun-legacy-archive
```

After the tag exists, prefer `git show itun-legacy-archive:apps/itun-legacy/...`
over reading the working tree for any historical lookups.

## Do not

- Add dependencies, edit code, or open PRs targeting files under
  `apps/itun-legacy/`. Forward all builder work to `apps/in-the-union-now/`.
- Re-enable `apps/itun-legacy/` in CI test or `knip` runs without an explicit
  decision to un-archive (which would require restoring Supabase and reverting
  the policy in this README).
- Treat the legacy `CLAUDE.md` in this directory as current guidance for new
  work. It documents the legacy stack for pattern-mining context only.
