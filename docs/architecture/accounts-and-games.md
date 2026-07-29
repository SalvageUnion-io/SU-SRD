# Accounts, Games & the Live Game Dashboard

> **Status:** Delivery plan for [ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md).
> The ADR records _why_ and _what_; this document records _in what order_ and
> _what breaks_. **Phases 0-6 have landed as a stack of draft PRs** (#609 through
> #645). The server layer, data model and permission rules are complete and
> tested; the surfaces for Phases 3-5 are wired to that data but want a design
> pass before they are called finished.
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

### Phase 1 — Accounts, Games & sync ✅

Everything structural, nothing live. The Dashboard stays single-player, which is
what de-risks the rest.

- Convex project, schema, Discord OAuth ✅ (see `apps/itun/convex/`)
- Games: create, rename, delete, invite code, join
- `Workspace` → `Game` + `Shelf` split; nullable `gameId`. **The client cutover
  has now landed too**: the Workspace switcher, list, and assign controls are
  deleted, the Roster/Encounter surfaces resolve through `lib/container.ts`, the
  Starter Set seeds onto the Shelf, and Dashboard dial prefs moved off the
  Workspace record into `cockpitPrefsStore` (localStorage, keyed by container).
  Solo surfaces render unfiltered — see the note in `activeContainerStore.ts`.
- The three storage modes + the **NOT CONNECTED** banner
- Claim-local-data flow on first sign-in
- "Fork into Game" and "copy to shelf"
- Starter Set re-homed as a Game template, its entities unclaimed
- Account management: profile, My Games, export, delete

**Exit:** two people sign in, one creates a Game, the other joins by code, and
each sees their own entities scoped to it — on two machines. An account can be
fully deleted.

### Phase 2 — Roles & visibility ✅

Capabilities on membership, Organizer transfer, Mediator assignment,
**server-side** authorization on every mutation, read-only crewmate drill-in,
ownership assign/release/reassign, owner chips.

**Exit:** the capability matrix is enforced in Convex, proven by tests that a
Player cannot write a crewmate's pilot and that an Organizer gains nothing over
content by holding the flag.

### Phase 3 — The Mediator surface ✅ (server; screen wants a design pass)

Crew roster with live vitals, the communal crawler, the NPC tray; `/encounter`
absorbed and retired; presence.

### Phase 4 — Alerts & propose/confirm ✅

Proposal states on the Change Log, same-field supersession, player Apply/Decline,
broadcast alerts, and the **Crew** dial item.

### Phase 5 — Synchronized Downtime ✅

Downtime phase as Game state advanced by the Mediator; per-player step completion
visible to the table; crawler upkeep resolved once rather than six times.

### Phase 6 — Discord bot as a Game client ✅

The bot authenticates as a participant rather than an admin; rolls made in
Discord land as Change Log entries.

---

## 5. What breaks

| Site                   | Hazard                                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entityStore`          | Write-through to IndexedDB is the single write path for the whole app; the server of record inverts it. Keep the public API identical and swap the backend beneath it.      |
| `activeWorkspaceStore` | **Replaced** by `activeContainerStore`, which persists `shelf` \| `game:<id>`. The "exactly one current container" invariant survives; it is only consulted when Connected. |
| `db/broadcast.ts`      | Cross-tab invalidation is superseded by Convex reactivity **only in Connected mode**. Keep it — Solo needs it.                                                              |
| `ExportBundle`         | `schemaVersion: 1` is a literal. Adding ownership columns is breaking; bump to `2` and keep reading v1 as Solo entities.                                                    |
| Migration v10          | The Default-workspace backfill must become a no-op for anyone who never signs in.                                                                                           |
| Nullable `ownerId`     | Every surface reading an owner must render **Unclaimed** as a state, not a blank or a crash.                                                                                |
| Owner chips            | Pass as a `badge` control from the app — do not teach `component-lib` about users; `apps/srd` must need no change.                                                          |
| PWA + auth             | A token expiring mid-session should present as Disconnected, not as a crash.                                                                                                |
| PII                    | Account deletion, export, and a privacy note are Phase 1 scope.                                                                                                             |
| Snapshots              | None. [ADR-004](../adrs/ADR-004-snapshot-netlify-functions.md) is untouched, and becomes the only unauthenticated surface left.                                             |

---

## 6. External services — operational reference

Everything needed to stand this up, or to work out why sign-in is failing.
Values here are **not secret**: deployment URLs and a Discord client id are
public by design. The client _secret_ lives only on the Convex deployments.

### Convex

|                                       | Dev                                      | Production                                    |
| ------------------------------------- | ---------------------------------------- | --------------------------------------------- |
| Deployment                            | `dev/alex-jarvis` (`perfect-donkey-72`)  | `exuberant-porpoise-183`                      |
| Client URL (`VITE_CONVEX_URL`)        | `https://perfect-donkey-72.convex.cloud` | `https://exuberant-porpoise-183.convex.cloud` |
| HTTP actions (`VITE_CONVEX_SITE_URL`) | `https://perfect-donkey-72.convex.site`  | `https://exuberant-porpoise-183.convex.site`  |
| `SITE_URL` (the **frontend** origin)  | `http://localhost:5173`                  | `https://intheunionnow.com`                   |

Project: `alex-jarvis:suref-itun` ·
[dashboard](https://dashboard.convex.dev/t/alex-jarvis/suref-itun)

### Netlify

| Site               | Serves                           | Notes                                                                                                                                        |
| ------------------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `in-the-union-now` | `https://intheunionnow.com`      | ITUN. **The production origin is the custom domain, not the `.netlify.app` subdomain** — `SITE_URL` and the OAuth redirect must both use it. |
| `suindex`          | `https://salvageunion.io`        | `apps/srd`. No accounts, ever.                                                                                                               |
| `su-assets`        | `https://assets.salvageunion.io` | Entity artwork. Unrelated to accounts.                                                                                                       |

### Discord

One application covers both the bot and web sign-in, so players meet a consent
screen they already recognise and there is one credential to rotate. Resetting
the OAuth2 client secret does **not** disturb the bot token — they are separate
credentials on the same app.

Each deployment needs its **own** redirect URI, and Discord permits several, so
adding one is additive rather than a swap:

```
https://perfect-donkey-72.convex.site/api/auth/callback/discord      (dev)
https://exuberant-porpoise-183.convex.site/api/auth/callback/discord (prod)
```

The path is not arbitrary: `@convex-dev/auth` mounts callbacks under
`/api/auth/callback/` and appends the provider id, which `@auth/core` declares
as `discord`.

### Required deployment variables

**All three, or sign-in fails**, per deployment:

```bash
bunx convex env set AUTH_DISCORD_ID     <client-id>
bunx convex env set AUTH_DISCORD_SECRET <client-secret>
bunx convex env set SITE_URL            <frontend origin>
# add --prod to target production
```

`SITE_URL` is the one that bites. It is the **frontend** origin, _not_
`VITE_CONVEX_SITE_URL`, nothing prompts for it, and omitting it fails with an
opaque `Missing environment variable SITE_URL` 500 from the OAuth callback
rather than anything pointing at configuration.

### Verifying a deployment without signing in

Curl the callback. The status distinguishes all three failure modes:

| Result                                 | Means                                                      |
| -------------------------------------- | ---------------------------------------------------------- |
| **302** → your `SITE_URL`              | Correctly configured.                                      |
| **500** `Missing environment variable` | `SITE_URL` unset.                                          |
| **404**                                | Auth routes not mounted — check `convex/http.ts` deployed. |

Always check a bogus provider too (`/api/auth/callback/bogusprovider` → **500**).
Without that control, a router answering everything looks identical to one
correctly configured for Discord.

```bash
curl -s -D - -o /dev/null https://<deployment>.convex.site/api/auth/callback/discord | grep -i location
```

### Switching production on

Production builds in **Solo mode** until `VITE_CONVEX_URL` is set on the Netlify
site — which is safe and deliberate, not an outage: a build with no Convex URL
is the pre-accounts app, fully working. To switch accounts on:

1. Add the prod redirect URI to the Discord application (above). **Done.**
2. Set `VITE_CONVEX_URL=https://exuberant-porpoise-183.convex.cloud` on the
   `in-the-union-now` Netlify site (production context, `builds` scope) and
   redeploy. **Done** — it is a build-time variable, so it only takes effect on
   the next deploy, not immediately.

> **Note the two different origins.** That site also carries a pre-existing
> `VITE_SITE_URL` of `https://in-the-union-now.netlify.app`, while the primary
> domain — and Convex's `SITE_URL` — is `https://intheunionnow.com`. Sign-in
> therefore returns a visitor to the canonical domain even if they started on
> the `.netlify.app` subdomain. That is defensible, but it is a difference
> somebody will eventually trip over, so it is written down rather than left to
> be rediscovered.

Reversing it is equally simple: unset the variable and production returns to
Solo, with every local build intact.

### Secrets

Never commit the client secret. `.env.local` is gitignored and holds only the
non-secret deployment URLs. When reading a value back, pipe it — do not echo it
into a terminal or a transcript. `bunx convex env get` prints in the clear, so
prefer testing presence by length:

```bash
bunx convex env get AUTH_DISCORD_SECRET | tr -d '[:space:]' | wc -c
```

Exit code is **not** a presence check: `convex env get` exits 0 for a variable
that does not exist.
