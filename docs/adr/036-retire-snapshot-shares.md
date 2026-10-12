---
status: accepted
---

# ADR-036: Retire Snapshot Shares

## Status

**Accepted, 2026-10-06.** **Supersedes [ADR-004](004-snapshot-netlify-functions.md)**
(snapshot sharing). [ADR-033](033-hosting-on-cloudflare.md)'s hosting decisions
are untouched; its §3, on the snapshot store, is history.

Amends [ADR-032](032-public-read-only-sheets.md): its consequence that
"ADR-004 is narrowed, not superseded" — snapshots kept as the way to hold a
frozen copy beside the live one — is withdrawn. Every other decision in ADR-032
stands, and the public sheet it introduced is now the only account-free way to
share.

**Decision 5 amended, 2026-10-08 (#1128):** the rendered unfurl image is
removed. The dependency audit gate that held it now passes a PR that changes
`bun.lock`, so the renderer went with `@resvg/resvg-wasm`; `/og/s/*` answers
404 rather than the 301 to the app icon this ADR first planned.

**Decisions 2–5 amended, 2026-10-09 (#1137):** old links no longer redirect,
and `/api/snapshots` is no endpoint at all.
Since this ADR shipped, `/s/:id` drew one hit and no identity lookup (three
`GET /api/snapshots/:id` in seven days), so the redirect-if-public path — the resolver, the read-only R2 seam, the `SNAPSHOTS` binding, the
per-snapshot unfurl metadata and a dev proxy — served nobody. `/s/:id` is now a
static retired page that reads nothing, and the consequences below that
describe the redirect, the identity endpoint or the unfurl text no longer hold.
This reverses the product owner's "Redirect if public" for links in the wild,
gated on the owner's count of how many stored snapshots name an entity that is
public today. With nothing left to route, ITUN moved to Static Assets'
`single-page-application` mode: navigations never reach the Worker, the CSP and
security headers moved into `apps/itun/public/_headers`, and the Worker script
answers only non-navigation misses — a missing hashed chunk 404s (#759), a
crawler gets the shell. The retired-URL 301 table went with it. The deleted
resolver: `git show 162f01ae:apps/itun/src/lib/snapshot/client.ts`.

Settles the four open decisions the unified-sheet-surfaces plan held for "a
future ADR-036", by removing the second surface rather than merging it. That
plan is deleted with this ADR:
`git show c2b31827:docs/architecture/unified-sheet-surfaces.md`.

## Context

ITUN had two account-free ways to share a sheet, and they were not
interchangeable:

- a **snapshot** (ADR-004, on a Worker and R2 since ADR-033): a frozen copy,
  minted per share at `/s/:id`, whose unguessable id was the whole capability —
  including the capability to delete it;
- the **public sheet** (ADR-032): a live, read-only page at `/p/:kind/:appId`,
  opt-in per entity through the `publicRead` Convex column, revoked everywhere
  by switching it off.

ADR-032 kept both because they "answer different questions": the frozen one was
to be "this pilot, as they were the night we lost the crawler". The
unified-sheet-surfaces plan then spent a document working out how to put the two
behind one surface, and found that it could not proceed without four decisions
— who owns a snapshot, whether a historical view stays unguessable, what
revocation means across two capability models, and what happens to `/s/:id`
links already in the wild.

The product owner answered the question underneath all four: **"Frozen sheets
probably shouldn't exist — we can just view the pilot in their current state."**
Offered the choice of keeping snapshots anyway, they chose to retire them. For
the links that already exist: **"Redirect if public."**

## Decision

1. **The public sheet is the only account-free way to share.** No surface mints a
   snapshot. The Share dialog manages the public sheet alone — on or off, its
   `/p/` link, a copy button and a QR of it — and says what sharing needs when the
   player is signed out or offline.

2. **There is no minting or revoking endpoint.** `POST /api/snapshots` and
   `DELETE /api/snapshots/:id` are gone: the collection answers 404 to every
   method, and the id route answers 405 to everything but GET. The edge rate
   limiter, which covered `POST /api/snapshots` and nothing else, goes with it.
   *Amended 2026-10-09 (#1137):* no `/api/snapshots` endpoint exists, by any
   method. `/api/snapshots` and `/api/snapshots/:id` are ordinary client-route
   misses: a navigation gets `index.html` from Static Assets, and a `fetch` gets
   the SPA shell with 200 from the Worker.

3. **An existing `/s/:id` link redirects if public, and otherwise is retired.**
   `GET /api/snapshots/:id` now answers only `{ kind, appId }`, read from the
   stored blob — every snapshot ever published is `{ kind, entity }`, and a client
   entity's `id` is the `appId` its server row is addressed by. `/s/:id` asks
   `publicSheet.get` (ADR-032's own unauthenticated query) about that entity: if
   it is public, the route replaces itself with `/p/:kind/:appId`; anything else —
   not public, never in an account, an unknown or malformed id, a build with no
   Convex — shows "This share link has been retired", which says to ask the owner
   for their live public sheet. The frozen copy is never rendered again.
   *Amended 2026-10-09 (#1137):* no link redirects; every `/s/:id` shows the
   retired page, and `/api/snapshots/:id` is gone.

4. **The R2 objects are kept untouched.** Nothing deletes them and nothing writes
   to the bucket; the Worker's storage seam is read-only. The `su-itun-snapshots`
   bucket and its `SNAPSHOTS` binding stay, because the redirect needs the read.
   The 365-day lifecycle rule that `wrangler.jsonc` recorded as decided but not
   yet applied (2026-09-01) is **withdrawn**: the store no longer grows, and
   expiring objects would turn redirectable links into retired ones.
   *Amended 2026-10-09 (#1137):* the `SNAPSHOTS` binding is removed, since
   nothing reads the bucket. The objects stay; deleting the bucket is the
   owner's step.

5. **Links already posted keep their unfurl text; the image is gone.** Snapshot
   links sit in Discord channels, and Discord re-fetches an unfurl, so the
   Worker still injects the shell metadata at `/s/:id` (`shellMeta.ts`) — a
   neutral title naming the entity and its kind, read from the stored blob, with
   no image. That text is the only thing the stored build still feeds; opening
   the link always goes through the redirect-or-retired resolver, never the
   frozen sheet. *Amended 2026-10-08 (#1128):* the rendered card at
   `/og/s/:id.png` was removed with `@resvg/resvg-wasm` — the renderer, the
   worker fonts, the since-deleted `scripts/woff-to-ttf.ts`, the `.ttf` Data rule and the
   `OG_METRICS` dataset — once `bun audit --audit-level=high` (with the gate's
   `braces` ignore) stopped failing a PR that changes `bun.lock`. `/og/s/*` is no
   longer routed: it is a missing file, and the Worker answers it 404. It served
   two renders in the seven days before that, none since this ADR shipped.
   Whether `/s/:id` should drop to the sitewide defaults is still open.
   *Amended 2026-10-09 (#1137):* it does. The Worker injects no metadata
   anywhere; every link unfurls with the shell's sitewide defaults.

How this answers the plan's four open decisions: (a) snapshots gain no owner and
no index — the entity they name is read off the blob per request, and only ever
used to reach a sheet its owner has already made public; (b) there is no
historical view to keep unguessable; (c) revocation is one model, `publicRead`,
and switching it off also stops old snapshot links reaching the sheet; (d)
existing `/s/:id` URLs are redirected where there is somewhere public to go, and
otherwise answer with a page that says what happened — which is what that plan's
governing rule asked of a link that can no longer serve what it served before.

## Consequences

- **There are no frozen sheets anywhere.** "This pilot, as they were" is no
  longer something the app can hand out. A player who wants that keeps an export
  (the Roster's "Download all", or a single entity's JSON export), which is a file
  and not a link.
- **Sharing needs an account.** `publicRead` is a Convex column, so a signed-out
  player cannot publish anything; the dialog says so and offers sign-in. Reading
  a public sheet still needs no account. Snapshots were the one way to share
  without signing in, and that way is gone on purpose.
- **Making a sheet public also re-opens its old snapshot links** — to the live
  sheet, not the frozen copy. That widens who can reach it beyond the people sent
  the `/p/` link, so the Share dialog says it in the same breath as what
  publishing exposes. Switching it off closes both at once.
  *Amended 2026-10-09 (#1137):* no longer true. Old links never reach a sheet,
  so publishing widens nothing beyond the `/p/` link, and the Share dialog no
  longer mentions them.
- **Some old links can never redirect.** A snapshot taken before its entity
  reached an account, of a build later re-imported (a copy gets a new id), or of
  an entity that was deleted, names an `appId` no public row has; it shows the
  retired page. So does every link while its entity is private — deliberately
  indistinguishable from "gone", as ADR-032 §4 requires of the public query.
  *Amended 2026-10-09 (#1137):* now no link redirects; every one shows the
  retired page.
- **A duplicated `appId` redirects to the oldest row.** `publicSheet.get`
  resolves duplicates the way `entities.byAppId` does. Where an id was duplicated
  across accounts, an old link could land on a different owner's sheet — but only
  one that owner chose to make public, so nothing private is disclosed.
  Collapsing a duplicate is a one-off repair run from the Convex dashboard's
  function runner, like every other repair.
  *Amended 2026-10-09 (#1137):* moot, since old links no longer redirect.
- **The browser cache still holds old answers.** `GET /api/snapshots/:id` used to
  return the whole blob with a year-long `immutable` Cache-Control. The client
  therefore reads either shape (`snapshotIdentity`), so a browser that opened a
  link before this change still resolves it. Those cached bodies contain the old
  frozen build; nothing renders them.
  *Amended 2026-10-09 (#1137):* the client no longer requests
  `/api/snapshots/:id` and `snapshotIdentity` is deleted, so nothing reads a
  cached answer either.
- **The Worker shrinks.** It no longer bundles the snapshot payload's Zod
  schemas, binds no rate limiter, and (since the decision 5 amendment) carries
  no resvg wasm, fonts or Analytics Engine dataset. ADR-033's open question —
  whether the og:image render fits the Free plan's CPU budget — was closed by
  removing the render, never measured: there is no publish step left to
  pre-render at, and nothing left to size.
- **An old link's preview names the build as it was.** The unfurl reads the
  stored blob, so it shows the entity's name and kind when the snapshot was taken,
  even while the entity is private and the link itself opens the retired page.
  Nothing more of the build is shown, and it is what that link already displayed
  wherever it was posted. It ends when `/s/:id` gets the sitewide defaults.
  *Amended 2026-10-09 (#1137):* it has ended. `/s/:id` unfurls with the
  sitewide defaults and names no build.
- **A still-open tab on an older build degrades honestly.** Its feature-detect
  read a 405 on `HEAD /api/snapshots` as "available"; it now gets a 404 and shows
  "publishing unavailable" instead of a button that cannot work. It also reports
  `snapshot service unavailable` to Sentry each time its Share dialog opens —
  expected noise that ends as those tabs reload onto the current build, not an
  outage. Its `/s/:id` page, handed `{ kind, appId }` where it expected a build,
  shows its own "Could not render snapshot" state rather than crashing.
  *Amended 2026-10-09 (#1137):* `/api/snapshots` is no endpoint, so that
  `HEAD` gets the SPA shell with 200, not a 404. The feature-detect read anything
  but 405 as unavailable, so the tab still shows "publishing unavailable". Its
  `/s/:id` page gets the shell where it expected a snapshot and shows its error
  state; a tab on the redirect build reports `snapshot-identity-failed` once and
  shows the retired page. Neither redirects.

## Alternatives considered

**Keep snapshots beside the public sheet** (ADR-032's position). Rejected by the
product owner: the frozen copy is not a thing players need, and keeping it meant
two capability models, two revocation stories and a merge plan blocked on four
decisions.

**Unify them behind a Current | Historical toggle** (the deleted plan's Option C).
Rejected with the frozen half: there is no historical view left to toggle to.

**Redirect every old link, public or not, to `/p/:kind/:appId`.** The public page
already says "This sheet isn't available" for a private one. Rejected because it
puts an entity's `appId` into the address bar for a sheet its owner never made
public, and because "isn't available" does not tell the holder of an old link
what changed. The retired page does.

**Serve the frozen copy at `/s/:id` forever, mint nothing new.** The cheapest
option for links in the wild. Rejected: it keeps a frozen sheet renderer alive
for the one surface the decision removes, and keeps publishing a build its owner
may have long since changed or wanted withdrawn — with no owner able to withdraw
it, since the id-as-revoke capability goes with the endpoint.

**Delete the R2 objects.** Rejected: the redirect needs them, and deletion is not
reversible.
