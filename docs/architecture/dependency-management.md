# Dependency management

How this repo pins, shares, audits and prunes its dependencies — and, more
usefully, **why**, since almost every rule here exists because something went
wrong once.

Moved out of the root `CLAUDE.md` on 2026-09-01. It was ~1,490 of that file's
~6,500 words, and the root CLAUDE.md is loaded into **every** session — so this
was a permanent context tax on every task, most of which never touch a
dependency. Much of it was also duplicated verbatim in places an agent can read
on demand: `bunfig.toml` carries a comment restating the install-cooldown
section. The per-entry `overrides` record used to be a ~200-line comment in
`.github/workflows/ci.yml`; it moved here (see "The `overrides` block") because
a workflow file is the wrong place for dependency history, and that comment had
gone stale — it described two entries while the block held six.

Nothing here was cut. Read this file before editing `package.json`,
`bunfig.toml`, the catalog, or `overrides`.

# Audit gate (`check:audit`)

`bun audit --audit-level=high` gates merges via the `static-checks` job, and
`package.json` cannot carry comments, so the reasoning lives here.

**There are no suppressed advisories.** `check:audit` carries no `--ignore`
flags, and a bare `bun audit` reports nothing across 1,049 packages. It used to
suppress two — `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`, both
`image-size <=2.0.2` — behind a page of justification about which code paths
could reach the parser. That justification is now moot rather than merely
satisfied: `bun why image-size` reports the package is not in the lockfile at
all. `@netlify/blobs` was still here when that was written (10.7.13, catalogued);
it simply stopped pulling `image-size`. It has since been removed outright —
`bun why @netlify/blobs` now reports *"No packages matching … found in
lockfile"*. The flags and their rationale were removed together, on this
section's own former instruction that a suppression outliving its cause is how
a real advisory gets hidden.

**If you add an `--ignore` back, write down what would remove it.** A
suppression with no stated exit condition is the failure mode above; the pair
that lived here survived their cause by an unknown number of dependency bumps
because nothing re-derived the chain.

**Re-derive the chain, don't trust this prose.** `bun why <pkg>` prints the real
path from the lockfile, so any claim about how a package got here can be
checked in one command instead of read:

```
$ bun why @sentry/cloudflare
@sentry/cloudflare@10.69.0
  └─ observability@workspace (requires 10.69.0)
     ├─ discord-bot@workspace (requires workspace:*)
     ├─ itun@workspace (requires workspace:*)
```

(It read `dev observability@workspace` until the 2026-09-25 audit, PK-07: all
three Workers import `@sentry/cloudflare` at runtime through
`observability/cloudflare`, so it is a `dependency`, not a devDependency.)

This example used to be `@netlify/blobs`, and it outlived the package —
printing a dependency tree that no longer existed, three paragraphs under a
heading that says not to trust this prose. Re-derived, not edited.

Use it before editing an `overrides` entry too — the record below says what
each entry holds back and via what, and a record can go stale while `bun why`
cannot.

## The `overrides` block

`package.json` cannot carry comments, so this is the record. **Five entries:
one dedupe pin and four security floors.**

| Entry | Kind | Why |
| --- | --- | --- |
| `@discordjs/rest: ^2.6.3` | dedupe pin | `discord.js@14.27.0` → `@discordjs/ws@1.2.3` → `@discordjs/rest@2.6.1`, which pins `undici` at exactly 6.24.1 — HIGH `GHSA-vxpw-j846-p89q` (`< 6.27.0`). 2.6.3 asks `undici ^6.27.0` and is inside `ws`'s own `^2.5.1`, so pinning it is a dedupe rather than a forced upgrade, and `undici` floats clear unaided. |
| `fast-uri: >=3.1.6 <4` | floor | ReDoS class; `ajv` asks `^3.0.1`, so a caret step-down could land an in-advisory 3.x. |
| `filelist: >=1.0.6` | floor | `jake` asks `^1.0.4`, which a caret step-down could satisfy with a release below the floor. |
| `nanoid: >=3.3.18` | floor | `GHSA-2v37-7h3g-55p8`; `postcss` asks `^3.3.17`, a caret that only happens to resolve high enough. |
| `shell-quote: >=1.9.0` | floor | `concurrently` pins exactly 1.9.0 today; the floor keeps a future resolve from stepping below it. |

The four floors were restored in #958 after #787 had removed them. They are
floors rather than exact pins on purpose: `bunfig.toml`'s `minimumReleaseAge`
makes a **caret resolve silently down** to the newest version old enough (see
"Install cooldown"), whereas resolving below an override **errors** — a floor
fails loudly where a caret fails silently. `brace-expansion` is on the watch
list but cannot be floored: the tree holds two copies at incompatible majors
(`minimatch@10` wants `^5`, the `filelist@1` → `minimatch@5` chain wants `^2`),
and a tree-wide override would break one of them.

