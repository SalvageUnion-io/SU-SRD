# Migration Plan: Move Entity Artwork off Supabase Storage → Netlify Blobs

**Status:** Implemented (infra live + verified; data rewrite on this branch, pending merge + Supabase decommission)
**Author:** drafted with Claude Code
**Date:** 2026-06-22
**Related:** [ADR-010 — Snapshot Backend (Netlify Functions + Blobs)](../docs/adrs/ADR-010-snapshot-backend.md)

> **See the [Implementation Record](#implementation-record-2026-06-22) at the
> bottom for what was actually built** — the host choice changed from "reuse
> ITUN" to a dedicated `su-assets` site with the custom domain
> `assets.salvageunion.io`, and a few mechanics differ from the plan below.

---

## 1. Goal

Remove the **last functional dependency on Supabase**: image hosting. Today 58
entity-artwork images are served from a public Supabase Storage bucket and
referenced by absolute URL in the shared game data. Moving them to **Netlify
Blobs** (served by a Netlify Function) lets us **decommission the Supabase
project entirely**, after which the remaining Supabase references in the repo
are just dead text to delete.

Chosen approach (confirmed with maintainer):

- **Host:** Netlify Blobs — a service we already operate (ITUN snapshot backend).
- **Bytes stay out of the public git repo.** SU-SRD is **public**, and the
  artwork is flagged _"NOT covered by the licence — used with special permission
  of Leyline Press; do not redistribute"_ (see `apps/suref-web/src/pages/llms.txt.ts`).
  This matches the project's existing posture of keeping copyright-bearing
  source material out of git (the rules PDFs/digest are gitignored). Blobs keeps
  the bytes off git while still serving them publicly — the same public exposure
  they already have today, just on Netlify instead of Supabase.
- **`asset_url` stays absolute.** Purely a data swap; **no rendering-code
  changes** (the value flows `getAssetUrl()` → `<CardImage url={assetUrl}>`).

---

## 2. Current State (verified)

| Fact                             | Detail                                                                                                                                                                     |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image count                      | **58**, all unique, all on one bucket                                                                                                                                      |
| Source                           | `https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/<category>/<file>`                                                                            |
| Categories                       | chassis (30), classes.core (6), classes.hybrid (5), bio-titans (6), creatures (3), meld (3), drones (2), npcs (1), squads (1), vehicles (1)                                |
| Where referenced                 | `asset_url` field in `packages/salvageunion-reference/data/*.json` (shared data package, single source of truth)                                                           |
| Rendered by                      | `suref-react` `ReferenceEntityDisplay` → `getAssetUrl()` → `CardImage` (consumed by **both** suref-web and ITUN)                                                           |
| Also emitted in                  | `apps/suref-web/src/pages/llms.txt.ts` (LLM manifest — wants absolute URLs)                                                                                                |
| Discord bot                      | **Does not** reference `asset_url` (no Discord-embed absolute-URL constraint)                                                                                              |
| Existing Netlify Blobs precedent | ITUN: `apps/in-the-union-now/netlify/functions/`, `@netlify/blobs@^10.7.9`, `getStore('snapshots')`, `src/lib/snapshot/storage.ts` abstraction (InMemoryStorage for tests) |

---

## 3. Target Architecture

```
                       data (asset_url, absolute, in git)
                                   │
       https://<asset-host>/art/chassis/iron-mongrel.jpg
                                   │
                 Netlify redirect: /art/* → /.netlify/functions/asset?key=:splat
                                   │
                    asset Function (reads Blobs, sets Content-Type +
                    immutable Cache-Control so the edge caches the bytes)
                                   │
                       Netlify Blobs store  "lp-assets"
                       key: chassis/iron-mongrel.jpg   ← splat, no "LP-Assets/" prefix
                       metadata: { contentType: "image/jpeg" }
```

> The `LP-Assets/` bucket segment is **dropped** from the public URL — it was a
> Supabase-bucket name, not meaningful structure. Blob key, redirect splat, and
> the `category/file` path all line up: `/art/chassis/x.jpg` → splat
> `chassis/x.jpg` → blob key `chassis/x.jpg`.

**Bytes live only in the Blobs store** — never in git, never in a build
artifact. The store is populated once by an upload script run locally with
Netlify credentials.

### 3.1 Which site hosts the Function?

**Recommended (primary): reuse the ITUN site.** It already has
`@netlify/blobs`, a `netlify/functions/` dir, the `storage.ts` abstraction, and
proven Blobs wiring (ADR-010). Zero new infrastructure — best honors "reuse a
service we already integrate with."

- `asset_url` host becomes the ITUN production domain.
- **Path-collision note:** ITUN (Vite SPA) already serves its build output under
  `/assets/*` (see the `/assets/*` immutable header in `apps/in-the-union-now/netlify.toml`).
  Use a **distinct prefix** — `/art/*` — for the artwork redirect to avoid
  colliding with Vite's hashed assets.

**Alternative: a dedicated `assets.salvageunion.io` Netlify site** (functions +
blobs only). Cleaner, app-independent, stable URLs; decouples artwork
availability from the character-builder app. Cost: +1 small Netlify site to
manage. _Tradeoff to decide at implementation time — the rest of this plan is
identical either way; only the host domain in `asset_url` differs._

> **Cross-app coupling caveat (primary option):** with ITUN as host, suref-web
> (salvageunion.io) loads artwork cross-origin from the ITUN domain, so the
> art's availability is tied to the ITUN site. The dedicated-site alternative
> removes this coupling. Either way, CSP is fine — both apps already ship
> `img-src 'self' data: https:`, and `https:` permits the cross-origin load.
> (If CSP is ever tightened to `'self'`, add the asset host explicitly.)

---

## 4. Work Breakdown

### Phase 0 — Prep (local, no commits)

1. Extract the 58 unique URLs from `packages/salvageunion-reference/data/*.json`.
2. Download each into a **local, gitignored** working dir (e.g. `$TMPDIR/lp-assets/`),
   preserving the `LP-Assets/<category>/<file>` path structure.
3. Record each file's MIME type (by extension / `file --mime-type`) for the
   Blobs `contentType` metadata.

### Phase 1 — Upload script (tooling lives in git; images do not)

Add `tools/upload-lp-assets.ts` (consistent with the precedent that **tooling**
is committed while the copyrighted **content** is not):

- Uses `@netlify/blobs` `getStore({ name: 'lp-assets', siteID, token })` in
  manual mode (reads `NETLIFY_SITE_ID` + `NETLIFY_AUTH_TOKEN` from env — not in git).
- For each local image: `store.set(key, bytes, { metadata: { contentType } })`
  where `key = "<category>/<file>"` (e.g. `chassis/iron-mongrel.jpg` — the
  `LP-Assets/` bucket segment is dropped).
- Idempotent / re-runnable (also the workflow for adding future artwork).
- Dry-run + verify flags (list keys, confirm count == 58).

### Phase 2 — Serving Function

Add `apps/in-the-union-now/netlify/functions/asset.ts` (mirroring the
snapshot-function style and the `storage.ts` test seam):

- Read `key` from query (`?key=chassis/...` via the redirect splat).
- Validate/normalize the key (reject `..` path traversal; allow only
  `<category>/<file>` shapes).
- `getStore('lp-assets').getWithMetadata(key, { type: 'arrayBuffer' })`.
- 404 if missing.
- Return the bytes with:
  - `Content-Type` from stored metadata.
  - `Cache-Control: public, max-age=31536000, immutable` **and**
    `Netlify-CDN-Cache-Control: public, max-age=31536000, immutable` so the
    edge caches the response and the **function runs only on a cache miss**
    (this is the key mitigation for "static art via a function" — egress and
    invocations become negligible after warm-up).
- Unit-test with the InMemoryStorage seam (no live `@netlify/blobs` in tests),
  matching `snapshot.test.ts`.

Add the redirect to `apps/in-the-union-now/netlify.toml`:

```toml
[[redirects]]
  from = "/art/*"
  to = "/.netlify/functions/asset?key=:splat"
  status = 200
  force = true
```

(Place it **before** the SPA `/*` fallback.)

### Phase 3 — Data rewrite (text-level, formatting-preserving)

- Targeted string replace of the **URL prefix only** in each data JSON:
  `https://opxrguskxuogghzcnppk.supabase.co/storage/v1/object/public/LP-Assets/`
  → `https://<asset-host>/art/`
- **Do not** reformat with `json.dump`/Prettier-on-data — per the data
  convention, edit at the text level so array formatting is preserved.
- Re-run `bun run validate:all` and `bun run build:package`.
- Regenerate schema docs (`bun run docs:schemas`) — their `asset_url` examples
  will update to the new host automatically.

### Phase 4 — Verify

- Deploy ITUN (preview deploy). `curl -I` all 58 new URLs → expect `200` +
  correct `image/*` Content-Type + the immutable cache headers.
- Build suref-web; spot-check a chassis page and an ITUN entity card render the
  image from the new host.
- Confirm a cold vs. warm request (first = function, second = edge cache HIT).

### Phase 5 — Decommission Supabase (the milestone)

- Once verified in production, delete the `LP-Assets` bucket and the Supabase
  project `opxrguskxuogghzcnppk`.
- **Rollback before this point** is a one-line revert of the data prefix.

### Phase 6 — Textual cleanup (the original "remove all traces" task)

With the project gone, scrub the remaining **active** Supabase references
(historical ADRs / dated design docs / generated schema docs are left as
historical record per prior decision):

- `.env.example`, `.gitignore` (Supabase CLI cache lines)
- `CLAUDE.md` (project), `apps/suref-web/CLAUDE.md`, `packages/suref-react/CLAUDE.md`, `packages/suref-react/README.md`
- `packages/salvageunion-reference/lib/combatUtils.ts` (stale comment)
- `.claude/rules/monorepo-patterns.md`, `.claude/rules/react-components.md`
- `.claude/agents/ttrpg-ux-designer.md` + its `agent-memory` (both contain
  **outdated** "Supabase for auth/PostgreSQL" claims — ITUN is local-first now)
- `.claude/skills/create-migration/` + its `/create-migration` mention in
  `CLAUDE.md` (Supabase-specific skill, now dead → remove)
- `docs/architecture/data-flow.md` (L9 rebuild note) and
  `docs/architecture/package-contracts.md` (L242, L267)

---

## 5. Risks & Mitigations

| Risk                                         | Mitigation                                                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Per-image function invocation cost / latency | Immutable edge caching (`Netlify-CDN-Cache-Control`); function runs only on cache miss. 58 small images = trivial volume. |
| `/assets/*` path collision on ITUN           | Use `/art/*` prefix, distinct from Vite's `/assets/*`.                                                                    |
| Cross-origin load suref-web → asset host     | Both apps already allow `img-src https:`; or pick the dedicated-site alternative.                                         |
| Art availability coupled to ITUN site        | Dedicated `assets.salvageunion.io` site removes coupling (alternative in §3.1).                                           |
| Wrong Content-Type                           | Store `contentType` as blob metadata at upload; function echoes it.                                                       |
| Licensing — bytes leaking into git           | Blobs store + gitignored local working dir; **only tooling** is committed.                                                |
| Losing originals after Supabase delete       | Keep the local download (Phase 0) archived off-repo until well after decommission.                                        |

---

## 6. Open Decisions for Implementation

1. **Host:** ITUN site (recommended, zero new infra) vs. dedicated
   `assets.salvageunion.io` site (cleaner, decoupled, +1 site).
2. Custom domain for asset URLs now, or use the host's default domain and add a
   custom domain later (URLs would then need a second rewrite — prefer deciding now).

---

## Implementation Record (2026-06-22)

Built and verified before any merge to main, so production never points at a
dead host. Deviations from the plan above are noted.

**Host (changed from plan):** a **dedicated `su-assets` Netlify site** in the
**JRVS Softworks** team (matches the other SU-SRD sites), not the ITUN site.
Reason: cleaner decoupling and clean URLs.

- Site id: `19faf088-1c54-4bae-9312-74d7b0a94cea` (`su-assets.netlify.app`).
- Custom domain **`assets.salvageunion.io`** — the `salvageunion.io` zone is
  Netlify-managed, so the `NETLIFY` record was created automatically; SSL
  provisioned. Final URL shape: `https://assets.salvageunion.io/<category>/<file>`
  (the `LP-Assets/` bucket segment and any `/art/` prefix were both dropped).

**Code (in this repo):**

- `apps/su-assets/netlify/functions/asset.ts` — Functions v2, `config.path = '/*'`,
  `getStore('lp-assets')`, content-type inferred from extension, body returned as
  a **stream** (`type: 'stream'` — returning a raw `ArrayBuffer` 502s), immutable
  edge-cache headers.
- `apps/su-assets/netlify.toml`, `apps/su-assets/public/robots.txt`,
  `apps/su-assets/package.json` (declares `@netlify/blobs` — it **must be
  bundled**; a bare external import 502s with "error decoding lambda response").
- `tools/upload-lp-assets.ts` — reusable Blobs uploader (the "add new artwork"
  workflow): `NETLIFY_SITE_ID=<id> bun tools/upload-lp-assets.ts <local-dir>`.

**Deploy method:** manual `netlify deploy --no-build` from an **isolated staging
dir** (with `@netlify/blobs` installed for bundling). Deploying from the
monorepo root pulls in a stray Astro `server` function via the root `.netlify/`
dir and fails. Follow-up: git-connect the `su-assets` site to build `apps/su-assets`.

**Blobs store `lp-assets`:** 57 images uploaded via `netlify blobs:set`.

**Verification:** 57/58 `asset_url`s serve **HTTP 200 + correct `image/*`
content-type + exact byte-match** to the Supabase originals.

**Pre-existing data bug (NOT introduced here):**
`squads/elite blade squad.jpg` 404s on Supabase too (object missing). The
rewritten URL stays dangling — same broken state as before. **Action for
maintainer:** source/upload the correct squad art, or drop that `asset_url`.

**Data + docs:** `asset_url` prefix rewritten across `data/*.json` (58) and the
tracked schema-doc examples (4) via text-level swap (formatting preserved).
Active Supabase text references scrubbed (config, CLAUDE.md, rules, agents,
README, code comments); the Supabase-specific `create-migration` skill removed.
Historical records left intact (ADRs, `combat-loop.md`, plan-docs, generated
schema-doc bodies).

**Still to do (post-merge, needs maintainer):**

1. Merge this branch.
2. Confirm production renders from `assets.salvageunion.io`.
3. **Decommission the Supabase project** `opxrguskxuogghzcnppk` (delete the
   `LP-Assets` bucket + project) — needs Supabase credentials.
4. Remove the stale `"supabase"` entry from `.claude/settings.local.json`
   (gitignored local file — left untouched as it's a permission-list change).
