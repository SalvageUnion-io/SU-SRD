import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { mutation, query } from './_generated/server'
import { requireUser } from './model/permissions'

/**
 * Account management (ADR-030 §6, D33).
 *
 * Holding somebody's Discord identity is an obligation the project did not have
 * before, so the three things that discharge it — read your profile, edit it,
 * delete the account entirely — are part of the same module rather than a
 * follow-up. Export is served here too, so "give me my data" and "delete my
 * data" cannot drift apart.
 */

/** The signed-in user's own profile. Never exposes another user's row. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)
    const user = await ctx.db.get(userId)
    if (user === null) return null
    return {
      _id: user._id,
      displayName: user.displayName ?? user.name ?? null,
      avatarUrl: user.avatarUrl ?? user.image ?? null,
      email: user.email ?? null,
    }
  },
})

/**
 * Edit the display name and avatar shown on every owner chip.
 *
 * These are overrides layered on the Discord profile rather than replacements:
 * clearing one falls back to the Discord value rather than to blank, because a
 * nameless owner chip is worse than a stale one.
 */
export const updateProfile = mutation({
  args: {
    displayName: v.optional(v.union(v.string(), v.null())),
    avatarUrl: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const patch: { displayName?: string | undefined; avatarUrl?: string | undefined } = {}

    if (args.displayName !== undefined) {
      const trimmed = args.displayName?.trim() ?? ''
      patch.displayName = trimmed.length > 0 ? trimmed : undefined
    }
    if (args.avatarUrl !== undefined) {
      const trimmed = args.avatarUrl?.trim() ?? ''
      patch.avatarUrl = trimmed.length > 0 ? trimmed : undefined
    }

    await ctx.db.patch(userId, patch)
  },
})

/**
 * Everything this account owns, as a plain object suitable for download.
 *
 * Deliberately scoped to what the user *owns*, not everything they can see: a
 * crewmate's pilot is readable inside a Game but is not this person's data to
 * take away. The communal crawler is likewise excluded — it belongs to the
 * table, not to any one member.
 */
export const exportMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireUser(ctx)

    const pilots = await ctx.db
      .query('pilots')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const mechs = await ctx.db
      .query('mechs')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const mechPatterns = await ctx.db
      .query('mechPatterns')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .collect()
    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    return {
      exportedAt: new Date().toISOString(),
      pilots: pilots.map((p) => p.body),
      mechs: mechs.map((m) => m.body),
      mechPatterns: mechPatterns.map((p) => p.body),
      games: memberships.map((m) => ({
        gameId: m.gameId,
        mediator: m.mediator,
        organizer: m.organizer,
        joinedAt: m.joinedAt,
      })),
    }
  },
})

/**
 * Pass the Organizer flag to the longest-standing remaining member.
 *
 * "Longest-standing" is `joinedAt`, and the tie-break is deterministic rather
 * than arbitrary — two members can share a timestamp if a Game was seeded in
 * one mutation, and an unstable choice there would make the outcome depend on
 * document scan order.
 */
async function reassignOrganizer(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  leavingUserId: Id<'users'>
): Promise<boolean> {
  const remaining = (
    await ctx.db
      .query('memberships')
      .withIndex('by_game', (q) => q.eq('gameId', gameId))
      .collect()
  ).filter((m) => m.userId !== leavingUserId)

  if (remaining.length === 0) return false

  remaining.sort((a: Doc<'memberships'>, b: Doc<'memberships'>) =>
    a.joinedAt === b.joinedAt ? a._id.localeCompare(b._id) : a.joinedAt - b.joinedAt
  )
  const heir = remaining[0]
  if (heir === undefined) return false

  await ctx.db.patch(heir._id, { organizer: true })
  return true
}

/**
 * Delete this account and everything personal to it (D27).
 *
 * The rule that matters: **a campaign never dies because one person quit.**
 * Games survive, the communal crawler survives, and the Organizer flag passes
 * to the longest-standing remaining member. Only when the departing user was
 * the *last* member is the Game itself removed, because an empty Game is not a
 * campaign anybody can return to.
 *
 * Their own pilots and mechs go with them — that is the point of a deletion
 * request. Anyone who wants to keep a character exports first, which is why
 * `exportMine` lives in this same module.
 */
export const deleteAccount = mutation({
  args: {},
  handler: async (ctx): Promise<void> => {
    const userId = await requireUser(ctx)

    const memberships = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect()

    for (const membership of memberships) {
      if (membership.organizer) {
        const passedOn = await reassignOrganizer(ctx, membership.gameId, userId)
        if (!passedOn) {
          // Last member out: the Game has nobody left to run or play it.
          for (const table of [
            'crawlers',
            'encounterNpcs',
            'softLinks',
            'invites',
            'presence',
          ] as const) {
            const rows = await ctx.db
              .query(table)
              .withIndex('by_game', (q) => q.eq('gameId', membership.gameId))
              .collect()
            for (const row of rows) await ctx.db.delete(row._id)
          }
          // Unclaimed entities in a Game with no members have nowhere to go.
          for (const table of ['pilots', 'mechs'] as const) {
            const rows = await ctx.db
              .query(table)
              .withIndex('by_game', (q) => q.eq('gameId', membership.gameId))
              .collect()
            for (const row of rows) await ctx.db.delete(row._id)
          }
          await ctx.db.delete(membership.gameId)
        }
      }
      await ctx.db.delete(membership._id)
    }

    // Personal entities, wherever they live — in a Game or on the shelf.
    for (const table of ['pilots', 'mechs', 'mechPatterns'] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex('by_owner', (q) => q.eq('ownerId', userId))
        .collect()
      for (const row of rows) await ctx.db.delete(row._id)
    }

    // Auth rows, so the identity cannot be resurrected by signing in again.
    //
    // Order matters: refresh tokens are keyed by SESSION, not by user, so they
    // have to go before the sessions they point at. Deleting sessions first
    // would strand them as orphans referencing rows that no longer exist.
    const sessions = await ctx.db
      .query('authSessions')
      .withIndex('userId', (q) => q.eq('userId', userId))
      .collect()
    for (const session of sessions) {
      const tokens = await ctx.db
        .query('authRefreshTokens')
        .withIndex('sessionId', (q) => q.eq('sessionId', session._id))
        .collect()
      for (const token of tokens) await ctx.db.delete(token._id)
      await ctx.db.delete(session._id)
    }

    const accounts = await ctx.db
      .query('authAccounts')
      .withIndex('userIdAndProvider', (q) => q.eq('userId', userId))
      .collect()
    for (const account of accounts) await ctx.db.delete(account._id)

    await ctx.db.delete(userId)
  },
})
