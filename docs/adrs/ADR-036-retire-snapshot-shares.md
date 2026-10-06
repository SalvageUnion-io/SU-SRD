# ADR-036: Retire Snapshot Shares

## Status

**Accepted, 2026-10-06.** **Supersedes [ADR-004](ADR-004-snapshot-netlify-functions.md)**
(snapshot sharing). [ADR-033](ADR-033-cloudflare-hosting.md)'s hosting decisions
are untouched; its snapshot-specific reasoning (§3's publish-then-read
consistency argument, the cutover's snapshot write freeze) describes a publish
flow that no longer exists, though §3 still explains why the store being read is
R2.

Amends [ADR-032](ADR-032-public-read-only-sheets.md): its consequence that
"ADR-004 is narrowed, not superseded" — snapshots kept as the way to hold a
frozen copy beside the live one — is withdrawn. Every other decision in ADR-032
stands, and the public sheet it introduced is now the only account-free way to
share.

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

3. **An existing `/s/:id` link redirects if public, and otherwise is retired.**
   `GET /api/snapshots/:id` now answers only `{ kind, appId }`, read from the
   stored blob — every snapshot ever published is `{ kind, entity }`, and a client
   entity's `id` is the `appId` its server row is addressed by. `/s/:id` asks
   `publicSheet.get` (ADR-032's own unauthenticated query) about that entity: if
   it is public, the route replaces itself with `/p/:kind/:appId`; anything else —
   not public, never in an account, an unknown or malformed id, a build with no
   Convex — shows "This share link has been retired", which says to ask the owner
   for their live public sheet. The frozen copy is never rendered again.

4. **The R2 objects are kept untouched.** Nothing deletes them and nothing writes
   to the bucket; the Worker's storage seam is read-only. The `su-itun-snapshots`
   bucket and its `SNAPSHOTS` binding stay, because the redirect needs the read.
   The 365-day lifecycle rule that `wrangler.jsonc` recorded as decided but not
   yet applied (2026-09-01) is **withdrawn**: the store no longer grows, and
   expiring objects would turn redirectable links into retired ones.

5. **Links already posted keep their unfurl, for now.** Snapshot links sit in
   Discord channels, and Discord re-fetches an unfurl, so the Worker still
   injects the shell metadata at `/s/:id` and still renders `/og/s/:id.png` — a
   neutral title naming the entity and its kind, read from the stored blob. The
   card is the only thing the stored build still feeds; opening the link always
   goes through the redirect-or-retired resolver, never the frozen sheet. The
   pipeline (`shellMeta.ts`, `ogImage.ts`, `ogCard.ts`, the worker fonts,
   `scripts/woff-to-ttf.ts`, the `.ttf` Data rule and the `OG_METRICS` dataset)
   is **removed together with `@resvg/resvg-wasm`** once the dependency audit
   gate can pass a PR that changes `bun.lock` — today `bun audit
   --audit-level=high` fails any such PR on advisories with no published fix
   (`braces` GHSA-vfj7-8cjw-p6xm, and `miniflare`'s pinned `undici`), so removing
   the package now would block every PR stacked on it. When it goes, `/og/s/*`
   should 301 to the app icon the renderer already falls back to, and `/s/:id`
   should get the sitewide defaults.

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
- **Some old links can never redirect.** A snapshot taken before its entity
  reached an account, of a build later re-imported (a copy gets a new id), or of
  an entity that was deleted, names an `appId` no public row has; it shows the
  retired page. So does every link while its entity is private — deliberately
  indistinguishable from "gone", as ADR-032 §4 requires of the public query.
- **A duplicated `appId` redirects to the oldest row.** `publicSheet.get`
  resolves duplicates the way `entities.byAppId` does. Where an id was duplicated
  across accounts, an old link could land on a different owner's sheet — but only
  one that owner chose to make public, so nothing private is disclosed.
  `maintenance.dedupeAppIds` is the repair.
- **The browser cache still holds old answers.** `GET /api/snapshots/:id` used to
  return the whole blob with a year-long `immutable` Cache-Control. The client
  therefore reads either shape (`snapshotIdentity`), so a browser that opened a
  link before this change still resolves it. Those cached bodies contain the old
  frozen build; nothing renders them.
- **The Worker shrinks a little now, and a lot later.** It no longer bundles the
  snapshot payload's Zod schemas and binds no rate limiter. The resvg wasm, two
  fonts and the Analytics Engine dataset stay until the og pipeline goes (decision
  5); ADR-033's open question — whether the og:image render fits the Free plan's
  CPU budget — stays open until then, and is closed by removing the render, not
  by pre-rendering it, since there is no publish step left to pre-render at.
- **An old link's preview names the build as it was.** The unfurl reads the
  stored blob, so it shows the entity's name and kind when the snapshot was taken,
  even while the entity is private and the link itself opens the retired page.
  Nothing more of the build is shown, and it is what that link already displayed
  wherever it was posted. It ends when the og pipeline is removed.
- **A still-open tab on an older build degrades honestly.** Its feature-detect
  read a 405 on `HEAD /api/snapshots` as "available"; it now gets a 404 and shows
  "publishing unavailable" instead of a button that cannot work. It also reports
  `snapshot service unavailable` to Sentry each time its Share dialog opens —
  expected noise that ends as those tabs reload onto the current build, not an
  outage. Its `/s/:id` page, handed `{ kind, appId }` where it expected a build,
  shows its own "Could not render snapshot" state rather than crashing.

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
