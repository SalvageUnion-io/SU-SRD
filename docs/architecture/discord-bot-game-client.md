# The Discord Bot as a Game Client

The bot is an authenticated client of ITUN Games
([ADR-030](../adrs/ADR-030-accounts-games-server-of-record.md)): `/su me`,
`/su games`, `/su shelf`, `/su crew`, `/su sheet`, `/su game bind|unbind|info`,
`/su invite` ([ADR-039](../adrs/ADR-039-targeted-invites.md)) and roll
attribution on `/su roll` are built. It runs as HTTP interactions on the
`su-discord-bot` Cloudflare Worker
([ADR-033](../adrs/ADR-033-cloudflare-hosting.md)). What remains open is §6. The
bot's own conventions are in
[`apps/discord-bot/CLAUDE.md`](../../apps/discord-bot/CLAUDE.md); env vars and
verification are in [accounts-and-games.md](accounts-and-games.md).

## 1. How it is wired

The bot reaches Convex through `POST /bot/<op>` (`apps/itun/convex/botHttp.ts`)
with a bearer credential. Every `botClient` function is **internal**, so nothing
the bot calls is reachable from a browser. The credential exists in exactly two
places:

| Side                    | Variable                                   |
| ----------------------- | ------------------------------------------ |
| Convex deployment       | `ITUN_BOT_SECRET`                          |
| `su-discord-bot` Worker | `ITUN_BOT_SECRET` + `ITUN_CONVEX_SITE_URL` |

- **Generate and write both sides in one pass.** A mismatch fails as
  `unauthorized` with nothing to say which side is wrong, and neither side can
  show its value afterwards. One `openssl rand`, piped to `convex env set` and
  `wrangler secret put` in the same script, never printing it.
- **Verify without knowing the secret.** `POST /bot/<op>` with no credential
  answers **404** while `ITUN_BOT_SECRET` is unset (the surface is
  indistinguishable from absent) and **401** once it is set, so 404 → 401 proves
  the Convex half. On the bot, `GET /health` reports `configured.itun: true` and
  `mode: connected` — which proves the variables are present, not that they
  match. Only a real Game command proves that.

## 2. What the bot is for

> **The bot reads widely and writes narrowly.** It may show anything a member is
> entitled to see. It may write only through mutations that already exist, and
> only facts already modelled as a transaction or a proposal on the Change Log.
> It never opens a second write path.

Chat is good at three things the app is not: **glancing** (the crew's vitals
without leaving the voice channel), **attributing** (a roll the table saw is a
roll on the Change Log), and **shouting** (a Mediator alert lands where people
already look). Everything else is a non-goal:

- No character creation or editing in Discord — that is the Wizard's job.
- No `/su damage @player 3`. A Mediator writing another player's sheet is
  forbidden by ADR-030 §4 on every surface; it is a proposal or nothing.
- No new mutations for the bot's convenience. If an existing Convex function
  cannot say it, stop rather than add one. **The one exception is `/su invite`**
  (ADR-039): inviting by Discord account is a product feature, not a
  convenience, and it lives where Discord accounts are — so `botClient.invite`
  exists, mints through the same `model/invites.ts#mintInvite` as the web, and
  is reachable only through the signed path in §3.
- No service-role key that can act as anybody.
- No `apps/srd` involvement.

## 3. Decision: how the bot authenticates

The bot learns a Discord user id from an interaction and wants Convex to act for
that person. Somebody has to be trusted to say "this request is really from user
12345"; the question is who, and what a leak costs.

**Option A — Convex HTTP actions plus a shared bot secret. Built.** The bot sends
`Authorization: Bearer $ITUN_BOT_SECRET` and the Discord id. Convex verifies the
secret, resolves `discordId → user → membership`, and runs the same
`model/permissions.ts` checks as every other caller, so an Organizer-only act
stays Organizer-only. Stated plainly, the secret **asserts** identity: whoever
holds it can claim to be any linked player and read every sheet in every bound
Game. It cannot invent a membership, reach an unlinked account, read somebody
else's shelf, or see `encounterNpcs` — but it is a bearer credential. Store it in
1Password and as a wrangler secret, never in git; keep the route namespace to
member-level reads and roll recording; rotate on any suspicion.

