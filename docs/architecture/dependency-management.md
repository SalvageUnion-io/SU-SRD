# Dependency management

How dependencies are updated, gated and pinned. Read this before editing
`package.json`, `bunfig.toml`, `.github/dependabot.yml` or `overrides`.

# Updates

**No bot updates the Bun dependencies.** Dependabot is the only updater, and
[`.github/dependabot.yml`](../../.github/dependabot.yml) gives it one ecosystem:
GitHub Actions.

- **GitHub Actions:** every Monday Dependabot opens one grouped PR ("ci: bump …
  in the github-actions group") for `.github/workflows/` and
  `.github/actions/setup-bun`, holding back any release younger than 7 days. It
  does not merge itself: read the diff, then `gh pr merge <n> --squash`.
- **Bun dependencies are updated by hand.** `bun outdated --filter='*'` lists
  what is behind in every workspace. Most deps are exact pins, which
  `bun update <pkg>` leaves alone; `bun update --latest <pkg>` (or
  `bun add <pkg>@<version>` in the workspace) moves one. The same version
  written into several manifests is bumped in each. There is no Bun catalog.
- **The Bun toolchain** (`.bun-version`, the root `packageManager` `bun@…` and
  the `bun-types` devDependency) moves as one change. The `workflows` check
  (`bun-version`) fails unless all three are equal, and CI installs the Bun
  that `.bun-version` names.
- **`.mcp.json`'s `convex@` pin** moves with `apps/itun/package.json`'s;
  `tools/__tests__/mcp-config.test.ts` fails if they differ.
- **Never updated automatically or casually:** the `overrides` block
  (hand-curated floors, below).

Nothing opens a PR for a vulnerable Bun dependency. The signals are the
merge-gate audit and `audit-watch.yml`'s weekly issue (below); the fix is a
hand `bun update`.

`bun audit --audit-level=high` gates every PR that changes `bun.lock` or a
`package.json` (the `deps` area of the `static-checks` job); a PR that changes
neither cannot change the verdict, and `audit-watch.yml` audits the unchanged
tree weekly.

# Install cooldown (`minimumReleaseAge`)

`bunfig.toml` refuses dependency versions **published less than 3 days ago**,
and `.github/dependabot.yml` holds Actions updates back for 7 (its `cooldown`;
zizmor's `dependabot-cooldown` audit wants at least 7). Three days is roughly
how long a hijacked npm release lasts before it is noticed and unpublished, and
nobody reads the tarballs of an upgrade.

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
