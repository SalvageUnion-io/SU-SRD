# Game invites & membership — design plan

**Status: BUILT.** This began as a proposal and is kept as the reasoning behind
what shipped — the "what exists today" in §1 describes the state this replaced,
not the current one. The §9 amendment has been **applied** to
[ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md); read the ADR, not
§9, for the governing text.

Governed by [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md)
(accounts, Games, server of record) and
[ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md) (surface/mode taxonomy).

| Shipped                                                              | Where                                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Game as a fourth `EntityRow` ontology, blue tone, multi-badge `meta` | `packages/component-lib/src/components/shared/EntityRow.tsx`, `styles/theme.css` |
| `/games` index + `/games/$gameId` + `/join/$code`                    | `apps/itun/src/routes/games/`, `routes/join/`                                    |
| Manageable invites — list, soft revoke, labels, redemption audit     | `apps/itun/convex/invites.ts`, `components/games/InvitePanel.tsx`                |
| Invites carrying a seat and a hand-out                               | `invites.ts` (`seat`)                                                            |
| Knock-and-approve                                                    | `invites.ts` (`joinRequests`), `InvitePanel.tsx`                                 |

---

## 1. What exists today

The whole invite scheme is `apps/itun/convex/invites.ts`: three mutations,
sixty lines, plus one panel in `GamesScreen.tsx`.

| Piece            | Today                                                                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invites.create` | Organizer-only. Mints an 8-char Crockford base32 code (~40 bits, `crypto.getRandomValues`), 14-day default expiry, `usesRemaining` optional and **unset by default**. |
| `invites.redeem` | Any signed-in user. Validates expiry + uses, inserts a `memberships` row with `mediator: false, organizer: false`. Re-redeeming is an idempotent no-op.               |
| `invites.revoke` | Organizer-only. **Hard-deletes** the row.                                                                                                                             |
| `invites` table  | `gameId, code, createdBy, expiresAt?, usesRemaining?` + `by_code` / `by_game` indexes.                                                                                |
| UI               | `InvitePanel` — one "Create invite code" button that renders the returned code and a fixed "Valid for 14 days" caption. `redeem` is a text input on the Games index.  |

### The gaps, in order of how much they hurt

1. **`revoke` has no caller.** It is implemented and covered by
   `convex/__tests__/` but nothing in the app invokes it. There is no
   `invites.list`, so the organizer cannot see a code again after navigating
   away, cannot see uses remaining or time left, and cannot kill one. A minted
   code is effectively immortal for 14 days.

2. **A code is a bearer token to a read-everything seat.** ADR-030 §5 gives
   every member live vitals for the whole crew and read-only drill-down into
   any crewmate's full sheet. The default invite is unlimited-use for 14 days,
   and nothing records who redeemed which code — so a code pasted into the
   wrong Discord channel is both undetectable and unstoppable.

3. **The code cannot travel as a link.** There is no `/join/$code` route, so
   the code must be re-typed by hand after sign-in. Reading it aloud at a table
   is a real and well-served use case; it is currently the _only_ one.

4. **Every joiner lands as a bare Player owning nothing.** Seating a Mediator
   is a second manual step on the crew list. `templates.ts` deliberately
   creates the six Starter Set pilots and mechs **unclaimed** (`ownerId: null`)
   for hand-out, so the common path is: send code → they join → find them in
   the crew list → assign a pilot → assign its mech. Four steps for a thing the
   organizer already decided when they minted the code.

5. **Discord is wired up and unused for this.** `convex/bot.ts` already has
   `bindChannel` / `gameForChannel` / `linkDiscordId`; a bound channel already
   knows which Game it is. Nothing connects that to membership.

**Not a gap:** the code itself. 40 bits against an online-only oracle is fine,
the alphabet excludes I/L/O/U so a code read aloud cannot be mistyped into a
different valid one, and `b % 32` over `Uint8Array` has no modulo bias (32
divides 256). Keep the generator exactly as it is.

---

## 2. Constraints this design must respect

- **ADR-030 §3** — roles are `Player | Mediator` with `Organizer` as an
  orthogonal flag. Membership administration is the Organizer's; content
  authority is not.
- **ADR-030 §4** — ownership is **assigned, never self-claimed**. An invite
  that hands over a pilot must be the _organizer's_ assignment executed later,
  not the joiner claiming something.
- **ADR-030 §4** — the `ownership.assign` path writes a Change Log entry
  (`source: 'ownership'`, `field: 'ownerId'`). Invite-driven assignment must
  produce the same entry, with `actorId` = the inviter, not the joiner.
- **ADR-030 §1** — **Solo must keep working forever.** Every new surface needs
  a defined signed-out and `isConvexConfigured === false` behaviour.
- **ADR-030 §Consequences** — Convex stores entity bodies opaquely; anything
  touching an entity body Zod-parses first. (Only §5's assignment path touches
  entities at all, and it patches `ownerId`, not a body.)
- **ADR-004 is untouched.** Snapshots remain the account-free way to hand
  someone a build. Nothing here changes them.
- **ADR-021** — the Games surfaces stay administrative. No play action, no
  rules enforcement, moves here.

---

## 3. Data model

### 3.1 `invites` — revised

```ts
invites: defineTable({
  gameId: v.id('games'),
  code: v.string(),
  createdBy: v.id('users'),
  createdAt: v.number(),

  /** Free-text organizer note, e.g. "for Sam". Never shown to the redeemer. */
  label: v.optional(v.string()),

  /** The seat this invite grants. Defaults to 'player'. */
  role: v.union(v.literal('player'), v.literal('mediator')),

  /** Entities handed to the redeemer on join (Tier 2). */
  grants: v.optional(v.array(v.object({ table: ownableTable, entityId: v.string() }))),

  /** Tier 3: the code identifies the Game but grants nothing until approved. */
  requiresApproval: v.boolean(),

  expiresAt: v.optional(v.number()),
  usesRemaining: v.optional(v.number()),

  /** Soft revoke — the row survives so redemption history stays readable. */
  revokedAt: v.optional(v.number()),
})
  .index('by_code', ['code'])
  .index('by_game', ['gameId'])
