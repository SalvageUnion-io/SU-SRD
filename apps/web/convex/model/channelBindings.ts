import type {
  BindChannelResult,
  BotFailure,
  ChannelBindingSummary,
  UnbindChannelResult,
} from 'game-domain/botWire'
import { mayBindChannel } from 'game-domain/games/discord'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { getMembership } from './permissions'

/**
 * Discord channel bindings: which channel Play's rolls post to (`/su bind`).
 *
 * A binding names a Game, or no Game for one person's solo play. Three
 * invariants, all kept here so the bot's door (`botClient.bindChannel`) and
 * anything else that binds cannot disagree:
 *
 *   - a channel holds at most one binding,
 *   - a Game is bound to at most one channel,
 *   - a person's solo play is bound to at most one channel.
 *
 * Binding again moves the binding (the old row goes); binding a channel that
 * somebody else's Game or solo play holds is refused unless the caller could
 * have unbound it themselves.
 *
 * Who may manage a binding: for a Game, its Mediator or Organiser
 * (`mayBindChannel`); for a personal binding, the person who made it.
 */

type AnyCtx = QueryCtx | MutationCtx
type BindingRow = Doc<'channelBindings'>

/** The bot's refusal when the caller names a Game they are not in (or none exists). */
export const GAME_NOT_FOUND = 'That Game could not be found, or you are not in it.'

/** The binding a channel holds, if any. */
async function bindingForChannel(ctx: AnyCtx, channelId: string): Promise<BindingRow | null> {
  return await ctx.db
    .query('channelBindings')
    .withIndex('by_channel', (q) => q.eq('channelId', channelId))
    .first()
}

/** The channel a Game is bound to, if any. */
export async function bindingForGame(ctx: AnyCtx, gameId: Id<'games'>): Promise<BindingRow | null> {
  return await ctx.db
    .query('channelBindings')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .first()
}

/** The channel a person's solo play is bound to, if any. */
export async function personalBinding(
  ctx: AnyCtx,
  userId: Id<'users'>
): Promise<BindingRow | null> {
  return await ctx.db
    .query('channelBindings')
    // A solo binding is the one with no Game: `by_game` leads with `gameId`.
    .withIndex('by_game', (q) => q.eq('gameId', undefined).eq('boundBy', userId))
    .first()
}

/** Whether `userId` may unbind (or take over) this binding. */
async function mayManageBinding(
  ctx: AnyCtx,
  userId: Id<'users'>,
  binding: BindingRow
): Promise<boolean> {
  if (binding.gameId === undefined) return binding.boundBy === userId
  const membership = await getMembership(ctx, binding.gameId, userId)
  return membership !== null && mayBindChannel(membership)
}

/** A binding as the bot reads it (the web reads `channelBindings.ts`'s `viewOf`). */
export async function summarize(ctx: AnyCtx, binding: BindingRow): Promise<ChannelBindingSummary> {
  const game = binding.gameId === undefined ? null : await ctx.db.get(binding.gameId)
  return {
    channelId: binding.channelId,
    channelName: binding.channelName ?? null,
    gameId: binding.gameId ?? null,
    gameName: game?.name ?? null,
  }
}

/**
 * The Game a `/su bind` option names, among the caller's own Games: the id the
 * autocomplete sends, or a Game name typed by hand (case-insensitive). Null
 * when it names none of them, which reads as not-found either way.
 */
export async function resolveCallerGame(
  ctx: AnyCtx,
  userId: Id<'users'>,
  raw: string
): Promise<Id<'games'> | null> {
  const text = raw.trim()
  if (text.length === 0) return null
  const byId = ctx.db.normalizeId('games', text)
  if (byId !== null) return (await getMembership(ctx, byId, userId)) === null ? null : byId

  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()
  for (const membership of memberships) {
    const game = await ctx.db.get(membership.gameId)
    if (game !== null && game.name.trim().toLowerCase() === text.toLowerCase()) return game._id
  }
  return null
}

