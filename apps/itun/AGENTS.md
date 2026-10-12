## Convex AI files

The block below is managed by the Convex CLI (`convex ai-files`), which
rewrites everything between its markers: amend it here, never inside it.

- **Its guidelines mandate is scoped to `convex/**`.** Read
  `convex/_generated/ai/guidelines.md` before editing a file under `convex/`;
  work elsewhere in ITUN does not need it.
- **This repo uses `bunx`; `npx` is denied.** Run every `npx convex …` the
  block or a vendored skill names as `bunx convex …`.
- **The vendored skills are the six in `skills-lock.json`** (`convex`,
  `convex-reviewer`, `convex-test`, `convex-authz`, `convex-migrate`,
  `convex-docs`), in `.claude/skills/` only; there is no `.agents/`.
  `ai-files install` / `update` reinstall the whole upstream set into both, so
  prune back to the lock afterwards. Where a kept skill names a dropped one
  (`convex-expert`), read the guidelines file; deployments and repairs go
  through [convex-ops](../../.claude/skills/convex-ops/SKILL.md).

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
