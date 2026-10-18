## Convex AI files

The block below is managed by the Convex CLI (`convex ai-files`), which
rewrites everything between its markers: amend it here, never inside it.

- **Its guidelines mandate is scoped to `convex/**`.** Read
  `convex/_generated/ai/guidelines.md` before editing a file under `convex/`;
  work elsewhere in the app does not need it.
- **This repo uses `bunx`; `npx` is denied.** Run every `npx convex …` the
  block or a vendored skill names as `bunx convex …`.
- **The vendored skills are the full upstream set** (`get-convex/agent-skills`,
  all of `skills-lock.json`), in `.claude/skills/` only; there is no
  `.agents/`. Update them with `bunx skills@latest add get-convex/agent-skills
  --all --yes --copy` in a scratch directory, then copy its `.claude/skills/`
  and `skills-lock.json` here; never edit a vendored `SKILL.md` (the lock
  hashes it). Repo notes go below. Deployments and repairs go through
  [convex-ops](../../.claude/skills/convex-ops/SKILL.md).

### Where a vendored skill meets this repo

- **Tests** (`convex-test`, `convex-verify`, `convex-self-heal`): `convex-test`
  runs under `bun test`, not Vitest. Build it with `testConvex()` from
  `test/convex/harness.ts`, never `import.meta.glob`, and put tests in
  `test/convex/__tests__/`.
- **Production** (`convex-deploy-guard`, `convex-migrate`,
  `convex-migrate-rehearse`, `convex-backup`, `convex-seed`, `convex-env`):
  nothing here runs `convex deploy`. Merging to `main` deploys the backend
  (`deploy-cloudflare.yml`); `deploy-preview.yml` alone pushes the preview
  backend. A `--prod` command, an `import --replace` or a one-off repair
  follows convex-ops, and needs the owner's word first.
- **Migrations:** `@convex-dev/migrations` is not installed. A schema change
  stays backward-compatible (optional field, backfill, then tighten); adding the
  component is a dependency change.
- **Docs** (`convex-docs`): the pinned version is the root `catalog:` entry;
  context7 serves its docs.
- **Errors** (`convex-sentinel`, `convex-monitor`, `convex-insights`): Convex
  errors already reach Workers Issues through the log stream (convex-ops section
  on error reporting); do not add Sentinel.
- **Adding things** (`convex-add`, `convex-auth`, `convex-agent`,
  `convex-billing`, `convex-crons`, `convex-domains`, `convex-suggest`,
  `convex-quickstart`, `convex-create-component`): auth is already
  `@convex-dev/auth` (`convex/auth.ts`), crons live in `convex/crons.ts`, and
  nothing is added unless the owner asked for it (root `CLAUDE.md`). A new
  package follows the root dependency rules: `bun add`, never npm or pnpm.
- **`convex-improve-convex-plugin`** sends the session transcript to Convex: run
  it only when the owner asks in so many words.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
