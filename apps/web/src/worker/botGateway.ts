/**
 * `BotGateway`: the Discord bot's way in, over a service binding
 * (`su-discord-bot`'s `SITE`). A binding reaches only this entrypoint, so no secret is presented and none
 * can leak; the bot still names the Discord user, and every answer is
 * resolved against that user's account and memberships.
 *
 * It answers from the shared database, in the wire bodies of
 * `game-domain/botWire`; `sheet` and `mine` read the rooms (`./botSheets.ts`).
 * When a room cannot answer it answers null, which the bot says as
 * unavailable. A sheet from the rooms carries its `vitals` (`unitVitals`).
 */

import { exports, WorkerEntrypoint } from 'cloudflare:workers'
import { botDenial } from 'game-domain/botDenials'
import type {
  BindChannelArgs,
  BindChannelResult,
  BotFailure,
  BotFeedbackArgs,
  BotFeedbackResult,
  BotOpName,
  BotSuccess,
  BotUsageArgs,
  BotUsageResult,
  GamesResult,
  LogRollArgs,
  LogRollResult,
  MeResult,
  UnbindChannelArgs,
  UnbindChannelResult,
} from 'game-domain/botWire'
import { isPostableRoll } from 'game-domain/botWire'
import type { SheetTable } from 'game-domain/entityKinds'
import { FEEDBACK_REFUSAL, FEEDBACK_THANKS } from 'game-domain/feedback'
import type { LogEntry } from '../rooms/game/log'
import type { BotRooms } from './botSheets'
import { mine, sheet, shownName } from './botSheets'
import { accountByDiscordId } from './shared/accounts'
import {
  bindChannel,
  bindingBy,
  CHANNEL_NOT_FOUND,
  GAME_NOT_FOUND,
  unbindChannel,
} from './shared/channelBindings'
import type { SharedDb } from './shared/db'
import { acceptFeedback } from './shared/feedback'
import { gamesOf, membershipOf } from './shared/games'
import { bumpUsage, touchGuild } from './shared/signals'

type GatewayEnv = { SHARED?: SharedDb }

type BotAnswer = BotFailure | BotSuccess<unknown>

async function me(
  db: SharedDb,
  rooms: BotRooms | undefined,
  discordId: string
): Promise<BotFailure | BotSuccess<MeResult>> {
  const account = await accountByDiscordId(db, discordId)
  if (account === null) return botDenial('unlinked')
  return {
    ok: true,
    user: {
      userId: account.account_id,
      displayName: await shownName(rooms, discordId, account),
      avatarUrl: account.avatar_url,
    },
    games: await gamesOf(db, discordId),
  }
}

async function games(
  db: SharedDb,
  discordId: string
): Promise<BotFailure | BotSuccess<GamesResult>> {
  const account = await accountByDiscordId(db, discordId)
  if (account === null) return botDenial('unlinked')
  return { ok: true, games: await gamesOf(db, discordId) }
}

async function usage(db: SharedDb, args: BotUsageArgs): Promise<BotUsageResult> {
  const name = args.name.trim().slice(0, 64)
  if (name.length > 0) await bumpUsage(db, `bot:${name}`)
  const guildId = args.guildId?.trim() ?? ''
  if (guildId.length > 0) await touchGuild(db, guildId.slice(0, 32))
  return { ok: true }
}

async function feedback(db: SharedDb, args: BotFeedbackArgs): Promise<BotFeedbackResult> {
  const refusal = await acceptFeedback(db, {
    sender: `discord:${args.discordId}`,
    source: 'bot',
    kind: args.kind,
    text: args.text,
    page: null,
  })
  return refusal === null
    ? { ok: true, accepted: true, message: FEEDBACK_THANKS }
    : { ok: true, accepted: false, message: FEEDBACK_REFUSAL[refusal] }
}

/**
 * The Game a `/su bind` option names among the account's own: the id the
 * autocomplete sends, or a name typed by hand (any case); null for neither.
 */
async function callerGame(db: SharedDb, discordId: string, raw: string): Promise<string | null> {
  const text = raw.trim()
  if ((await membershipOf(db, text, discordId)) !== null) return text
  const named = (await gamesOf(db, discordId)).find(
    (game) => game.name.trim().toLowerCase() === text.toLowerCase()
  )
  return named?.gameId ?? null
}

/** Whether the caller holds Manage Channels where they ran it; undefined outside a server. */
function manageChannelsOf(args: { manageChannels?: unknown }): boolean | undefined {
  return typeof args.manageChannels === 'boolean' ? args.manageChannels : undefined
}

async function bind(
  db: SharedDb,
  args: BindChannelArgs
): Promise<BotFailure | BotSuccess<BindChannelResult>> {
  const account = await accountByDiscordId(db, args.discordId)
  if (account === null) return botDenial('unlinked')
  const channelId = args.channelId.trim()
  if (channelId.length === 0) return botDenial('not-found', CHANNEL_NOT_FOUND)
  let gameId: string | null = null
  if (args.game !== undefined && args.game.trim().length > 0) {
    gameId = await callerGame(db, args.discordId, args.game)
    if (gameId === null) return botDenial('not-found', GAME_NOT_FOUND)
  }
  return bindChannel(db, args.discordId, {
    channelId,
    gameId,
    channelName: args.channelName ?? null,
    manageChannels: manageChannelsOf(args),
  })
}

