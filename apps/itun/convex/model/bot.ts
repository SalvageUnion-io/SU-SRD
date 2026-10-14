import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Shared logic for the Discord bot as a Game participant (ADR-030).
 *
 * The caller is `botClient.ts`, reached over HTTP with a bot credential. There
 * is no Convex auth token, so the actor is resolved from a linked Discord id
 * and then held to the same `model/permissions.ts` checks as a signed-in web
 * caller.
 */

type AnyCtx = QueryCtx | MutationCtx

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