```

Three notes on the shape:

- **Soft revoke, not delete.** Today `revoke` hard-deletes, which would orphan
  the redemption rows below and make "who joined via which code" unanswerable
  the moment an organizer tidies up. Games are small; keep the row.
- **`grants` is a list, not a single pilot.** The Starter Set case is a pilot
  _and_ its mech; a one-entity field would need a second mechanism a week
  later. `ownableTable` is the existing validator from `convex/ownership.ts`.
- **`role` is stored, not derived.** A mediator invite is the organizer
  pre-exercising the same authority `games.setMediator` already gives them.

### 3.2 `inviteRedemptions` — new

```ts
inviteRedemptions: defineTable({
  inviteId: v.id('invites'),
  gameId: v.id('games'),
  userId: v.id('users'),
  redeemedAt: v.number(),
})
  .index('by_invite', ['inviteId'])
  .index('by_game', ['gameId'])
```

The audit trail gap 2 is missing. Cheap, append-only, and it is what makes the
management panel able to say "used by Sam, 3 days ago" instead of "2 uses left".

### 3.3 `joinRequests` — new (Tier 3)

```ts
joinRequests: defineTable({
  gameId: v.id('games'),
  inviteId: v.id('invites'),
  userId: v.id('users'),
  requestedAt: v.number(),
  state: v.union(v.literal('pending'), v.literal('approved'), v.literal('declined')),
  decidedBy: v.optional(v.id('users')),
  decidedAt: v.optional(v.number()),
})
  .index('by_game_state', ['gameId', 'state'])
  .index('by_user', ['userId'])
