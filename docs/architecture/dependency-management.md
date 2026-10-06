# Dependency management

How dependencies are updated, gated and pinned. Read this before editing
`package.json`, `bunfig.toml`, `renovate.json` or `overrides`.

# Updates: Renovate

The hosted Renovate app is the only updater. [`renovate.json`](../../renovate.json)
enables four managers: `bun` (every `package.json` and `bun.lock`),
`github-actions` (the workflows and `.github/actions/setup-bun`),
`bun-version` (`.bun-version`) and `custom.regex` (`.mcp.json`'s `convex@`
pin, kept equal to `apps/itun/package.json`'s by
`tools/__tests__/mcp-config.test.ts`).

- **Non-majors merge themselves.** Every Monday (00:00–04:00 UTC) Renovate opens
  one PR, "all non-major dependencies", holding every minor, patch and digest
  update. It turns on GitHub auto-merge, so the PR squash-merges once the
  ruleset's required checks (`CI Success`, CodeQL, the PR title) pass. The ruleset requires
  an up-to-date branch, so Renovate rebases the PR whenever `main` moves.
- **Lockfile maintenance** runs on the 1st of each month: one auto-merged PR
  that re-resolves `bun.lock` within the existing ranges.
- **Security fixes** come from OSV (`osvVulnerabilityAlerts`) as their own PRs,
  outside the weekly schedule but still after the 3-day age limit.
- **Caret ranges are bumped, not left alone** (`rangeStrategy: bump`). Renovate's
  `bun` manager only runs `bun install` on the edited manifest, so a range that
  still admits the new version would change nothing.
- **Never updated automatically:** the `overrides` block (hand-curated floors,
  below).

Writing the same version into several manifests is fine: Renovate updates every
occurrence in the same grouped PR. There is no Bun catalog, because Renovate's
`bun` manager does not read one.

`bun audit --audit-level=high` gates every PR that changes `bun.lock` or a
`package.json` (the `deps` area of the `static-checks` job); a PR that changes
neither cannot change the verdict, and `audit-watch.yml` audits the unchanged
tree weekly.

## What waits for approval

Two kinds of update wait on the **Dependency Dashboard** issue instead of
opening a PR:

- **Every major.**
- **The Bun toolchain:** `.bun-version`, the root `packageManager` (`bun@…`) and
  the `bun-types` devDependency move as one group. The `workflows` check
  (`bun-version`) fails unless all three are equal, and CI installs the Bun
  that `.bun-version` names.

To approve one, open the issue (`gh issue list --author app/renovate`), tick
its box under "Pending Approval", and Renovate opens the PR on its next run
(roughly hourly). These PRs do not auto-merge: fix what breaks on the branch,
then `gh pr merge <n> --squash`.

The dashboard also lists anything Renovate could not do (a failed lockfile
update, a config error), so it is the first place to look when updates stop.

# Install cooldown (`minimumReleaseAge`)

`bunfig.toml` refuses dependency versions **published less than 3 days ago**,
and `renovate.json` sets the same `minimumReleaseAge` with
`internalChecksFilter: strict`, so Renovate never proposes a version `bun install`
would refuse. Three days is roughly how long a hijacked npm release lasts before
it is noticed and unpublished, and nobody reads the tarballs in an auto-merged PR.

Two behaviours, measured on the pinned Bun (`.bun-version`):

- an **exact pin** the gate cannot satisfy is a hard, self-describing error
  (`... (blocked by minimum-release-age: N seconds)`). Most deps here are exact
  pins, so this is the usual case.
- a **caret range silently resolves *down*** to the newest version old enough.
  No warning. So `bun update <pkg>` to clear a *fresh* advisory can look like it
  did nothing; check the publish date before concluding the fix is broken.

`bun install --frozen-lockfile` does no resolution and is unaffected, so CI and
every deploy never see this gate.

The escape hatch is `minimumReleaseAgeExcludes` (currently `bun-types`, which
must track `.bun-version` exactly), **not** lowering the number.

