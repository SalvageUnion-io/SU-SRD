## Convex AI files

The block below is managed by the Convex CLI (`convex ai-files`), which
rewrites everything between its markers: amend it here, never inside it.

- **Its guidelines mandate is scoped to `convex/**`.** Read
  `convex/_generated/ai/guidelines.md` before editing a file under `convex/`;
  work elsewhere in the Cantina does not need it.
- **This repo uses `bunx`; `npx` is denied.** Run every `npx convex …` the
  block or a vendored skill names as `bunx convex …`.
- **The vendored skills are a subset** of `get-convex/agent-skills`: the
  folders in `.claude/skills/`, one per `skills-lock.json` entry; there is no
  `.agents/`. Skills for things this app does not use (billing, AI agents,
  domains, components, Sentinel, scaffolding, the transcript upload) are left
  out; vendor another only when the owner asks.
- **Updating them:** never `convex ai-files install` (it installs the full
  set). In a scratch directory run `bunx skills@latest add
  get-convex/agent-skills --all --yes --copy`, then copy here only the
  `.claude/skills/` folders and `skills-lock.json` entries already listed, and
  check that the two still match. Never edit a vendored `SKILL.md` (the lock
  hashes it); repo notes go below. Deployments and repairs go through
  [convex-ops](../../.claude/skills/convex-ops/SKILL.md).

### Where a vendored skill meets this repo

- **Hand-offs to skills left out:** a kept skill that defers to `convex-expert`
  writes the code itself under `convex/_generated/ai/guidelines.md`; one that
  defers to `convex-advisor` hands perf to `convex-optimize` or `convex-cost`.
- **Authz** (`convex-authz`, `convex-verify`): the guards are
  `convex/model/permissions.ts` (`requireUser`, `requireMember`,
  `requireMediator`, …) on `@convex-dev/auth`; harden with those, never a new
  `requireIdentity`/`requireOwner`.

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
- **Errors** (`convex-monitor`, `convex-insights`, `convex-self-heal`): Convex
  errors already reach Workers Issues through the log stream (convex-ops section
  on error reporting); do not add Sentinel.
- **Adding things** (`convex-add`, `convex-auth`, `convex-crons`): auth is
  already `@convex-dev/auth` (`convex/auth.ts`), crons live in
  `convex/crons.ts`, and nothing is added unless the owner asked for it (root
  `CLAUDE.md`). A new package follows the root dependency rules: `bun add`,
  never npm or pnpm.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
