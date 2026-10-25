/**
 * `BotGateway`: the Discord bot's way in, over a service binding
 * (`su-discord-bot`'s `SITE`), in place of Convex's bearer-guarded `/bot/*`.
 * A binding reaches only this entrypoint, so no secret is presented and none
 * can leak; the bot still names the Discord user, and every answer is
 * resolved against that user's account and memberships.
 *
 * It answers from the shared database once the cutover has filled it, with
 * the same wire bodies `/bot/*` sends (`game-domain/botWire`). Until then, and
 * for the ops whose data lives in the rooms (`sheet`, `mine`), it answers
 * null and the bot asks Convex as before.
 */

import { WorkerEntrypoint } from 'cloudflare:workers'
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
  MeResult,
  UnbindChannelResult,
} from 'game-domain/botWire'
import { FEEDBACK_REFUSAL, FEEDBACK_THANKS } from 'game-domain/feedback'
import { accountByDiscordId } from './shared/accounts'
import {
  bindChannel,
  CHANNEL_NOT_FOUND,
  GAME_NOT_FOUND,
  unbindChannel,
} from './shared/channelBindings'
import type { SharedDb } from './shared/db'
import { isFilled } from './shared/db'
import { acceptFeedback } from './shared/feedback'
import { gamesOf, membershipOf } from './shared/games'
import { bumpUsage, touchGuild } from './shared/signals'

type GatewayEnv = { SHARED?: SharedDb }

type BotAnswer = BotFailure | BotSuccess<unknown>

async function me(db: SharedDb, discordId: string): Promise<BotFailure | BotSuccess<MeResult>> {
  const account = await accountByDiscordId(db, discordId)
  if (account === null) return botDenial('unlinked')
  return {
    ok: true,
    user: {
      userId: account.account_id,
      displayName: account.display_name ?? account.name ?? 'Crewmate',
      avatarUrl: account.avatar_url,
    },
    games: await gamesOf(db, account.account_id),
  }
}

async function games(
  db: SharedDb,
  discordId: string
): Promise<BotFailure | BotSuccess<GamesResult>> {
  const account = await accountByDiscordId(db, discordId)
  if (account === null) return botDenial('unlinked')
  return { ok: true, games: await gamesOf(db, account.account_id) }
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
async function callerGame(db: SharedDb, accountId: string, raw: string): Promise<string | null> {
  const text = raw.trim()
  if ((await membershipOf(db, text, accountId)) !== null) return text
  const named = (await gamesOf(db, accountId)).find(
    (game) => game.name.trim().toLowerCase() === text.toLowerCase()
  )
  return named?.gameId ?? null
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
    gameId = await callerGame(db, account.account_id, args.game)
    if (gameId === null) return botDenial('not-found', GAME_NOT_FOUND)
  }
  return bindChannel(db, account.account_id, {
    channelId,
    gameId,
    channelName: args.channelName ?? null,
  })
}

async function unbind(
  db: SharedDb,
  args: { discordId: string; channelId: string }
): Promise<BotFailure | BotSuccess<UnbindChannelResult>> {
  const account = await accountByDiscordId(db, args.discordId)
  if (account === null) return botDenial('unlinked')
  return unbindChannel(db, account.account_id, args.channelId.trim())
}

/**
 * One op's answer as `/bot/<op>` would send it, or null for "ask Convex":
 * the database is not filled yet, or the op's data is not here.
 */
export async function answerBot(
  db: SharedDb | undefined,
  op: BotOpName,
  args: Record<string, unknown>
): Promise<BotAnswer | null> {
  if (!db || !(await isFilled(db))) return null
  switch (op) {
    case 'me':
      return me(db, String(args.discordId))
    case 'games':
      return games(db, String(args.discordId))
    case 'usage':
      return usage(db, args as BotUsageArgs)
    case 'feedback':
      return feedback(db, args as BotFeedbackArgs)
    case 'bindChannel':
      return bind(db, args as BindChannelArgs)
    case 'unbindChannel':
      return unbind(db, args as { discordId: string; channelId: string })
    default:
      return null
  }
}

/** @public Loaded by workerd: the bot's binding names it as its `entrypoint`. */
export class BotGateway extends WorkerEntrypoint<GatewayEnv> {
  answer(op: BotOpName, args: Record<string, unknown>): Promise<BotAnswer | null> {
    return answerBot(this.env.SHARED, op, args)
  }
}