**Option B — Discord-signed interactions verified by Convex. The endgame.** Point
Discord's interactions endpoint at a Convex HTTP action and verify Discord's
Ed25519 signature against the application public key. The user id is then
**attested by Discord** rather than asserted by us, and no bearer secret exists
to leak. The bot already needs no gateway connection, so this is a transport
change: the Convex functions are shaped not to care who called them.

**Option B, taken for one operation: `/su invite`.** An invite creates a
membership, which the bearer credential must never be able to do — so for that
operation alone the bot forwards Discord's signed interaction verbatim (raw
body plus `X-Signature-Ed25519` / `X-Signature-Timestamp`) to `POST
/bot/invite`, and `botHttp.ts` verifies it against `DISCORD_PUBLIC_KEY` on the
Convex deployment, rejects a timestamp older than five minutes, and hands the
raw body to `botClient.invite`, which reads the inviter, the invitee, the Game
and the seat out of it. `invite` is deliberately absent from the args-forwarding
map. With `DISCORD_PUBLIC_KEY` unset the command answers that invites from
Discord are not switched on; every other op is unaffected. Moving the rest of
`/bot/*` the same way is still the endgame above.

**Option C — per-user OAuth tokens. Rejected.** The bot would store N refresh
tokens (a worse thing to leak than one secret) plus a token store and refresh
handling, and ADR-030 chose Discord as the sole provider to avoid a second
credential story.

## 4. There is no linking step

Discord is the only auth provider, and `@convex-dev/auth` records every sign-in
in `authAccounts` with the Discord snowflake as `providerAccountId`. So every
account already carries the id the bot has in hand, and the bot resolves identity
through that index (`model/bot.ts#userByDiscordId`). The `users.discordId`
column is not the resolution path and nothing reads it. `/su me` is a
confirmation, not a linking command.

## 5. The bot has Solo and Connected modes too

| Mode          | Condition                                  | Behaviour                                                    |
| ------------- | ------------------------------------------ | ------------------------------------------------------------ |
| **Solo**      | ITUN variables unset                       | Roll and lookup only; Game subcommands reply "not connected" |
| **Connected** | both variables set                         | Full surface                                                 |
| **Degraded**  | configured, Convex unreachable             | Reference commands keep working; Game commands say so        |

**`/su roll` and `/su lookup` must behave identically whether or not Convex is
configured**, and subcommands are always registered. Silence vs explanation:
`resolveActor` returns `null` for no binding, no account and not a member alike,
so a public channel never reveals who has an account. A **passive** path (a roll
being recorded) stays silent; an **explicit** one (`/su crew` in an unbound
channel) replies ephemerally with the actual reason.

## 6. Open work

### Phase 5 — Mediator alerts to the channel

A Mediator broadcast (`proposals.broadcast`) should land in the bound channel as
well as on the Dashboard. This turns the bot from request/response into a
stateful listener — one subscription per bound channel, reconnection handling —
so it is the highest-complexity item. It needs the `convex` package, which the
bot deliberately does not depend on today (its client is plain `fetch`). Posting
from a Worker also changes shape: under Option B it becomes an outbound REST call
from a Convex action.

- **Replay on restart:** watermark by the Change Log and never post an entry
  older than the subscription.
- **Discord's 3-second ack window** still applies to every command that touches
  Convex; defer the reply.

### Phase 6 — Proposals with Apply / Decline buttons (stretch)

A Mediator proposes "−3 HP"; the player gets a card with `[Apply]` `[Decline]`.
Legitimate under ADR-030 — the player still applies it, and there is no
force-apply — but it is the bot's first write on a player's own sheet. Hold it
until the read surfaces show the channel is somewhere people look; until then an
alert with a deep link to the Dashboard is the honest version.

### Smaller gaps, deliberately left

- **No _Post to channel_ button** on ephemeral cards. `/su crew` is already
  public; the `su:<action>:<payload>` custom-id scheme has room for a `share`
  action when someone asks for one.
- **`/su crew` maxima can differ from the app's.** `mechStats`
  (`apps/discord-bot/src/gameEmbed.ts`) derives Max SP and Max Heat without a
  `PilotingContext`, so a pilot ability that contributes to its mech is not
  counted. Closing it means resolving mech → pilot through
  `softLinks` (app-level ids, not Convex ids) and threading the pilot's
  abilities through the `crew` payload.
- **Unclaimed entities** (`ownerId: null`) must render as **Unclaimed**, never
  as a blank owner — the same hazard the web surfaces carry.