**`@discordjs/rest` is security-load-bearing even though it is a dedupe.**
Removal condition: when a `discord.js` release ships a `ws` that pulls
`rest >= 2.6.3` itself, delete it — check with `bun why undici`; if it resolves
`>= 6.27.0` unaided, the entry is dead. Also delete it if `discord.js` moves to
a `@discordjs/rest` major, because an override is tree-wide and unconditional
and would silently clamp a `rest@^3` back to 2.6.x.

**`@opentelemetry/core` is gone, and the reason is worth keeping.** It was a
dedupe pin for `@netlify/otel`, which held a second OTel core inside its own
subtree and could desync `@sentry/node`'s span context — the worked example of
a removal that audits clean and still degrades behaviour. When Netlify and the
bot's Node gateway were deleted, `@opentelemetry/core` left the lockfile
entirely (`bun why @opentelemetry/core` finds nothing), so the pin was holding
nothing and was removed with no lockfile change. "The audit is still clean" is
a necessary test for removing an entry, not a sufficient one; "the package is
no longer in the tree" is sufficient.

**How to re-derive the block**, so it can be redone rather than trusted: empty
it, `bun install`, then `bun run check:audit`. Anything that reappears earned
its entry. Then check `bun why` for every dedupe you removed, because a
duplicate copy is not an advisory and the audit will not see it.

