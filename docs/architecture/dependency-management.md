# Dependency management

How this repo pins, shares, audits and prunes its dependencies — and, more
usefully, **why**, since almost every rule here exists because something went
wrong once.

Moved out of the root `CLAUDE.md` on 2026-09-01. It was ~1,490 of that file's
~6,500 words, and the root CLAUDE.md is loaded into **every** session — so this
was a permanent context tax on every task, most of which never touch a
dependency. Much of it was also duplicated verbatim in places an agent can read
on demand: `bunfig.toml` carries a 45-line comment restating the install-cooldown
section, and `.github/workflows/ci.yml` carries the `overrides` watch list.

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
  └─ dev observability@workspace (requires 10.69.0)
     ├─ discord-bot@workspace (requires workspace:*)
     ├─ itun@workspace (requires workspace:*)
```

This example used to be `@netlify/blobs`, and it outlived the package —
printing a dependency tree that no longer existed, three paragraphs under a
heading that says not to trust this prose. Re-derived, not edited.

Use it before editing an `overrides` entry too — the CI comment in
`.github/workflows/ci.yml` documents what each entry holds back and via what,
and that comment can go stale while `bun why` cannot.

**`overrides` is now two entries, and NEITHER is a security floor** — both are
dedupe pins. **Neither is optional, though: do not drop either as install
weight.** `@discordjs/rest` lifts one stale `discord.js` edge onto a version its
own range already allows, so `undici` clears `GHSA-vxpw-j846-p89q` unaided —
which makes that pin the only thing keeping a **HIGH** advisory out of the tree,
dedupe or not;
`@opentelemetry/core` collapses two OTel cores that would otherwise coexist in
one subtree and silently desync `@sentry/node`'s span context. The other six
entries were removed in #787 after measuring what each held back; `ci.yml`
records the per-entry evidence, the watch list and the restore conditions.

**Read that comment before removing an entry here**, because "the audit is still
clean" is necessary but *not sufficient* — `@opentelemetry/core` is the worked
example of a removal that audits clean and still degrades behaviour.

`nanoid` was among the six: it is no longer pinned anywhere, and `3.3.18` holds
only because `postcss`'s `^3.3.17` caret happens to resolve there. That is a
caret, not a guarantee — **`bunfig.toml`'s `minimumReleaseAge` makes a caret
resolve silently *down*** to the newest version old enough (see "Install
cooldown"), where a floor would have errored. So if `bun audit` ever reports
`nanoid`, `fast-uri`, `brace-expansion`, `shell-quote` or `filelist`, the fix is
to restore that package's floor — not to hunt for a new consumer.

**That watch list is manual below `high`.** `check:audit` gates at
`--audit-level=high`, and nothing in `check`, CI or the pre-push hook runs a
bare `bun audit` — so a *moderate* advisory on any of those five (the ReDoS
class they actually draw) fails nothing and is caught only by running
`bun audit` by hand. The `high` gate is unaffected.

# Shared versions live in the catalog

Any dependency used by **two or more** manifests is declared once in the root
`package.json` under `workspaces.catalog` and referenced everywhere as
`"react": "catalog:"`. 20 deps, 49 references. Bump the catalog entry, not the
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
curates `overrides` by hand — every entry documented in `ci.yml`, and as of
#787 that is two dedupe pins with zero security floors — and gates at
`--audit-level=high`. Leaving it on would open PRs editing that block for
advisories `check:audit` deliberately ignores.

`tools/check-doc-drift.ts` resolves `catalog:` one hop when it reads framework
majors; anything else that learns a version by reading a workspace manifest
needs the same treatment.

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
  instead of silently stepping down. **Both current `overrides` entries are
  dedupe pins, not floors** (see "Audit gate"), so nothing here is protected that
  way today. That is the accepted cost of #787, not an oversight — the five
  packages it applies to (`nanoid`, `fast-uri`, `brace-expansion`, `shell-quote`,
  `filelist`) are listed there with the instruction to restore a floor if any of
  them goes red.

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