```

A pending request is **not** a membership: no `memberships` row exists until
approval, so a knocker sees nothing of the Game. Approving runs exactly the
same seat-granting code path as a direct redeem (§4.3) — one implementation, so
role and grants behave identically whichever door was used.

---

## 4. Server API

### 4.1 Mutations & queries

| Name                  | Who           | Notes                                                                                                                                                 |
| --------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invites.create`      | Organizer     | Args gain `label?`, `role?`, `grants?`, `requiresApproval?`. Existing args keep their meaning and defaults, so the current call site keeps compiling. |
| `invites.list`        | Organizer     | Every invite for a Game with derived `status` and resolved redeemer display names.                                                                    |
| `invites.revoke`      | Organizer     | Patches `revokedAt` instead of deleting.                                                                                                              |
| `invites.preview`     | Any signed-in | Read-only look at a code — see §4.2.                                                                                                                  |
| `invites.redeem`      | Any signed-in | Returns a discriminated result — see §4.3.                                                                                                            |
| `joinRequests.list`   | Organizer     | Pending knocks for a Game.                                                                                                                            |
| `joinRequests.decide` | Organizer     | `{ requestId, approve }`. Approval seats them via the shared path.                                                                                    |
| `games.get`           | Member        | Missing today; `/games/$gameId` needs it (§5.1).                                                                                                      |
| `games.listMine`      | Any signed-in | `summarize()` gains the crawler name and the pilot / mech counts the row badges show (§6.1).                                                          |

`invites.list` returns a **derived** status rather than storing one, so there is
no state to drift out of sync with the clock:

```
revoked        revokedAt is set
expired        expiresAt < now
exhausted      usesRemaining === 0
active         otherwise
```

### 4.2 `invites.preview` — the landing-page oracle

`/join/$code` must be able to say _"Vex invited you to Union Crawler #430 as
Mediator"_ before the visitor commits, and must be able to say it to someone
who has not signed in yet.

It returns **only** what the invite itself already tells the bearer:

```ts
{
  ;(gameName, invitedBy, role, requiresApproval, status)
}
```

Never the member list, never the crew, never entity names — a valid code is not
yet a seat, and §5 visibility begins at membership. `grants` is reported as a
boolean ("a pilot is waiting for you"), not as entity identity.

It requires a syntactically valid code and returns a uniform "not valid" for
every failure mode, so it is not an enumeration oracle beyond what `redeem`
already is.

### 4.3 Redemption

`redeem` becomes a discriminated union rather than a bare `Id<'games'>`:

```ts
| { kind: 'joined';   gameId: Id<'games'>; granted: number }
| { kind: 'pending';  gameId: Id<'games'> }     // knocked, awaiting approval
| { kind: 'already';  gameId: Id<'games'> }     // idempotent re-redeem
```

The seat-granting path, shared by `redeem` and `joinRequests.decide`:

1. Validate: exists, not revoked, not expired, uses remaining.
2. If already a member → `already`, no use consumed. (Today's behaviour, kept.)
3. If `requiresApproval` and no membership → insert/return a `joinRequests` row
   → `pending`. **No use is consumed at knock time**; a use is consumed on
   approval, so a spam of knocks cannot burn a code.
4. Insert `memberships` with `mediator: role === 'mediator'`, `organizer: false`.
5. For each `grants` entry: re-check the entity is still in this Game and still
   `ownerId === null`. If so, assign it — reusing `ownership.assign`'s logic
   with `actorId` = `invite.createdBy`, so the Change Log records that the
   **organizer** made the assignment. If it has since been claimed, **skip it
   and still join** — a stale grant is a notice, never a failed join.
6. Insert `inviteRedemptions`, decrement `usesRemaining`.

### 4.4 Guards worth stating

- **Mediator invites default to single-use.** ADR-030 §3 permits several
  Mediators in the schema but the UI is built for one; an unlimited-use
  mediator code is a foot-gun. `role: 'mediator'` without an explicit
  `usesRemaining` gets `1`.
- **Grants imply single-use.** Two people cannot both receive the same pilot;
  the second would silently get nothing (step 5). If `grants` is non-empty and
  `usesRemaining` is unset, it gets `1`.
- **Revoking does not evict.** Someone already seated stays seated; removing a
  member is `ownership.leaveGame` / a future kick, not invite revocation. The
  panel should say so.

---

## 5. Routes

### 5.1 `/games/$gameId` as a first-class route

Today `routes/games.tsx` is a single leaf rendering everything: create,
templates, join-by-code, and — per Game — the crew list, invite panel, proposal
inbox, and Downtime panel, all stacked in one column. It does not scale past
two Games and there is nothing to link to or bookmark.

Split into a directory (deleting `routes/games.tsx`;
`routeTree.gen.ts` regenerates and is never hand-edited):

```
routes/games/index.tsx     →  /games          the shelf of Games
routes/games/$gameId.tsx   →  /games/$gameId  one Game
routes/join/$code.tsx      →  /join/$code     invite landing (§5.2)
```

| Surface          | Holds                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/games`         | Start a game · start from template · join with a code · a list of **Game rows** (§6). Nothing per-Game beyond the row.                                      |
| `/games/$gameId` | Crew list with role controls, invite management (list/mint/revoke), pending join requests, `ProposalInbox`, `DowntimePanel`, and the Mediator-surface link. |

`/mediator/$gameId` stays where it is — it is a different surface with a
different mode under ADR-021, not a tab of this one.

**Mode behaviour**, in all three routes: `connected` renders; `disconnected`
renders the existing "unreachable right now" card; Solo renders the sign-in
explainer; `isConvexConfigured === false` renders the "no account service"
card. `/games/$gameId` additionally needs a **not-a-member** state — a
bookmarked URL for a Game you left must not 500, it must say you are not in
that Game and offer `/games`.

### 5.2 `/join/$code`

The link half of gap 3. Signed-out is the **expected** state here, not an edge
case:

1. Land → `invites.preview(code)` → render the Game name, who invited you, the
   seat offered, and whether it needs approval.
2. If invalid/expired/revoked → say which, and offer `/games`. No sign-in
   prompt for a dead code.
3. Signed out → sign-in control. The code must survive the Discord OAuth
   round-trip; carry it in the return URL rather than `sessionStorage`, so a
   different-browser paste still works.
4. Signed in → "Join" → `redeem` → route on the result: `joined` / `already` →
   `/games/$gameId`; `pending` → a "waiting for the organizer" state on this
   page.
5. Solo build with no Convex → the honest "this build has no account service"
   card. A `/join` link in a CI or self-hosted build must not look broken.

Typing a code on `/games` keeps working unchanged. The link is an addition, not
a replacement — a table reading a code aloud is still the primary case.

---

## 6. The Game row

A Game renders as an **`EntityRow`** — the same compact listing primitive the
Roster uses for pilots, mechs, and crawlers. `/games` becomes a list of Game
rows, and a Game reads as a peer of the other things you own rather than as a
bespoke panel.

That means **Game becomes a fourth ontology in `component-lib`**, not an
app-local composition. `EntityRow` is keyed off `entityType` throughout, so this
is a four-point change in the package — three of which the compiler forces the
moment the union grows, because they are **total `Record`s**:

| Site                                    | Change                                                                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `EntityRowType`                         | `'pilot' \| 'mech' \| 'crawler'` → `+ 'game'`                                                                                                                                                                                                    |
| `TONE: Record<EntityRowType, …>`        | A `game` entry — `rail` (6px deep accent) + `wash` (faint tint).                                                                                                                                                                                 |
| `EMPTY_GLYPH: Record<EntityRowType, …>` | A `game` glyph. `Users` is the natural lucide pick beside `UserRound` / `Bot` / `Warehouse`.                                                                                                                                                     |
| `BadgeTone` + `BADGE_TONES`             | Forced, because the row carries badges (below) — `meta` renders `<Badge surface="tone" tone={entityType}>`, and `BadgeTone` is its own union (`pilot \| mech \| crawler \| ok \| warn \| bad`) that does not currently accept a fourth ontology. |
| `meta` **arity**                        | `ReactNode` → `ReactNode \| ReactNode[]`. See §6.1 — the Game row needs three badges and the prop renders exactly one.                                                                                                                           |

The call shape on `/games`, mirroring `Roster.tsx`:

| `EntityRow` prop | Game content                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `entityType`     | `'game'`                                                                                                                                                                                                                                                                                                                                         |
| `name`           | Game name — the black stamp name tab.                                                                                                                                                                                                                                                                                                            |
| `sheetHref`      | `/games/${id}`                                                                                                                                                                                                                                                                                                                                   |
| `linkAs`         | `AppLink` — the same router/anchor-degrading link the Roster passes.                                                                                                                                                                                                                                                                             |
| `meta`           | **Three badges: the crawler's name, the pilot count, the mech count.** See §6.1.                                                                                                                                                                                                                                                                 |
| `metaLine`       | Your role (`Mediator` / `Player`) · organizer name · template origin, joined with the Roster's `' · '` helper.                                                                                                                                                                                                                                   |
| `stats`          | Omitted. The counts moved into the badges, and crew count is better said as "4 pilots" than as a second numeric readout.                                                                                                                                                                                                                         |
| `onDeleteClick`  | **Omitted for non-organizers.** For an organizer it maps to `games.destroy`, which deletes a shared campaign for everyone — so it needs a heavier confirm than the Roster's, naming the Game and its crew count. Recommendation: omit it here entirely and keep destroy on `/games/$gameId`, where there is room to say what is being destroyed. |

### 6.1 The badges, and what they cost

The row carries **crawler name · _n_ pilots · _n_ mechs** as badges. Two
consequences, one in the component and one on the server.

**`meta` renders exactly one badge.** It is typed `ReactNode` and wrapped in a
single `<Badge surface="tone">`, so passing three nodes would nest badges inside
a badge. The minimal fix is to widen it to `ReactNode | ReactNode[]` and map an
array to one toned Badge per entry — additive, and every existing call site
passes a single node, so nothing else changes. (`Roster.tsx` passes no `meta` at
all today; it uses `metaLine`.)

**`games.listMine` does not return any of this.** Its `summarize()` returns
`{ _id, name, templateOrigin, mediator, organizer, memberCount }`. All three new
values need adding:

- **Pilot / mech counts** — both tables have a `by_game` index, so this is a
  scoped query per table. But **Convex has no count API**: counting means
  `.collect()`ing the rows and taking `.length`, and `listMine` already loops
  over every Game you belong to. Three extra collects per Game is fine at a
  table's scale and worth stating rather than discovering — if it ever bites,
  the fix is a denormalized counter on `games`, not a cleverer query.
- **Crawler name** — `crawlers.gameId` is non-nullable (`v.id('games')`, unlike
  pilots and mechs), so the communal crawler is always reachable by `by_game`.
  Its name lives in the **opaque `body`**, which ADR-030 says Convex cannot
  validate. Read it defensively, exactly as `crew.vitals` already does:
  `((c.body as Record<string, unknown> | null)?.name as string) ?? 'Crawler'`.
  That is an established pattern in this codebase, not a new liberty.

**One flag, then I'll build it as asked.** `EntityRow`'s own docstring cites the
"stats-render-through-`Stat` law (ruleset §3)" for `label | value` content, and
a pilot count is exactly that shape. Rendering counts as badges is a deliberate
departure from it. I think it is the right call here — "4 PILOTS" reads as a
chip describing the Game, not as a stat readout of it, and three badges scan as
one row of facts where a badge-plus-two-Stats would look like two different
kinds of information. Worth a reviewer's eye, not a blocker.

The **empty variant** gets a real use: `/games` currently renders a plain
`Text` hint when you are in no Games. An empty `EntityRow` with a `GAME` role
tab, the existing copy as its `message`, and create/join as its `actions` is
both more consistent and less code.

### 6.2 Tone — blue (decided)

Games are **blue**. That settles Q1, and it separates Game cleanly from pilot
orange, mech green, and crawler pink — which matters here because in
`EntityRow` the rail tone **is** the ontology signal, not decoration. (An
earlier draft of this plan proposed reusing the crawler tone; that was premised
on a `Card` composition where tone is decorative, and it would have made a Game
row and a crawler row indistinguishable.)

The palette already carries the base, annotated for exactly this:

```css
--color-wk-accent: rgb(125, 206, 235); /* #7dceeb — game-state accent (was su-blue-game) */
```

Proposed pair, following the existing sheet-tone block's structure:

```css
--color-sheet-game: var(--color-wk-accent); /* #7dceeb */
--color-sheet-game-deep: rgb(30, 83, 100); /* #1e5364 */
```

The deep is a **literal, not an alias**. The palette's blue ramp
(`--color-tl-1` … `--color-tl-6`) has a perfect match at `--color-tl-5`
(`#1e5364`), but that ramp means _tech level_ in this app — aliasing it would
tie the Game ontology to tech-level semantics, the same category error as
borrowing crawler pink. Take the value, not the token. (`--color-sheet-mech-deep`
and `--color-sheet-crawler-deep` are both literals too; only pilot aliases, to
`--color-rust`.)

**#1e5364 is a checked value, not a guess.** `tone.rail` is not only the 6px
accent bar — `EntityRow`'s empty variant also uses it as **text colour** on the
wash, so it carries a real contrast obligation. Measured against the Game wash
(`color-mix(#7dceeb 10–12%, paper)`):

| Candidate                | Contrast on wash | Verdict                                  |
| ------------------------ | ---------------- | ---------------------------------------- |
| `--color-tl-4` (#306b80) | 5.4:1            | Passes AA, but the weakest of the four.  |
| **#1e5364**              | **7.7:1**        | **Sits right between mech and crawler.** |
| `--color-tl-6` (#063441) | 12.1:1           | Passes, but far darker than the family.  |

For reference, the three existing pairs score 4.8:1 (pilot), 9.1:1 (mech), and
7.5:1 (crawler) by the same measure — so #1e5364 lands mid-family and clears AA
for normal text with room to spare.

**Story + guard obligations.** `EntityRow` already has a co-located story, so
this adds a variant to `EntityRow.stories.tsx` rather than a new file — the
story-coverage guard wants one story file per public component, and a second
one would collide on title. The story must render with real data per the
package's rules.

---

## 7. Security model, stated plainly

Two doors, and the organizer chooses per invite:

| Door                                   | Who should use it                                                                                                                              |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Bearer** (`requiresApproval: false`) | A code read aloud at a table, or DM'd to a person you know. Fast, and the code _is_ the authority.                                             |
| **Knock** (`requiresApproval: true`)   | Anything posted where more than the intended people can read it — a Discord channel, a forum. The link identifies the Game and grants nothing. |

What this design does **not** do:

- **No rate limiting on `redeem`/`preview`.** 40 bits against an online oracle
  needs ~10¹² attempts; a limiter would be theatre against that and real
  friction for a table mistyping a code. Revisit if Convex usage shows abuse.
- **No shortening or prettifying the code.** The read-aloud property is worth
  more than the aesthetics.
- **No email invites.** ADR-030 §1: Discord is the only identity provider.

---

## 8. Build order

Five PRs, each independently shippable and reviewable. Each ends green on
`bun run check`.

| #   | Slice                                                                                                                                                                                                                                                    | Depends on |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 1   | **Route split + `games.get`.** `/games/index` + `/games/$gameId`, not-a-member state, panels moved to the detail route. Pure re-org, no invite change.                                                                                                   | —          |
| 2   | **Game as an `EntityRow` ontology.** The `component-lib` union + tone + glyph + `BadgeTone`, `meta` widened to an array, the blue `--color-sheet-game` pair, the badge trio, the `summarize()` fields behind them, the `/games` list, the empty variant. | 1          |
| 3   | **Tier 1 — manage invites.** Schema (`label`, `createdAt`, `revokedAt`, `inviteRedemptions`), `invites.list`, soft revoke, the management panel.                                                                                                         | 1          |
| 4   | **Tier 2 + `/join/$code`.** `role`, `grants`, `preview`, the discriminated `redeem`, the landing route.                                                                                                                                                  | 3          |
| 5   | **Tier 3 — knock & approve.** `joinRequests`, `requiresApproval`, the organizer's pending list, the ADR-030 amendment (§9).                                                                                                                              | 4          |

**Test plan per slice** — the Convex modules already have a `__tests__/`
harness (`convex/__tests__/harness.ts`), and `invites` is covered there today:

- 1: route-level tests for each of the four modes + not-a-member.
- 2: filled + empty `game` row render tests in `component-lib`; **a test that
  `meta` still renders one badge when given a single node** (the array widening
  must not regress existing callers); a `game` variant added to the existing
  `EntityRow.stories.tsx` (not a new story file — the coverage guard is one
  story per component); a `summarize()` test covering a Game with no crawler and
  with zero pilots/mechs, so the badges degrade rather than render `undefined`;
  an ITUN test that `/games` lists a row per Game and links to
  `/games/$gameId`. Because PR 2 touches a shared package, re-check both
  consuming apps per the cross-package rule.
- 3: derived-status matrix (active/expired/exhausted/revoked); revoke keeps the
  row; non-organizer is denied `list` and `revoke`.
- 4: mediator role lands as `mediator: true`; grants assign and write a Change
  Log entry with `actorId` = inviter; **a stale grant still joins**; re-redeem
  stays idempotent and consumes no use; `preview` leaks nothing beyond §4.2.
- 5: knock creates no membership; approval seats with the invite's role and
  grants; knock consumes no use, approval does; a declined knocker may ask
  again (an Organizer who declined by mistake should not need a fresh code).

---

## 9. Draft ADR-030 amendment (Tier 3 only)

Tiers 1, 2, and the route work are all _within_ ADR-030 as written — they
implement §3's Organizer authority and §4's assigned ownership rather than
changing them. **Tier 3 changes a stated invariant** and needs the ADR amended
before it is built. Proposed text, for review as part of PR 5:

> **Amendment — joining may be gated.**
>
> §2 describes an invite code as sufficient to join. An invite may now instead
> be minted as a **request**: the code identifies the Game and grants nothing
> until the Organizer approves it. This does not add a role or a membership
> state — a pending request is not a membership, and an approved one produces
> exactly the membership a direct redeem would.
>
> The reason is §5: membership confers read access to every crewmate's sheet,
> so a code posted in a public channel is a broader disclosure than the
> Organizer intended. Approval is the Organizer exercising the membership
> authority §3 already gives them, one step later.
>
> Bearer codes remain the default and are unchanged. This is a per-invite
> choice, not a mode.

---

## 10. Open questions

- ~~**Q1 — Game tone.**~~ **Resolved: blue.** `--color-sheet-game` =
  `--color-wk-accent` (#7dceeb) with a #1e5364 deep — see §6.2.
- ~~**Q1b — does the Game row carry `meta`?**~~ **Resolved: yes**, and it
  carries three of them (crawler name, pilot count, mech count), so `BadgeTone`
  widens and `meta` becomes `ReactNode | ReactNode[]` — see §6.1.
- **Q1c — counts as badges vs. `Stat`s.** §6.1 renders the pilot/mech counts as
  badges, which departs from the stats-render-through-`Stat` law that
  `EntityRow`'s docstring cites. Called as asked; noted for a reviewer rather
  than left silent.
- **Q2 — Does `/games/$gameId` absorb the Mediator surface?** Recommendation:
  no. Different mode under ADR-021. Stated here because the route split makes
  it an obvious question.
- **Q3 — Discord-native join (the "Tier 4" from the original discussion).**
  Deliberately out of scope. `bot.ts` already binds channels to Games, so
  `/join` in a bound channel is a small addition — but it should sit on Tier
  3's approval primitive rather than beside it, and it wants its own plan.
- **Q4 — Kicking a member.** Out of scope, but §4.4's "revoking does not evict"
  makes its absence visible. Today the only exit is `ownership.leaveGame` by
  the member themselves.
