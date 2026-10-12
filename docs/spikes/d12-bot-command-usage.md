# Spike D12: cut the Discord bot's Game client by usage?

Status: **decided 2026-10-12: cut nothing yet, measure first.** Nothing is
deleted. The owner's decision, on the spike PR:

- Ship the per-interaction log. It shipped with this spike, in
  `apps/discord-bot/src/worker/index.ts`.
- The owner runs [queries 1 and 2](#what-the-owner-needs-to-run) now.
- After 30 days of the log, the owner picks an [option](#options) against the
  [thresholds](#decision-thresholds-proposed-the-owner-may-adjust-them).

## Question

`/su roll` and `/su lookup` clearly earn their keep. Do the In The Union Now
(ITUN) Game-client commands also earn theirs? Those are `/su me`, `games`,
`my-stuff`, `crew`, `sheet`, `invite`, the `/su game bind|unbind|info` group, and
the roll attribution that rides on `/su roll`. Should any of them be cut?

## Measurements

### Usage: not measured, and before the log it could not be

I tried every source a cloud session can reach. None of them gives a count per
command. The table describes the bot as it was before the spike added its log
line.

| Source | Result in this session | Could it answer the question? |
| --- | --- | --- |
| Sentry MCP | failed to connect (proxy 403) | **No, even when connected.** The Worker sets `tracesSampleRate: 0` (`packages/observability/src/cloudflare.ts`), so Sentry receives errors only, tagged `{ fn: 'dispatch', type }` with no command name. An error count is not a usage count. |
| `cloudflare-observability` / `cloudflare-bindings` MCPs | failed to connect (proxy 403) | **No, not per command.** `observability.enabled` stores invocation logs, but the Worker never logs the interaction it handled: `apps/discord-bot/src` has no `console.*` outside `deploy-commands.ts`. The command name lives only in the request body, which is not logged. |
| Cloudflare connector (`workers_get_worker`) | reachable: `su-discord-bot`, id `862263da8435483fb491bbf70de26bb7` | No. It returns script metadata only, with no analytics. |
| `wrangler tail` | not runnable here (no Cloudflare credentials) | **No.** `--search` matches log messages, and the Worker logs none. It cannot filter on the interaction name. |
| Convex MCP | connected, but bound to the **local** deployment | No. Production is `alex-jarvis:suref-itun:prod`. |

Before the log, the only total the Worker could report was the request count, and that
mixes autocomplete, button presses and Discord's pings with real commands. So
there are **no usage numbers in this doc**. The two things that *can* be
measured are listed under [what the owner needs to run](#what-the-owner-needs-to-run).

### Cost: measured

All counts are `wc -l` on `design-refresh` at `4cd3a70`.

| Slice | Bot src | Bot tests | Convex src | Convex tests |
| --- | ---: | ---: | ---: | ---: |
| `/su roll` + `/su lookup` (kept either way) | 1,126 | 833 | — | — |
| **Whole Game client** | **1,975** | **1,899** | **1,336** | **1,039** |

The Game-client total covers these files:

- **Bot src:** `gameCards.ts` 871; `commands/` `account` 58, `crew` 162, `game` 158, `invite` 154, `itunReply` 120 and `rollAttribution` 92; `inviteContainer.ts` 75; `itun/client.ts` 232; `itun/types.ts` 53.
- **Bot tests:** `gameCards` 442, `connectedMode` 521, `degradedMode` 98, `itunClient` 200, `sheetCard` 197, `sheetVisibility` 155, `invite` 286.
- **Convex src:** `botClient.ts` 570, `botHttp.ts` 222, `model/botWire.ts` 185, `model/bot.ts` 169, `model/discordInteraction.ts` 190.
- **Convex tests:** `bot` 520, `botHttp` 77, `botInvite` 442.

So the Game client is about **6,250 lines across both apps** (3.3k source and
2.9k tests). That is more than the ~2.5k the audit estimated, because the
audit did not count the tests or the Convex side.

Each command's share is attributed by the line ranges of its own functions in
`gameCards.ts`, `botClient.ts` and the test `describe` blocks. All figures are
approximate (≈):

| Command | Bot src | Convex src | Tests (bot + Convex) | Needs a bound channel | Notes |
| --- | ---: | ---: | ---: | --- | --- |
| `/su sheet` | 410 | 50 | 415 + 180 | yes | Largest single card: the whole live sheet mapped onto an entity card. |
| `/su invite` | 229 | 336 | 286 + 442 | no (picks a Game) | Signed-interaction path (ADR-039). Convex verifies Discord's signature itself. |
| `/su game bind\|unbind\|info` | 232 | 89 | 154 + 100 | — (it makes the binding) | **Prerequisite** for `crew`, `sheet` and roll attribution. |
| `/su me`, `games`, `my-stuff` | 147 | 60 | 15 + 49 | no | Personal reads that duplicate ITUN's own home screen. |
| `/su crew` | 120 | 50 | 178 + 48 | yes | |
| Roll attribution (not a command) | 92 | 51 | 63 + 85 | yes | #623's exit criterion: a Discord roll lands on the Dashboard. |
| Shared spine | 722 | 700 | 754 + 77 | — | `itunReply`, the client, wire types, `gameCards` helpers, `botHttp`, `model/bot`. It goes only if every Game command goes. |

Two structural facts limit the options:

1. **Cutting `/su game` effectively cuts `crew`, `sheet` and roll attribution.**
   All three resolve the Game from the channel binding.
2. **The shared spine (~1.4k src) remains while any Game command remains.**
   Cutting one leaf saves that leaf's rows and no more. The large saving
   appears only when every Game command goes.

## Options

| | Cut | Saves (src + tests, ≈) | Loses |
| --- | --- | ---: | --- |
| A | Nothing | 0 | — |
| B | `me`, `games`, `my-stuff` | ~270 | Personal lookups that ITUN's web app already shows. |
| C | `/su sheet` | ~1,050 | The full sheet in Discord. `/su crew` still links each sheet to the app. |
| D | B + C | ~1,320 | Both of the above. |
| E | The whole Game client | ~6,250 | Roll → Dashboard (#623), Discord invites (ADR-039), and the bind story in ADR-030 Phase 6. It also retires the `/bot/*` route and the `ITUN_BOT_SECRET` / `ITUN_CONVEX_SITE_URL` secrets. |

## Recommendation

**Do not cut anything on the current evidence. Measure first, then apply the
thresholds below.**

- There are no usage numbers. Cutting by line count alone would remove the one
  feature (roll attribution) that ITUN's design treats as an exit criterion.
- Run the Convex queries below now. They are durable, all-time data, and they
  can settle option E today: a Game client that has never been bound in
  production does not need a month of logging to judge.
- For B, C and D, a per-command count is needed. `dispatch`
  (`apps/discord-bot/src/worker/index.ts`) now logs one line per interaction,
  `{ evt: 'interaction', type, name }`. `name` is `su game bind` for a command
  or its autocomplete, `su:roll` for a button, and `null` for a ping. It never
  carries a user id, an option value or a button payload. Leave it running for
  **30 days**. If Workers Logs retention proves too short, an Analytics Engine
  data point with the same fields is the follow-up.

### Decision thresholds (proposed; the owner may adjust them)

Over a 30-day window, after instrumentation:

- **Cut a leaf command** (B or C) when it has fewer than **1%** of all `/su`
  executions **and** fewer than **5 distinct Discord users**.
- **Cut the whole Game client** (E) when all of these hold:
  - production has **≤ 2 channel bindings** outside the owner's own test Games;
  - there are **0** Discord-recorded rolls in the last **90 days**;
  - there are **0** bot-minted invites in the last **90 days**.

  The binding and roll checks are answerable now, from the queries below.
- **Keep everything** when any bound channel has recorded rolls from **≥ 2
  distinct players** in the last 90 days. That is a table really using it.

## What the owner needs to run

### 1. Now: durable adoption data in Convex production

Run this in the Convex dashboard's function runner ("custom query") against
production `alex-jarvis:suref-itun:prod`. It is read-only.

```ts
export default query(async (ctx) => {
  const since = Date.now() - 90 * 24 * 60 * 60 * 1000
  const bindings = await ctx.db.query('channelBindings').collect()
  const botInvites = (await ctx.db.query('invites').collect()).filter((i) => i.sourceInteractionId)
  let rolls = 0
  let rolls90 = 0
  const rollGames = new Set<string>()
  const rollers = new Set<string>()
  for (const game of await ctx.db.query('games').collect()) {
    const rows = await ctx.db
      .query('changeLog')
      .withIndex('by_game_source_ts', (q) => q.eq('gameId', game._id).eq('source', 'discord-bot'))
      .collect()
    for (const row of rows) {
      if (row.field !== 'roll') continue
      rolls++
      if (row.ts >= since) {
        rolls90++
        rollGames.add(game._id)
        if (row.actorId) rollers.add(row.actorId)
      }
    }
  }
  return {
    bindings: bindings.length,
    bindingsBoundIn90d: bindings.filter((b) => b.boundAt >= since).length,
    botInvites: botInvites.length,
    botInvitesIn90d: botInvites.filter((i) => i.createdAt >= since).length,
    discordRollsAllTime: rolls,
    discordRollsIn90d: rolls90,
    gamesWithDiscordRollsIn90d: rollGames.size,
    distinctDiscordRollersIn90d: rollers.size,
  }
})
```

If the tables have outgrown a single query's read limit, page it the way the
[`convex-ops`](../../.claude/skills/convex-ops/SKILL.md) skill describes for
repairs.

### 2. Now: per-command counts for the Game commands, as far back as the logs go

Each Game command calls one `botClient:*` function, so the Convex function log
is a per-command count for exactly the commands in question:

```bash
cd apps/itun
bunx convex logs --deployment alex-jarvis:suref-itun:prod --history 100000 --jsonl \
  | jq -r 'select(.identifier? // .udfPath? | tostring | startswith("botClient:")) | (.identifier // .udfPath)' \
  | sort | uniq -c | sort -rn
```

Here is how each function maps to a command:

| Function | Command |
| --- | --- |
| `me`, `games`, `shelf` | `/su me`, `games`, `my-stuff`; `games` also serves the `game bind` and `invite` autocomplete |
| `crew` | `/su crew`, plus `sheet` autocomplete |
| `sheet` | `/su sheet` |
| `channel` | `/su game info` |
| `bind`, `unbind` | `/su game bind`, `unbind` |
| `recordRoll` | **every** `/su roll` and re-roll button in a channel, bound or not |
| `invite`, `inviteDelivery` | `/su invite` |

`recordRoll` doubles as a baseline for `/su roll` itself. `attributeRoll`
(`apps/discord-bot/src/commands/rollAttribution.ts`) calls it for every roll
with a channel and discards the answer unless the channel is bound. So this
one log ranks the Game commands against the bot's core use, before any
instrumentation ships. Query 1 gives the bound-channel subset. Autocomplete
calls also land on `games` and `crew`, so treat those two counts as upper
bounds.

Field names in `--jsonl` vary by CLI version. Check one line first and adjust
the `jq` path. The window is whatever history the deployment keeps; note it
next to the counts.

### 3. Once the log is deployed: per-command counts across the whole bot

This is the only way to compare the Game commands against `/su roll` and
`/su lookup`. Count from the day the log deploys, for 30 days:

- **Workers Logs** (Observability → `su-discord-bot`): filter
  `evt = "interaction"` and `type = 2` (commands; `4` is autocomplete, `3` a
  button), group by `name`, count. Workers Logs keeps days, not months, so
  record a count at the end of each retention window and sum them.
- **Live spot check:** `wrangler tail su-discord-bot --format json --search '"evt":"interaction"'`.

### 4. Decide

Apply the thresholds above. Pick A–E, and open the cut as its own PR. A removed
subcommand deregisters on the next `bun run deploy-commands:global`.
