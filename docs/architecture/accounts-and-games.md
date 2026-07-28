# Accounts, Games & the Live Game Dashboard

> **Status:** Delivery plan for [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md).
> The ADR records _why_ and _what_; this document records _in what order_ and
> _what breaks_. Phase 0 and part of Phase 1 have landed; everything from Phase 2
> on is planned, not built.
>
> Read alongside [ADR-021](../adrs/ADR-021-itun-surface-taxonomy.md) (the
> enforcement modes this adds an ownership axis to),
> [ADR-022](../adrs/ADR-022-provenance-log-and-overrides.md) (the Change Log this
> promotes to a sync spine), and [dashboard.md](dashboard.md).

---

## 1. The shape of the change

ITUN today is one person, one browser: entities in IndexedDB, Workspaces
organizing builds, a single-player Dashboard, and one server surface — the
immutable snapshot endpoint.

After this work: Discord-authenticated accounts, **Games** as the shared
container, **Shelves** as the personal one, entity ownership, a distinct Mediator
surface, and a Dashboard that synchronizes a table.

What does **not** change: anonymous Solo play, snapshot sharing, `apps/srd`, the
ADR-021 enforcement modes, and the locked Dashboard canvas.

---

## 2. Decisions

The full decision record is [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md).
In brief, grouped:

| Area         | Decision                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Truth        | Convex is the server of record; IndexedDB becomes a cache. Offline writes are **blocked**.             |
| Identity     | Discord OAuth only, reusing the bot's existing Discord application.                                    |
| Containers   | **Game** (shared) and **Shelf** (personal). One entity, one container. Moving is an explicit fork.     |
| Roles        | Base role Player \| Mediator, plus an orthogonal **Organizer** flag. Organizer ⇒ no content authority. |
| Cross-player | **Propose → player confirms.** Never a direct write, never force-applied.                              |
| Ownership    | Nullable. Mediator assigns (Organizer falls back); owners release; Mediator reassigns.                 |
| Crawler      | Communal, field-level merge.                                                                           |
| Visibility   | Live vitals for all; read-only sheet drill-in; Mediator NPCs hidden.                                   |
| Surfaces     | New Mediator surface absorbs `/encounter`; a **"Crew" dial item** on the player Dashboard.             |
| Anonymous    | Solo stays first-class and needs no account, forever.                                                  |

---

## 3. Three storage modes

Every store, hook, and surface must be legible in all three. This is the largest
source of subtle bugs in the whole plan — check surfaces against the table, not
against intuition.

| Mode             | Who                | Truth        | Reads                 | Writes      | Games  |
| ---------------- | ------------------ | ------------ | --------------------- | ----------- | ------ |
| **Solo**         | not signed in      | IndexedDB    | local                 | local       | none   |
| **Connected**    | signed in, online  | Convex       | reactive subscription | to Convex   | full   |
| **Disconnected** | signed in, offline | Convex, gone | cache                 | **blocked** | frozen |

**Solo is not Disconnected.** Someone who never signs in never sees a banner and
never loses a write.

---

## 4. Delivery phases

Each phase's exit criterion is the next one's precondition.

### Phase 0 — Decide & clear the ground ✅

- ADR-030 written; ADR-001 marked superseded; ADR-022 amended by reference.
- `lib/eldridgeCoast/` deleted — a personal home campaign does not belong in the
  shipped bundle once real Games exist.
- Stale tracker items closed: **#157** (invite codes, superseded by Phase 1) and
  **#165** (assumes a Supabase service-role key and RLS policies).
  **#152 and #156 stay open** — their remaining stories (Downtime, advancement,
  Pushing, Crafting, Salvage) are single-player gameplay mis-filed under
  "Multiplayer", and closing them would destroy live backlog.

### Phase 1 — Accounts, Games & sync

Everything structural, nothing live. The Dashboard stays single-player, which is
what de-risks the rest.

- Convex project, schema, Discord OAuth ✅ (see `apps/itun/convex/`)
- Games: create, rename, delete, invite code, join
- `Workspace` → `Game` + `Shelf` split; nullable `gameId`
- The three storage modes + the **NOT CONNECTED** banner
- Claim-local-data flow on first sign-in
- "Fork into Game" and "copy to shelf"
- Starter Set re-homed as a Game template, its entities unclaimed
- Account management: profile, My Games, export, delete

**Exit:** two people sign in, one creates a Game, the other joins by code, and
each sees their own entities scoped to it — on two machines. An account can be
fully deleted.

### Phase 2 — Roles & visibility

Capabilities on membership, Organizer transfer, Mediator assignment,
**server-side** authorization on every mutation, read-only crewmate drill-in,
ownership assign/release/reassign, owner chips.

**Exit:** the capability matrix is enforced in Convex, proven by tests that a
Player cannot write a crewmate's pilot and that an Organizer gains nothing over
content by holding the flag.

### Phase 3 — The Mediator surface

Crew roster with live vitals, the communal crawler, the NPC tray; `/encounter`
absorbed and retired; presence.

### Phase 4 — Alerts & propose/confirm

Proposal states on the Change Log, same-field supersession, player Apply/Decline,
broadcast alerts, and the **Crew** dial item.

### Phase 5 — Synchronized Downtime

Downtime phase as Game state advanced by the Mediator; per-player step completion
visible to the table; crawler upkeep resolved once rather than six times.

### Phase 6 — Discord bot as a Game client

The bot authenticates as a participant rather than an admin; rolls made in
Discord land as Change Log entries.

---

## 5. What breaks

| Site                   | Hazard                                                                                                                                                                 |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entityStore`          | Write-through to IndexedDB is the single write path for the whole app; the server of record inverts it. Keep the public API identical and swap the backend beneath it. |
| `activeWorkspaceStore` | Holds a raw id in `localStorage` with a hardcoded default. The "always exactly one current container" invariant survives; its guarantor changes.                       |
| `db/broadcast.ts`      | Cross-tab invalidation is superseded by Convex reactivity **only in Connected mode**. Keep it — Solo needs it.                                                         |
| `ExportBundle`         | `schemaVersion: 1` is a literal. Adding ownership columns is breaking; bump to `2` and keep reading v1 as Solo entities.                                               |
| Migration v10          | The Default-workspace backfill must become a no-op for anyone who never signs in.                                                                                      |
| Nullable `ownerId`     | Every surface reading an owner must render **Unclaimed** as a state, not a blank or a crash.                                                                           |
| Owner chips            | Pass as a `badge` control from the app — do not teach `component-lib` about users; `apps/srd` must need no change.                                                     |
| PWA + auth             | A token expiring mid-session should present as Disconnected, not as a crash.                                                                                           |
| PII                    | Account deletion, export, and a privacy note are Phase 1 scope.                                                                                                        |
| Snapshots              | None. [ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md) is untouched, and becomes the only unauthenticated surface left.                                        |

---

## 6. External services

| Resource       | Value                                                       |
| -------------- | ----------------------------------------------------------- |
| Convex project | `alex-jarvis:suref-itun`                                    |
| Dev deployment | `dev/alex-jarvis`                                           |
| Discord app    | the bot's existing application (one app covers bot + login) |
| Redirect URI   | `<VITE_CONVEX_SITE_URL>/api/auth/callback/discord`          |

Required deployment variables — all three, or sign-in fails:
`AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`, and `SITE_URL` (the **frontend**
origin, which is _not_ `VITE_CONVEX_SITE_URL`; omitting it fails with an opaque
`Missing environment variable` 500). See `apps/itun/.env.example`.
