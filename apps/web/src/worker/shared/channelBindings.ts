/**
 * Discord channel bindings in the shared database: which channel Play's
 * rolls post to (`/su bind`). A binding names a Game, or no Game for one
 * account's solo play; the table's keys hold the three invariants (a channel
 * holds one binding, a Game is bound to one channel, an account's solo play
 * to one).
 *
 * In a server, binding takes Manage Channels in the channel (the bot reads it
 * off the interaction and sends it as `manageChannels`); in a DM, where it is
 * absent, nobody holds it and nobody needs it.
 *
 * A Game's binding also keeps the Discord category its channel sits in and its
 * server (ADR-068 §6): the Activity launched anywhere in that category opens
 * that Game, and a server with one bound Game opens it from any channel
 * (`launchBinding`). A category holds one Game.
 *
 * Binding again moves the binding: the Game's (or the account's) old channel
 * is released. A channel somebody else's Game or solo play holds is taken
 * only by a caller who could have unbound it: whoever bound it, anyone with
 * Manage Channels there, and for a Game its Mediator or Organiser
 * (`mayBindChannel`).
 */

import type {
  BindChannelResult,
  BotFailure,
  BotSuccess,
  ChannelBindingSummary,
  UnbindChannelResult,
} from 'game-domain/botWire'
import { BIND_NEEDS_MANAGE_CHANNELS } from 'game-domain/botWire'
import { mayBindChannel } from 'game-domain/games/discord'
import type { SharedDb } from './db'
import { membershipOf } from './games'

/** The refusal when the caller names a Game they are not in, or none exists. */
export const GAME_NOT_FOUND = 'That Game could not be found, or you are not in it.'

/** The refusal when `/su bind` arrives with no channel to bind. */
export const CHANNEL_NOT_FOUND = 'That channel could not be found.'

/** Discord's own cap on a channel name. */
const CHANNEL_NAME_MAX = 100

/** One binding as stored, with its Game's name. */
type BindingColumns = {
  channel_id: string
  game_id: string | null
  bound_by: string
  channel_name: string | null
  bound_at: number
  game_name: string | null
}

const BINDING = `select b.channel_id, b.game_id, b.bound_by, b.channel_name, b.bound_at,
  g.name as game_name from channel_bindings b left join games g on g.game_id = b.game_id`

/** How a binding is found: by its Game, by the account whose solo play it is, or by its channel. */
const BINDING_BY = {
  game: 'b.game_id = ?1',
  solo: 'b.game_id is null and b.bound_by = ?1',
  channel: 'b.channel_id = ?1',
} as const

function summaryOf(row: BindingColumns): ChannelBindingSummary {
  return {
    channelId: row.channel_id,
    channelName: row.channel_name,
    gameId: row.game_id,
    gameName: row.game_name,
  }
}