# Audit

- **Merge gate:** `bun audit --audit-level=high` (the `audit` check, in CI's
  `static-checks` job, on any PR that changes `bun.lock` or a `package.json`).
  If you add an `--ignore`, write down what would remove it, next to it. **One
  is suppressed:** `braces` GHSA-vfj7-8cjw-p6xm (2026-10-06), which has no fixed
  release; it reaches the tree only through component-lib's devDependency
  `@ladle/react` → `globby` → `fast-glob` → `micromatch`, and Ladle globs only
  our own story patterns. The `--ignore` in `tools/check.ts` says what removes
  it; `audit-watch.yml` audits without it, so it stays reported weekly.
- **Below the gate:** `.github/workflows/audit-watch.yml` runs `bun audit` at
  every severity weekly and keeps one tracking issue open while it reports
  anything. The watch list is `nanoid`, `fast-uri`, `brace-expansion` and
  `filelist`, the ReDoS class the tree keeps drawing.
- **When the audit fails on a transitive dep**, the fix is `bun update <pkg>`
  plus the regenerated `bun.lock`. First look for a parent whose own range
  already admits a fixed version (a dedupe); a floor in `overrides` is the last
  resort.

`bun why <pkg>` prints the real path from the lockfile, so any claim about how a
package got into the tree can be checked in one command instead of read.

# The `overrides` block

`package.json` cannot carry comments, so this is the record. **Four entries,
all security floors.**

| Entry | Why |
| --- | --- |
| `fast-uri: >=3.1.6 <4` | ReDoS class; `ajv` asks `^3.0.1`, so a caret step-down could land an in-advisory 3.x. |
| `filelist: >=1.0.6` | `jake` asks `^1.0.4`, which a caret step-down could satisfy with a release below the floor. |
| `nanoid: >=3.3.18` | `GHSA-2v37-7h3g-55p8`; `postcss` asks `^3.3.17`, a caret that only happens to resolve high enough. |
| `sharp: >=0.35.5` | `GHSA-wq5f-xc86-pv6w` (librsvg); `miniflare` (via `wrangler`) pins exactly 0.35.4. Delete once `bun why sharp` shows `miniflare` asking ≥0.35.5. |

- **Floors, never exact versions.** Resolving below a floor errors, where a
  caret steps down silently. An exact override also pins the package *down*,
  so the next advisory fixed one patch above it cannot be cleared by any
  `bun update`. Raise a floor; never freeze it.
- **`brace-expansion` cannot be floored:** the tree holds two copies at
  incompatible majors (`minimatch@10` wants `^5`, `filelist@1` → `minimatch@5`
  wants `^2`), and a tree-wide override would break one of them.
- **An override with nothing left to redirect is deleted.** The test for
  removing one is that `bun why <pkg>` no longer finds the package, not that the
  audit is still clean.
- **To re-derive the block:** empty it, `bun install`, then `bun run check audit`.
  Anything that reappears earned its entry.

# Declare what you import, in the right field

Every workspace declares, in its **own** manifest, each package its shipping
code imports, as a `dependency`: not a `devDependency`, and not a peer the
consumer is trusted to supply. The exception is `react` and `react-dom` in
`component-lib`, which stay peers because each app must supply a single
instance.

The test: if deleting a devDependency would break `bun run build` or a deploy,
it was never a devDependency.

# Dead-code gate (knip)

`bun run knip` runs with **`includeEntryExports: true`**, so it also reports
unused exports of entry files, which is where a workspace package's public API
lives. `srd` and `su-assets` turn it off because their entry files are
framework contracts; `component-lib` keeps it on because its barrel is the
library API.

When knip flags something, delete it. The two escape hatches, both `tags` in
`knip.json`, are `@public` (a deliberate public export or a framework contract)
and `@knipignore` (a false positive you can show is consumed). The procedure is
the `/knip-triage` skill.
