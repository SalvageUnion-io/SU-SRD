import { getAuthUserId } from '@convex-dev/auth/server'
import type { Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { NotAuthorized } from './permissions'

/**
 * The site's administrators (ADR-054): the accounts whose Discord id is listed
 * in the deployment's `ADMIN_DISCORD_IDS` (comma-separated). Not a role on a
 * Game and not a column: one environment variable, so granting it is a
 * deployment act and no mutation can hand it out. Unset, nobody is an admin.
 */

type AnyCtx = QueryCtx | MutationCtx

/** The Discord ids `ADMIN_DISCORD_IDS` names, trimmed, blanks dropped. */
export function adminDiscordIds(raw = process.env.ADMIN_DISCORD_IDS): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id.length > 0)
  )
}

/** Whether `userId` signs in with a Discord account `ADMIN_DISCORD_IDS` names. */
export async function isAdmin(ctx: AnyCtx, userId: Id<'users'>): Promise<boolean> {
  const ids = adminDiscordIds()
  if (ids.size === 0) return false
  const accounts = await ctx.db
    .query('authAccounts')
    .withIndex('userIdAndProvider', (q) => q.eq('userId', userId).eq('provider', 'discord'))
    .take(4)
  return accounts.some((account) => ids.has(account.providerAccountId))
}

/** Whether the caller is signed in as an admin; false signed out. */
export async function callerIsAdmin(ctx: AnyCtx): Promise<boolean> {
  const userId = await getAuthUserId(ctx)
  return userId !== null && (await isAdmin(ctx, userId))
}

/** The admin caller, or a throw. */
export async function requireAdmin(ctx: AnyCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null || !(await isAdmin(ctx, userId))) throw new NotAuthorized('Admins only')
  return userId
}
