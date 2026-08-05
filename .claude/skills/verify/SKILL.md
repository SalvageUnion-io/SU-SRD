---
name: verify
description: Alias of /validate — runs the full CI check suite (lint, format, typecheck, test, validate, knip, audit, tokens, styling)
allowed-tools: Bash
---

# Verify

Alias of `/validate`. Both run the same thing; either name works.

Steps:

1. Run `bun run check:all` from the repo root
2. Report any failures with clear context about what needs fixing

## Why this is an alias and not its own list

This skill used to hand-roll its own sequence, and two steps of it were wrong:

- **Step 4 was `bun test`.** At the time, the root `bunfig.toml` did not carry the
  per-workspace preloads (the reference preload and `fake-indexeddb/auto`), so a bare root
  run failed by the hundreds — measured at 639 failures / 35 errors across 343 files against
  a tree that was actually green. Root `CLAUDE.md` said never to run it, and this skill
  instructed exactly that. The root bunfig now preloads the union of what the workspaces
  need, so `bun test` is no longer a trap; `bun run test` is still the canonical command and
  is what `check:all` runs.
- **Step 3 was `bun run format`**, which _writes_ files. A verification command must not
  mutate the working tree; the check-only form is `format:check`.

Both are covered correctly by `check:all`, so this skill defers to it rather than
maintaining a second, drifting copy of the list.