/** Discord's own cap on a channel name. */
const CHANNEL_NAME_MAX = 100

/** A channel name as stored: trimmed, without a leading `#`, at most Discord's cap; null when empty. */
function channelNameOf(raw: string | null | undefined): string | null {
  const name = (raw ?? '').trim().replace(/^#+/, '').trim().slice(0, CHANNEL_NAME_MAX)
  return name.length === 0 ? null : name
}

/**
 * Bind `channelId` to a Game (`gameId`) or to the caller's solo play (null),
 * keeping the channel's name (`channelName`) so Play can show it.
 *
 * Idempotent: binding a channel to what it is already bound to changes
 * nothing but its name, when the channel has been renamed since. The Game's
 * (or the person's) previous channel, if another, is released and named in
 * the result so the reply can say the binding moved.
 */
export async function bindChannelAs(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: { channelId: string; gameId: Id<'games'> | null; channelName?: string | null }
): Promise<BotFailure | ({ ok: true } & BindChannelResult)> {
  const { channelId, gameId } = args
  const channelName = channelNameOf(args.channelName)

  if (gameId !== null) {
    const membership = await getMembership(ctx, gameId, userId)
    if (membership === null) return { ok: false, reason: 'not-found', message: GAME_NOT_FOUND }
    if (!mayBindChannel(membership)) {
      return {
        ok: false,
        reason: 'forbidden',
        message: 'Only the Game’s Mediator or Organiser can bind a channel to it.',
      }
    }
  }

  const held = await bindingForChannel(ctx, channelId)
  const sameTarget =
    held !== null &&
    (gameId === null
      ? held.gameId === undefined && held.boundBy === userId
      : held.gameId === gameId)
  if (held !== null && sameTarget) {
    if (channelName !== null && held.channelName !== channelName) {
      await ctx.db.patch(held._id, { channelName })
    }
    const row = (await ctx.db.get(held._id)) ?? held
    return { ok: true, binding: await summarize(ctx, row), previousChannelId: null }
  }
  if (held !== null) {
    if (!(await mayManageBinding(ctx, userId, held))) {
      return {
        ok: false,
        reason: 'forbidden',
        message:
          held.gameId === undefined
            ? 'This channel is already bound to somebody’s solo play.'
            : 'This channel is already bound to another Game.',
      }
    }
    await ctx.db.delete(held._id)
  }

  const previous =
    gameId === null ? await personalBinding(ctx, userId) : await bindingForGame(ctx, gameId)
  if (previous !== null) await ctx.db.delete(previous._id)

  const bindingId = await ctx.db.insert('channelBindings', {
    ...(gameId === null ? {} : { gameId }),
    channelId,
    ...(channelName === null ? {} : { channelName }),
    boundBy: userId,
    boundAt: Date.now(),
  })
  const row = await ctx.db.get(bindingId)
  if (row === null) throw new Error('channel binding vanished on insert')
  return {
    ok: true,
    binding: await summarize(ctx, row),
    previousChannelId: previous?.channelId ?? null,
  }
}

/**
 * Unbind whatever `channelId` holds. Nothing bound is not a failure: the
 * channel is already in the state asked for, so the reply says so.
 */
export async function unbindChannelAs(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channelId: string
): Promise<BotFailure | ({ ok: true } & UnbindChannelResult)> {
  const held = await bindingForChannel(ctx, channelId)
  if (held === null) return { ok: true, unbound: null }
  if (!(await mayManageBinding(ctx, userId, held))) {
    return {
      ok: false,
      reason: 'forbidden',
      message:
        held.gameId === undefined
          ? 'Only the person who bound this channel can unbind it.'
          : 'Only the Game’s Mediator or Organiser can unbind its channel.',
    }
  }
  const summary = await summarize(ctx, held)
  await ctx.db.delete(held._id)
  return { ok: true, unbound: summary }
}
