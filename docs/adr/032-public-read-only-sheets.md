# ADR-032: Public, Read-Only Sheets

The full record behind [Decisions](../ARCHITECTURE.md#decisions) entry 32, which summarises it.

## Status

**Accepted.** Amends [ADR-030](030-accounts-games-server-of-record.md) §5
(visibility) with one explicit exception.

**Amended:** [ADR-036](../ARCHITECTURE.md#decisions) retired snapshots, so the
public sheet is the **only** account-free way to share; an old `/s/:id` link
shows a retired page. `publicSheet.get` also returns the entity's direct
assignments — a linked entity that is itself published with its name and body,
any other by its kind alone ("Not shared"; publishing is each owner's opt-in,
decision 2) — and the page renders the live `<Sheet readOnly>` over
`readOnlySheetStore.model.ts`. Saved mech patterns join at `/p/pattern/:appId`
(decision 7), and built NPCs ([ADR-044](../ARCHITECTURE.md#decisions)) at
`/p/npc/:appId`, maker credited. Every kind a player shares — pilot, mech,
crawler, NPC, pattern — sets this from one "Who can see it" control (Only me,
My Game's crew, Anyone with the link). A public crawler page draws its book
crew line, not a linked NPC.

## Context

Two rules meet here and neither anticipated this case.

**ADR-030 §5 says visibility begins at membership.** Inside a Game every member
sees every crewmate's vitals live and may drill into a full sheet read-only, and
that is where seeing stops. The one deliberately unauthenticated read in the
whole Convex surface is `invites.preview`, which exists so that a link can
explain itself before sign-in and which is careful to disclose nothing beyond
what the invite already tells its bearer.

**ADR-004 says snapshots are the account-free way to hand someone a build.**
They are immutable, minted on demand, and stored as opaque blobs. That is the
right shape for a frozen record and the wrong shape for a link that lives
somewhere durable — a Discord channel, a forum signature, a bio. Such a link
wants to be _current_, and it wants to exist without anybody having remembered
to press a button.

The immediate driver is the Discord bot. `/su sheet` renders a crewmate's sheet
and links to the read-only Game view, which is correct and which requires an
account and a membership. A Discord channel routinely contains neither. Minting
a snapshot per invocation was considered and rejected on four independent
grounds, all recorded here because they are the reasons this ADR exists at all:

1. **Consent.** `/su sheet` reads _other people's_ sheets. Publishing on
   invocation would put somebody's character on a public URL because a third
   party ran a command.
2. **The id is the revoke capability.** `DELETE /api/snapshots/:id` has no auth
   by design, so posting a snapshot link into a public channel hands delete
   rights to everyone who can read it.
3. **Nothing expires and nothing indexes.** Snapshots have no TTL, and the only
   record of what has been published is `localStorage` in the publishing
   browser. A bot-minted snapshot is an orphan from birth.
4. **One IP for every server.** Publish is rate-limited per client IP and the
   bot is a single worker.

## Decision

Add a **public, read-only rendering of the live sheet**: a stable URL that needs
no account to open, is always current, and requires no publishing step.

1. **Opt-in, per entity, stored server-side.** A nullable `publicRead` column on
   `pilots`, `mechs` and `crawlers`, beside `gameId` and `ownerId` — which is
   where container and ownership already live. Absent or `false` means the
   entity is not readable without membership, which is the existing rule and
   therefore the default for every row that exists today.

2. **The owner decides; the table runner decides for the crawler.** Turning it
   **on** is owner-only for a pilot or mech, with no Mediator override — the
   same rule `assertMayWrite` applies to edits, though this is its own gate
   (`assertMayPublish`) rather than a reuse, for the reason in the next clause.
   A crawler in a Game is communal (`ownerId: null`), so it follows §5a and is
   the table runner's act (Mediator, or Organizer where a Game has no
   Mediator); a crawler on a shelf is its owner's.

   Turning it **off is always permitted**, including on an entity whose
   `ownerId` has become null. This is where publishing deliberately diverges
   from `assertMayWrite`, and it is not a detail: `ownership.release` and the
   leave-Game sweep both null an `ownerId` on a row that is still in the Game,
   so refusing there would leave a published sheet permanently world-readable
   with its "Stop sharing" button refusing forever. Withdrawal can only ever
   reduce what is exposed, so it needs no owner to authorise it.

   One further path exists and is deliberate: a published **mech** resolves the
   abilities of the pilot flying it (see Consequences), and that pilot may be an
   **unclaimed** one in the same Game. Such a pilot has no owner to ask and is
   already visible to the whole table, so its ability slugs travel with the
   mech's numbers. A *claimed* crewmate's pilot never does — republishing their
   data past the membership boundary is theirs to decide, not their crewmate's.

3. **Addressed by `appId`, at `/p/:kind/:appId`.** Not the Convex row id,
   for two reasons: the owner already holds the app id, so the Share screen can
   build the URL with no round trip; and the bot already receives `appId` on the
   `sheet` payload, so it can render the link without a second call.

4. **One unauthenticated Convex query, returning one entity.** It returns
   `null` — not a refusal — for an entity that is not public, so a flipped-off
   sheet is indistinguishable from one that never existed.

5. **Rendered by the machinery that already exists.** `readOnlySheetStore.model.ts`
   parses the entity against the Zod schemas behind a store whose every write
   throws, the store every read-only sheet uses; the public sheet adds no
   rendering code.

6. **Turning it off revokes it everywhere, immediately.** There is one URL per
   entity and it is derived, not minted, so there is no set of outstanding
   links to chase. This holds unconditionally — see the second half of decision
   2 — because a promise of revocation that an ordinary sequence of play can
   take away is not a promise.

7. **Saved mech patterns join, with one more audience.** `mechPatterns`
   gains the same `publicRead` column and a **Game scope**: its maker chooses
   Only me, Anyone with the link (`publicRead`), or My Game's crew (`gameId`,
   a read scope here and never a container — the pattern stays on its maker's
   shelf). `shelf.setPatternVisibility` is the maker's act alone, and parses the
   body before widening, as `setPublic` does. The page is the same route,
   `/p/pattern/:appId`, served by its own query, `publicSheet.pattern`: a
   pattern has no assignments or maxima, and a signed-in reader also reaches one
   shared with a Game they are in, or their own. Everything else is the same
   `null`, and there is still no listing outside the crew's own
   (`shelf.crewPatterns`). The page wears the user-made treatment (ruleset
   §3.9): a player's pattern must never pass for the book. Deleting the Game
   drops a crew-scoped pattern back to Only me.

## Consequences

- **This is a real widening of who can read a sheet, and it is opt-in for
  exactly that reason.** The default is unchanged; a player has to choose. The
  free-text fields on a pilot — callsign, pronouns, motto, keepsake, appearance,
  background — become world-readable when they do, and the toggle says so rather
  than describing itself as "sharing".
- **The URL is not a secret and is not treated as one.** `publicRead` is the
  control, not the unguessability of an id. That is the opposite of the snapshot
  model, where the id _is_ the capability, and it is the better property: it can
  be withdrawn.
- **A public sheet is crawlable; a missing or private one is not.** The one
  site's `robots.txt` does not block `/build/p/`, and its sitemap index lists only
  the app's front door and the Starter Set, never `/p/`. A public sheet names
  its own canonical URL; a sheet that is missing or private answers
  `x-robots-tag: noindex`, so a dead link never becomes a page search lists
  (`worker/app.ts`).
- **The link unfurls.** For a bot's request the Worker swaps the shell's
  `app:meta` block for the thing's preview
  (`apps/web/src/worker/linkPreview.ts`, from `publicSheet.preview`, public
  reads only) and renders its `OgCard` through Browser Rendering, cached by
  version. A private sheet unfurls as the Private card.

## Alternatives considered

**Always public, addressed by row id.** The least machinery, and the reading
that "it shouldn't need to be generated" most literally supports. Rejected: row
ids are not secrets here — they travel in crew payloads and in Game-view URLs —
so this makes every character in the database world-readable to anyone who has
ever seen one, with no way to turn it off.

**A per-entity random token.** Revocation could then rotate rather than only
switch off, and the row id would never leave the system. Rejected for now as
strictly more machinery for a marginal gain: `publicRead` already revokes, and a
rotating URL is a worse promise to make about a link somebody has put in their
bio. Worth revisiting if a token proves necessary for some other reason.
