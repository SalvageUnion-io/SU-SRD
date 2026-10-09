import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { BotDenial } from './botWire'
import { getMembership, NotAuthorized, requireOrganizerAs } from './permissions'

/**
 * Shared logic for the Discord bot as a Game participant (ADR-030 Phase 6).
 *
 * The caller is `botClient.ts`, reached over HTTP with a bot credential. There
 * is no Convex auth token, so the actor is resolved from a linked Discord id
 * and then held to the same `model/permissions.ts` checks as a signed-in web
 * caller.
 */

type AnyCtx = QueryCtx | MutationCtx

export type BotResolution<T> = { ok: true; value: T } | { ok: false; reason: BotDenial }

/**
 * The account behind a Discord id, or null when nobody has signed in as it.
 *
 * Resolved through **`authAccounts`**, which is the row `@convex-dev/auth`
 * writes on every Discord sign-in — `{ provider: 'discord', providerAccountId:
 * <snowflake> }`, indexed as `providerAndAccountId`. It is therefore correct by
 * construction, with nothing to stamp, backfill, or keep in step.
 */
export async function userByDiscordId(
  ctx: AnyCtx,
  discordId: string
): Promise<Doc<'users'> | null> {
  const trimmed = discordId.trim()
  if (trimmed.length === 0) return null

  const account = await ctx.db
    .query('authAccounts')
    .withIndex('providerAndAccountId', (q) =>
      q.eq('provider', 'discord').eq('providerAccountId', trimmed)
    )
    .unique()
  if (account === null) return null

  return await ctx.db.get(account.userId)
}

/** The binding for a channel, or null when the channel speaks for no Game. */
export async function bindingForChannel(
  ctx: AnyCtx,
  channelId: string
): Promise<Doc<'channelBindings'> | null> {
  return await ctx.db
    .query('channelBindings')
    .withIndex('by_channel', (q) => q.eq('channelId', channelId.trim()))
    .unique()
}

/**
 * Resolve a Discord user, in a Discord channel, to a member of a Game.
 *
 * This is the bot's entire authorization story in one function: the channel
 * decides *which* Game, the Discord id decides *who*, and membership decides
 * whether those two have anything to do with each other. The bot never names
 * an actor — it can only report the Discord id Discord handed it, and that id
 * is worth nothing unless somebody has signed in with it and been invited.
 */
export async function resolveActor(
  ctx: AnyCtx,
  channelId: string,
  discordId: string
): Promise<
  BotResolution<{
    gameId: Id<'games'>
    game: Doc<'games'>
    user: Doc<'users'>
    membership: Doc<'memberships'>
  }>
> {
  const binding = await bindingForChannel(ctx, channelId)
  if (binding === null) return { ok: false, reason: 'unbound' }

  const game = await ctx.db.get(binding.gameId)
  // A binding whose Game is gone is a bug, not a state to render — but the
  // channel is, in every sense that matters to the caller, unbound.
  if (game === null) return { ok: false, reason: 'unbound' }

  const user = await userByDiscordId(ctx, discordId)
  if (user === null) return { ok: false, reason: 'unlinked' }

  const membership = await getMembership(ctx, binding.gameId, user._id)
  if (membership === null) return { ok: false, reason: 'not-a-member' }

  return { ok: true, value: { gameId: binding.gameId, game, user, membership } }
}

/**
 * Bind a channel to a Game. Administrative, so Organizer only.
 *
 * One Game per channel: a channel meaning two Games would make every roll in
 * it ambiguous, and the bot has no way to ask which was meant.
 */
export async function bindChannelAs(
  ctx: MutationCtx,
  userId: Id<'users'>,
  gameId: Id<'games'>,
  channelId: string
): Promise<void> {
  const membership = await requireOrganizerAs(ctx, gameId, userId)
  const trimmed = channelId.trim()
  if (trimmed.length === 0) throw new Error('A binding needs a channel')

  const existing = await bindingForChannel(ctx, trimmed)
  if (existing !== null) {
    if (existing.gameId === gameId) return
    throw new NotAuthorized('That channel is already bound to another game')
  }

  await ctx.db.insert('channelBindings', {
    gameId,
    channelId: trimmed,
    boundBy: membership.userId,
    boundAt: Date.now(),
  })
}

/** Unbind a channel. Organizer of the bound Game only; a no-op when unbound. */
export async function unbindChannelAs(
  ctx: MutationCtx,
  userId: Id<'users'>,
  channelId: string
): Promise<void> {
  const existing = await bindingForChannel(ctx, channelId)
  if (existing === null) return

  await requireOrganizerAs(ctx, existing.gameId, userId)
  await ctx.db.delete(existing._id)
}

/** Every Game a user belongs to, with their role in each. */
export async function gamesForUser(
  ctx: AnyCtx,
  userId: Id<'users'>
): Promise<Array<{ gameId: Id<'games'>; name: string; mediator: boolean; organizer: boolean }>> {
  const memberships = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .collect()

  const out: Array<{
    gameId: Id<'games'>
    name: string
    mediator: boolean
    organizer: boolean
  }> = []
  for (const membership of memberships) {
    const game = await ctx.db.get(membership.gameId)
    if (game === null) continue
    out.push({
      gameId: game._id,
      name: game.name,
      mediator: membership.mediator,
      organizer: membership.organizer,
    })
  }
  return out
}

/** A member's display name, with the same fallback every other surface uses. */
export function displayNameOf(user: Doc<'users'> | null): string {
  return user?.displayName ?? user?.name ?? 'Crewmate'
}