**Floors are ranges, never exact versions.** An exact override pins the package
*down* as well as up, so when the next advisory is fixed one patch above it the
override itself holds the vulnerable version in place and no `bun update` can
clear it. `brace-expansion` was hand-bumped that way twice (#565, #673), each
time after an exact pin had blocked every open PR. Raise a floor; never freeze
it.

**When the audit fails on a transitive dep**, the fix is `bun update <pkg>` plus
the regenerated `bun.lock`. A floor on the vulnerable package is the *last*
resort — first look for a parent whose own range already admits a fixed
version, because that is a dedupe rather than a pin (which is exactly how
`@discordjs/rest` replaced an `undici` floor).

**The watch list is manual below `high`.** `check:audit` gates at
`--audit-level=high`, so a *moderate* advisory on `nanoid`, `fast-uri`,
`brace-expansion`, `shell-quote` or `filelist` — the ReDoS class they actually
draw — fails nothing in `check`, CI or the pre-push hook.
`.github/workflows/audit-watch.yml` runs the moderate band weekly and maintains
one tracking issue. If one of them goes red, raise or restore that package's
floor rather than hunting for a new consumer.

Dead floors kept as lessons: an `astro: ^7.1.4` floor (for a second astro tree
`@vite-pwa/astro` pulled in) went with Astro itself (ADR-031); a
`@vitejs/plugin-react-swc: ^4.3.3` dedupe floor no longer reproduces its
problem (Ladle's nested copy is satisfied by the vite Ladle already carries).
Re-measure before restoring either. And do not reach for a blanket `esbuild`
floor for a Ladle-only issue — `convex` deliberately pins esbuild below the
advisory range; move the offending subtree, not every consumer.

# Shared versions live in the catalog

Any dependency used by **two or more** manifests is declared once in the root
`package.json` under `workspaces.catalog` and referenced everywhere as
`"react": "catalog:"`. 17 deps, 44 references (`bun run check:catalog` prints the live count). Bump the catalog entry, not the
workspace — a version literal in a workspace manifest for a catalogued package
is a bug, and it silently un-shares that dep.

Adopting it changed **zero** resolved versions (`bun install` reported
"Checked 953 installs ... (no changes)"); it only changed where the version is
written.

Two things this interacts with, both of which have bitten:

- **`overrides` beats the catalog.** An `overrides` entry forces a version
  tree-wide, so raising a catalogued dep past the range its override allows
  leaves the catalog stating a version that is not what resolves — the catalog
  becomes fiction, silently. **No dependency is currently in both places**, so
  this hazard is dormant, not active — check before assuming it applies.
  `@vitejs/plugin-react-swc` used to be the one example (catalogued *and*
  overridden at `^4.3.3`), which is why `.catalog-updaterc.json` ignored its
  major updates. That override is gone, so the ignore is gone with it and its
  majors are automated like everything else. If you ever add an override for a
  catalogued dep, restore the ignore in the same change.
  (`sharp` is *not* an example of this — it has never had an override. Check
  `overrides` before assuming; `ci.yml`'s audit job asserted a `sharp` override
  that never existed.)
- **Dependabot cannot read `catalog:`.** It will not update catalogued deps
  (dependabot-core #14320) and may strip the `catalog` field from a manifest it
  rewrites (#12522) — both still open.
  `.github/workflows/catalog-update.yml` covers updates instead, pinned to a
  commit SHA because it is a young composite action running in this repo's
  runner. **Delete that workflow when dependabot-core supports `catalog:`.**

`.catalog-updaterc.json` sets `"audit": {"enabled": false}` deliberately — JSON
takes no comments, so the reason lives here. That feature defaults to **on** at
`moderate` severity and writes `overrides` entries automatically; this repo
curates `overrides` by hand — every entry documented above under "The
`overrides` block" — and gates at
`--audit-level=high`. Leaving it on would open PRs editing that block for
advisories `check:audit` deliberately ignores.

`tools/check-doc-drift.ts` resolves `catalog:` one hop when it reads framework
majors; anything else that learns a version by reading a workspace manifest
needs the same treatment.

# Declare what you import, in the right field

Every workspace declares, in its **own** manifest, each package its shipping
code imports — as a `dependency`, not a `devDependency` and not a peer the
consumer is trusted to supply. The 2026-09-25 audit (PK-07) found three ways
this had held only by accident:

- `component-lib` listed `@base-ui/react`, `@randsum/roller`, `clsx`,
  `class-variance-authority`, `lucide-react`, `salvageunion-reference`,
  `sonner` and `tailwind-merge` as **peers**, while srd declared none of them
  and neither app declared `sonner`. They resolved only because the library's
  own devDependency copies happened to be installed. They are now `component-lib`
  `dependencies`. **`react` and `react-dom` stay peers** — they must be a single
  instance per app, so the app supplies them, and both apps do. The apps'
  declarations that only existed to satisfy those peers (`@base-ui/react`,
  `clsx`, `class-variance-authority`, `tailwind-merge`) were removed — knip
  reports them unused once nothing asks for them — and with the library as
  their only consumer those four left the catalog for literal pins in
  `component-lib`, per the two-manifest rule above.
- `qrcode` was a `component-lib` dependency used by one ITUN-only component.
  `SnapshotQr` moved into `apps/itun/src/components/sheet/`, and `qrcode` (plus
  `@types/qrcode`) moved with it.
- `@sentry/cloudflare` was a **devDependency** of `observability`, yet all three
  production Workers import it at runtime through `observability/cloudflare`.

The test: if deleting a devDependency would break `bun run build` or a deploy,
it was never a devDependency.

# Install cooldown (`minimumReleaseAge`)

`bunfig.toml` refuses dependency versions **published less than 3 days ago**.
Dependabot opens *grouped* minor/patch PRs weekly, so reviewing one realistically
means glancing at a list of version numbers — three days is about how long a
hijacked npm release lasts before it is noticed and unpublished, and this makes
such a version unresolvable rather than trusting that glance to catch it.

Two behaviours, measured on the pinned Bun (`.bun-version`) — know which one you are hitting:

- an **exact pin** the gate cannot satisfy is a hard, self-describing error
  (`... (blocked by minimum-release-age: N seconds)`). Most deps here are exact
  pins, so this is the usual case.
- a **caret range silently resolves *down*** to the newest version old enough.
  No warning. So `bun update <pkg>` to clear a *fresh* advisory can look like it
  did nothing — check the publish date before concluding the fix is broken.
  An `overrides` floor is the loud alternative: resolving below one errors
  instead of silently stepping down. **Four of the five `overrides` entries are
  such floors** (`fast-uri`, `filelist`, `nanoid`, `shell-quote`; see "The
  `overrides` block"). `brace-expansion` is the one watched package that cannot
  be floored, so it is the one a caret step-down can still reach silently.

`bun install --frozen-lockfile` does no resolution and is **unaffected** —
verified; CI and all four deploy targets never see this gate.

The escape hatch is `minimumReleaseAgeExcludes` (currently `bun-types`, which
must track `.bun-version` exactly), **not** lowering the number.

# Dead-code gate (knip)

`bun run knip` runs with **`includeEntryExports: true`**, so it also reports unused
exports of _entry_ files — which is where a workspace-internal package's whole
public API lives. Without it knip stays green while an entire export surface rots
(this is how 72 dead exports accumulated in `salvageunion-reference`).

Two escape hatches, both configured via `tags` in `knip.json`:

- **`@public`** — the export is deliberately public or is a framework contract
  invoked rather than imported (e.g. a Cloudflare Worker's default export). Tag the export.
- **`@knipignore`** — a genuine knip false positive. Only use this when you can
  show the export _is_ consumed (e.g. deleting it fails typecheck), and say so in
  the tag comment.

Two workspaces whose entry files legitimately _are_ the public surface set
`includeEntryExports: false` per-workspace: `srd` (`*.page.tsx` route + endpoint
modules, consumed by `ssg/routes.ts` and `ssg/endpoints.ts`) and `su-assets`
(platform handlers).

**`component-lib` is NOT one of them — it sets `includeEntryExports: true`**
(`knip.json`), deliberately and against the same intuition. Its barrel IS the
library API, which is exactly why switching the check off there made the one
workspace where barrel rot matters most the one workspace where it could not be
seen: 28 dead re-exports accumulated behind it, removed in #893. This paragraph
previously listed `component-lib` with the other two, so an agent reading it
would have "restored" the setting that hid them.

When knip flags something, the default is to **delete it** — reach for a tag only
in the two cases above. Deleting dead code often cascades (its callees become dead
in turn), so re-run knip after each removal.
