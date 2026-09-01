# ADR-035: No Isolated Local-Only Data — Closing the Migration Window

## Status

**Accepted and delivered.** The exemption is gone from `backendForMode`, the
migration runs from the root of the app, and `claimLocal` now writes a body whose
container agrees with the row it lands in.

**Partially supersedes [ADR-034](ADR-034-account-required-persistence.md)** — its
consequence that "declining the claim is a terminal choice, by design", and the
*offered, not automatic* rule that consequence rests on. Nothing else. ADR-034
remains the governing ADR for all three of its decisions: persistence requires an
account, Convex is the only source of truth, both apps are ordinary installable
PWAs. This ADR does not weaken any of them — it removes the one thing still
preventing the second from being true.

Re-affirms [ADR-032](ADR-032-public-read-only-sheets.md) without changing it. A
migrated build is **not** published: it lands on its owner's own shelf with
`publicRead` untouched and off.

## Context

ADR-034 was reported delivered, and its decisions were. Its *invariant* was not.

**A user had a roster that was present signed out and absent signed in.** Not a
sync delay — a stable, reproducible state of the product. That is precisely the
"second source of truth" ADR-034 exists to remove, alive in the shipped app
months after the flip.

Two independent defects produce it, and each is sufficient on its own.

### 1. The migration window never closed

The flip could not simply send every anonymous visitor to the in-memory backend:
years of Solo users had rosters in IndexedDB, and the memory store is empty, so
they would have opened ITUN and found nothing. `legacyLocalData.ts` is the guard
that was added for them — a browser holding a roster kept the durable local
backend "until the user takes the claim or exports. That is the migration
window, and it closes per browser rather than on a date."

**Nothing ever closed it.** The probe had three states and no code path
anywhere set it to `absent`; it could only ever be `unknown` or `present`. So the
guard did not open a window, it made the durable local backend **permanent** for
anybody who had ever built anything — which is every returning user.

The only path off the device was `ClaimLocalData`, and it could not carry that
weight:

- **It lived on the Account screen.** A player had to go looking for it. Nothing
  on the Roster — the screen where their builds were missing — mentioned it.
- **It could be dismissed forever**, per ADR-034's terminal-decline rule.
- **It counted the entity store, not IndexedDB.** For a signed-in player that
  store is filled from the server by `ShelfSync`. Once a sync had run, the card
  read a full account, computed `total === 0`, rendered `null` — and the local
  rows sat untouched beside it, with the app now actively reporting there was
  nothing to migrate.

### 2. A claimed build could arrive in the account and still be invisible

Migration v13 mapped every non-Default Workspace onto `gameId: <that workspace
id>`. Those ids name no Game that has ever existed — Workspaces were retired
before accounts shipped, so there is nothing for them to correspond to.

Signed out, nothing filters and `Roster` renders the pile whole, which is why
this was invisible for as long as it was. Signed in, `Roster` scopes to the
active container, and every such build is addressed to a Game the account is not
in. They vanish.

`claimLocal` did not fix this and could not have by accident: it inserts with
`gameId: null` in the **column** while storing the client's body verbatim, and
the client reads the **body**. So the row said shelf, the body said phantom Game,
and the client believed the body. A build could be claimed, owned, and
server-backed, and still not appear anywhere.

## Decision

### 1. Anonymous is anonymous. There is no exemption

`backendForMode` no longer consults the legacy probe. A build that requires an
account gives an anonymous visitor the in-memory backend, whatever that browser
is holding.

This is not a withdrawal of ADR-034's promise that existing local data is never
destroyed — see decision 2, which is what makes it keepable. The rows stay on
disk. What ends is their status as a place the app *writes to*: a device is not a
container.

### 2. The rows are migrated, not abandoned — and it runs by itself

Signed out, the app says what is on the device and offers both doors: sign in, or
download. Signed in, the reconciliation just runs, from the root of the app, on
every load, comparing IndexedDB against `entities.listMine` directly.

**The claim stops being an offer, and the decline is withdrawn.** ADR-034's
reasoning was that "uploading somebody's whole roster the instant they sign in is
a decision made on their behalf with their data", and that "signing in to look at
a friend's game should not thereby publish your own builds".

That reasoning describes a world with two legitimate homes for a build. ADR-034
itself ended that world; the sentence outlived the architecture it was written
for. Copying a shelf row into the account that already owns it is not
publication — nothing is shared, nothing becomes visible to anyone else, and
`publicRead` (ADR-032) stays off. Meanwhile *not* copying it is what produced the
bug in Context. Between a theoretical consent cost with no observable effect and
a demonstrated data-isolation defect, the defect wins.