/** A channel name as stored: trimmed, without a leading `#`, at most Discord's cap; null when empty. */
function channelNameOf(raw: string | null | undefined): string | null {
  const name = (raw ?? '').trim().replace(/^#+/, '').trim().slice(0, CHANNEL_NAME_MAX)
  return name.length === 0 ? null : name
}

/** The binding a Game, an account's solo play (by Discord id) or a channel holds; null when none. */
export function bindingBy(
  db: SharedDb,
  by: keyof typeof BINDING_BY,
  value: string
): Promise<BindingColumns | null> {
  return db.prepare(`${BINDING} where ${BINDING_BY[by]}`).bind(value).first<BindingColumns>()
}

/** The channel a Game is bound to, for Play's rolls and the Game's page; null when none. */
export async function bindingForGame(
  db: SharedDb,
  gameId: string
): Promise<ChannelBindingSummary | null> {
  const row = await bindingBy(db, 'game', gameId)
  return row === null ? null : summaryOf(row)
}

/** The channel an account's solo play is bound to; null when none. */
export async function soloBinding(
  db: SharedDb,
  discordId: string
): Promise<ChannelBindingSummary | null> {
  const row = await bindingBy(db, 'solo', discordId)
  return row === null ? null : summaryOf(row)
}

/** Whether `discordId` may unbind (or take over) this binding. */
async function mayManage(
  db: SharedDb,
  discordId: string,
  held: BindingColumns,
  manageChannels: boolean | undefined
) {
  if (manageChannels === true || held.bound_by === discordId) return true
  if (held.game_id === null) return false
  const member = await membershipOf(db, held.game_id, discordId)
  return member !== null && mayBindChannel(member)
}

/**
 * Bind `channelId` to Game `gameId` or, with null, to the account's solo
 * play, keeping the channel's name so Play can show it. Binding a channel to
 * what it already holds changes nothing but its name.
 */
export async function bindChannel(
  db: SharedDb,
  discordId: string,
  args: {
    channelId: string
    gameId: string | null
    channelName?: string | null
    manageChannels?: boolean
    /** The Discord category the channel sits in; null outside one. */
    categoryId?: string | null
    /** The server the channel is in; null in a DM. */
    guildId?: string | null
  },
  now = Date.now()
): Promise<BotFailure | BotSuccess<BindChannelResult>> {
  const { channelId, gameId, manageChannels } = args
  // Only a Game's binding covers a category: solo play is one channel.
  const categoryId = gameId === null ? null : (args.categoryId ?? null)
  const guildId = args.guildId ?? null
  const channelName = channelNameOf(args.channelName)
  if (manageChannels === false) {
    return { ok: false, reason: 'forbidden', message: BIND_NEEDS_MANAGE_CHANNELS }
  }
  if (gameId !== null) {
    const member = await membershipOf(db, gameId, discordId)
    if (member === null) return { ok: false, reason: 'not-found', message: GAME_NOT_FOUND }
    if (!mayBindChannel(member)) {
      return {
        ok: false,
        reason: 'forbidden',
        message: 'Only the Game’s Mediator or Organiser can bind a channel to it.',
      }
    }
  }

  const held = await bindingBy(db, 'channel', channelId)
  const sameTarget =
    held !== null &&
    (gameId === null
      ? held.game_id === null && held.bound_by === discordId
      : held.game_id === gameId)
  const categoryHeld = await categoryHolders(db, categoryId, gameId)
  for (const other of categoryHeld) {
    if (!(await mayManage(db, discordId, other, manageChannels))) {
      return {
        ok: false,
        reason: 'forbidden',
        message: 'This channel’s category is already bound to another Game.',
      }
    }
  }
  if (held !== null && sameTarget && categoryHeld.length === 0) {
    await db
      .prepare(
        `update channel_bindings set channel_name = coalesce(?1, channel_name),
         category_id = ?2, guild_id = coalesce(?3, guild_id) where channel_id = ?4`
      )
      .bind(channelName, categoryId, guildId, channelId)
      .run()
    return {
      ok: true,
      binding: summaryOf({ ...held, channel_name: channelName ?? held.channel_name }),
      previousChannelId: null,
    }
  }
  if (held !== null && !(await mayManage(db, discordId, held, manageChannels))) {
    return {
      ok: false,
      reason: 'forbidden',
      message:
        held.game_id === null
          ? 'This channel is already bound to somebody’s solo play.'
          : 'This channel is already bound to another Game.',
    }
  }

  const previous =
    gameId === null ? await soloBinding(db, discordId) : await bindingForGame(db, gameId)
  const releasePrevious =
    gameId === null
      ? db
          .prepare('delete from channel_bindings where game_id is null and bound_by = ?1')
          .bind(discordId)
      : db.prepare('delete from channel_bindings where game_id = ?1').bind(gameId)
  await db.batch([
    db.prepare('delete from channel_bindings where channel_id = ?1').bind(channelId),
    releasePrevious,
    ...categoryHeld.map((other) =>
      db.prepare('delete from channel_bindings where channel_id = ?1').bind(other.channel_id)
    ),
    db
      .prepare(
        `insert into channel_bindings
         (channel_id, game_id, bound_by, channel_name, bound_at, category_id, guild_id)
         values (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(channelId, gameId, discordId, channelName, now, categoryId, guildId),
  ])
  const bound = await bindingBy(db, 'channel', channelId)
  if (bound === null) throw new Error('channel binding vanished on insert')
  return {
    ok: true,
    binding: summaryOf(bound),
    previousChannelId:
      previous !== null && previous.channelId !== channelId ? previous.channelId : null,
  }
}

/** Other Games' bindings that hold this category: binding here takes it from them. */
async function categoryHolders(
  db: SharedDb,
  categoryId: string | null,
  gameId: string | null
): Promise<BindingColumns[]> {
  if (categoryId === null || gameId === null) return []
  const { results } = await db
    .prepare(`${BINDING} where b.category_id = ?1 and b.game_id is not null and b.game_id != ?2`)
    .bind(categoryId, gameId)
    .all<BindingColumns>()
  return results
}

/**
 * The Game the Activity opens where it was launched (ADR-068 §6): the Game
 * bound in the launch channel's category, else the one bound to the channel
 * itself, else the server's only bound Game; null when none fits.
 */
export async function launchBinding(
  db: SharedDb,
  at: { channelId: string; categoryId: string | null; guildId: string | null }
): Promise<ChannelBindingSummary | null> {
  const game = 'b.game_id is not null'
  if (at.categoryId !== null) {
    const row = await db
      .prepare(`${BINDING} where ${game} and b.category_id = ?1 order by b.bound_at desc`)
      .bind(at.categoryId)
      .first<BindingColumns>()
    if (row !== null) return summaryOf(row)
  }
  const own = await bindingBy(db, 'channel', at.channelId)
  if (own !== null && own.game_id !== null) return summaryOf(own)
  if (at.guildId === null) return null
  const { results } = await db
    .prepare(`${BINDING} where ${game} and b.guild_id = ?1 limit 2`)
    .bind(at.guildId)
    .all<BindingColumns>()
  const [only, another] = results
  return only !== undefined && another === undefined ? summaryOf(only) : null
}

/**
 * Unbind whatever `channelId` holds: whoever bound it, anyone with Manage
 * Channels there, or the Game's Mediator or Organiser may. Nothing bound is
 * no failure: the reply says so.
 */
export async function unbindChannel(
  db: SharedDb,
  discordId: string,
  channelId: string,
  manageChannels?: boolean
): Promise<BotFailure | BotSuccess<UnbindChannelResult>> {
  const held = await bindingBy(db, 'channel', channelId)
  if (held === null) return { ok: true, unbound: null }
  if (!(await mayManage(db, discordId, held, manageChannels))) {
    return {
      ok: false,
      reason: 'forbidden',
      message:
        held.game_id === null
          ? 'Only the person who bound this channel, or someone with Manage Channels, can unbind it.'
          : 'Only the Game’s Mediator or Organiser, or someone with Manage Channels, can unbind its channel.',
    }
  }
  await db.prepare('delete from channel_bindings where channel_id = ?1').bind(channelId).run()
  return { ok: true, unbound: summaryOf(held) }
}

type BindingView = {
  channelId: string
  channelName: string | null
  boundAt: number
  /** The roller's own channel, standing in for a Game that has none bound (`rollChannel`). */
  own?: true
}

/** A Game's binding, or the player's solo play's, as these calls answer it. */
async function bindingView(
  db: SharedDb,
  by: 'game' | 'solo',
  value: string
): Promise<BindingView | null> {
  const row = await bindingBy(db, by, value)
  return row === null
    ? null
    : { channelId: row.channel_id, channelName: row.channel_name, boundAt: row.bound_at }
}

export const gameBindingView = (db: SharedDb, gameId: string) => bindingView(db, 'game', gameId)
export const soloBindingView = (db: SharedDb, discordId: string) =>
  bindingView(db, 'solo', discordId)

/**
 * Where this caller's rolls post: solo, their own channel; in a Game, the
 * Game's, or their own where the Game has none bound, so a channel someone
 * bound always gets their rolls until it is unbound.
 */
export async function rollChannel(
  db: SharedDb,
  discordId: string,
  gameId: string | null
): Promise<BindingView | null> {
  if (gameId === null) return soloBindingView(db, discordId)
  const game = await gameBindingView(db, gameId)
  if (game !== null) return game
  const own = await soloBindingView(db, discordId)
  return own === null ? null : { ...own, own: true }
}