async function unbind(
  db: SharedDb,
  args: UnbindChannelArgs
): Promise<BotFailure | BotSuccess<UnbindChannelResult>> {
  const account = await accountByDiscordId(db, args.discordId)
  if (account === null) return botDenial('unlinked')
  return unbindChannel(db, args.discordId, args.channelId.trim(), manageChannelsOf(args))
}

/** A Game room's one act the bot causes (`GameRoom.act`): a member's roll, onto the log. */
export type RollLog = (gameId: string) => {
  act(
    actor: string,
    name: 'changeLog.appendChangeLog',
    args: { entries: LogEntry[] }
  ): Promise<{ ok: boolean }>
}

/** The longest outcome a Discord roll's Feed line keeps. */
const ROLL_OUTCOME_MAX = 160

/**
 * A public `/su roll` in a Game's bound channel, on that Game's Feed: the same
 * row Play writes for a roll (`changeLog.appendChangeLog`), as the member who
 * rolled, so the room's own rule (members only) decides. A channel bound to
 * nothing, to solo play, or to a Game the roller is not in logs nothing.
 */
async function logRoll(
  db: SharedDb,
  rooms: BotRooms,
  log: RollLog,
  args: LogRollArgs
): Promise<BotSuccess<LogRollResult>> {
  const none = { ok: true, logged: false } as const
  const { tableName, rolls } = args
  if (typeof tableName !== 'string' || !Array.isArray(rolls) || !isPostableRoll(tableName, rolls)) {
    return none
  }
  const binding = await bindingBy(db, 'channel', String(args.channelId))
  const gameId = binding?.game_id ?? null
  if (gameId === null) return none
  const discordId = String(args.discordId)
  if ((await membershipOf(db, gameId, discordId)) === null) return none
  const name = await shownName(rooms, discordId, await accountByDiscordId(db, discordId))
  const outcome = typeof args.outcome === 'string' ? args.outcome.slice(0, ROLL_OUTCOME_MAX) : ''
  const description = [name, tableName, rolls.join(', '), ...(outcome ? [outcome] : [])].join(' · ')
  const answer = await log(gameId).act(discordId, 'changeLog.appendChangeLog', {
    entries: [
      {
        entityType: 'game',
        field: 'roll',
        after: {
          description,
          result: {
            kind: tableName === 'Core Mechanic' ? 'core' : 'table',
            roll: rolls[0] ?? null,
            outcome,
          },
        },
        source: 'discord',
        ts: Date.now(),
      },
    ],
  })
  return { ok: true, logged: answer.ok }
}

/** One op's answer, or null when the site cannot answer it (no database, or a room that fails). */
export async function answerBot(
  db: SharedDb | undefined,
  op: BotOpName,
  args: Record<string, unknown>,
  rooms?: BotRooms,
  log?: RollLog
): Promise<BotAnswer | null> {
  if (!db) return null
  switch (op) {
    case 'me':
      return me(db, rooms, String(args.discordId))
    case 'games':
      return games(db, String(args.discordId))
    case 'usage':
      return usage(db, args as BotUsageArgs)
    case 'feedback':
      return feedback(db, args as BotFeedbackArgs)
    case 'bindChannel':
      return bind(db, args as BindChannelArgs)
    case 'unbindChannel':
      return unbind(db, args as UnbindChannelArgs)
    case 'logRoll':
      return rooms && log
        ? fromRooms(() => logRoll(db, rooms, log, args as unknown as LogRollArgs))
        : null
    case 'mine':
      return rooms ? fromRooms(() => mine(db, rooms, String(args.discordId))) : null
    case 'sheet':
      return rooms
        ? fromRooms(() =>
            sheet(db, rooms, args as { discordId: string; table: SheetTable; entityId: string })
          )
        : null
  }
}

/**
 * A room read, or null when a room cannot answer it (a room from before it
 * held units, or one that throws), which the bot says as unavailable.
 */
async function fromRooms(read: () => Promise<BotAnswer>): Promise<BotAnswer | null> {
  try {
    return await read()
  } catch {
    return null
  }
}

/** The rooms, as this Worker exports them (`wrangler.jsonc` `exports`). */
function workerRooms(): BotRooms {
  const named = exports as unknown as Record<
    'AccountRoom' | 'GameRoom',
    { getByName(name: string): unknown }
  >
  return {
    account: (discordId) =>
      named.AccountRoom.getByName(discordId) as ReturnType<BotRooms['account']>,
    game: (gameId) => named.GameRoom.getByName(gameId) as ReturnType<BotRooms['game']>,
  }
}

/** @public Loaded by workerd: the bot's binding names it as its `entrypoint`. */
export class BotGateway extends WorkerEntrypoint<GatewayEnv> {
  answer(op: BotOpName, args: Record<string, unknown>): Promise<BotAnswer | null> {
    const rooms = workerRooms()
    return answerBot(
      this.env.SHARED,
      op,
      args,
      rooms,
      (gameId) => rooms.game(gameId) as unknown as ReturnType<RollLog>
    )
  }
}