**Export survives, and stays load-bearing.** It moves to where a person without
an account will actually meet it: beside the sign-in prompt, on every screen,
reading IndexedDB rather than the store — because for an anonymous session the
store is the in-memory backend, and the old export button would have handed
somebody downloading their pre-account roster an empty file.

### 3. A row's body must agree with the row it is stored in

`claimLocal` shelves the body it writes. A claim lands on the shelf by
definition, so a body that names a Game is not a preference to preserve, it is a
disagreement with the row around it — and the client reads the body.

The general rule, for review: **wherever a container is expressed twice, the two
must be written together.** A record whose column and body disagree is
addressable by one reader and invisible to another, which is a worse failure than
either value being wrong, because nothing looks broken from either side alone.

### 4. What counts as isolated

A local row is isolated — and therefore migrated — unless one of these holds:

- **the account owns it.** `listMine` returns everything the caller owns in any
  container, so presence there settles it.
- **it is in a Game the account belongs to.** These are the rows `GameRoster`
  caches deliberately: a Game's unclaimed pre-gens and its communal crawler have
  no owner at all, so they are legitimately absent from `listMine` while being
  entirely server-backed. Migrating one would copy somebody else's character onto
  your shelf.

Everything else is isolated, **including a row in a Game that does not exist**.
That is the second defect above, stated as a rule: a container nobody can reach
is not a container.

## Consequences

- **The offer is gone, and with it the decline.** Somebody who signs in has their
  device rows moved into their account without being asked. This is the
  substantive reversal in this ADR and it should be read as one, not as a
  cleanup. It is accepted because the account is theirs, the destination is their
  own shelf, and the alternative is the state that produced the bug report.

- **A user who wants no account is now told so on arrival**, rather than
  discovering it. That is a real change in tone for the signed-out experience,
  and the download beside the prompt is what keeps it from being a wall.

- **A signed-out player can no longer browse builds this browser is holding.**
  Before, a returning Solo user opened the app and saw their roster. Now they see
  a count and two doors. This is the honest reading of "persistence requires an
  account" and it is the cost of having one source of truth rather than two —
  but it is a capability that genuinely existed yesterday and does not today, so
  it is recorded here rather than in a commit message.

- **Cache pruning finally arms.** `mayPrune` has always required
  `legacyLocalDataState() === 'absent'`, which nothing could produce, so
  `ShelfSync`'s prune was dead code in every browser that had ever held a build.
  A completed migration now sets it. The corollary is the guard: a migration that
  strands even one row leaves the state `present`, so a browser that cannot fully
  reconcile never prunes. Pruning off is a stale cache; pruning on too early is
  deleted work.

- **The reconciliation is idempotent and re-runs on every load.** It is a query,
  a set comparison, and — in the steady state — no mutation at all. That is
  deliberate: a migration that runs once and records that it ran is a migration
  that cannot repair the browser it failed on, which is exactly how the
  `localStorage` claim marker failed before it.

- **`claimLocal` needed a repeat guard it did not have.** The NPC tray was the
  one claimed kind with no identity check, which was survivable while claiming
  was a button somebody pressed once and is not survivable when the same call
  runs on every signed-in load. It now matches on the id inside the body, like
  patterns.

- **`ClaimLocalData` is deleted rather than kept as a fallback.** A manual path
  beside an automatic one is a second answer to "did my roster arrive", and the
  manual one is the one that was wrong.

## Alternatives considered

**Fix the card instead: move it to the Roster, make it read IndexedDB, stop it
being dismissible.** Rejected. Each fix is correct and together they arrive at
"a prompt that appears on every screen, cannot be dismissed, and asks about
something the user has no reason to say no to" — which is a worse form of the
automatic migration, not an alternative to it.

**Keep the offer, but close the window on a date.** Rejected: it strands exactly
the users who did not engage with the prompt, which is the population the whole
mechanism exists for.

**Repair the phantom containers with a v16 IndexedDB migration.** Rejected as
insufficient rather than wrong. It would fix the rows on that one device while
leaving the same bodies already claimed into accounts untouched, and it does
nothing about rows that never reached the server. The claim is the one place both
populations pass through.

**Load the device rows into the anonymous in-memory session so a signed-out user
still sees them.** Rejected, and it was the most tempting option — it preserves
the signed-out experience exactly. It also re-creates the defect in a new place:
those rows would arm `AnonymousWorkPromoter`, which promotes the whole store
without knowing what the account already holds, so a sign-out/sign-in round trip
would re-claim rows the account already had and report them to the player as
builds that "could not be saved". The promoter is right to be uninformed; it is
for work built in this tab. Reconciliation needs `listMine`, and only the
signed-in path has it.
