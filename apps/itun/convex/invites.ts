import { v } from 'convex/values'
import type { Id } from './_generated/dataModel'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { internalMutation, mutation } from './model/entities'
import { currentInvite, inviteByCode, isCurrent, mintInvite } from './model/invites'
import { getMembership, NotAuthorized, requireOrganizer, requireUser } from './model/permissions'

/**
 * Invites (ADR-030's invite amendment): how a player joins a Game.
 *
 * A Game has one invite URL, `/invite/<code>`. Anyone signed in who opens it
 * joins as a player. The Organizer copies it (`link`) and can reset it
 * (`reset`), which mints a new code; the old one stops working. Who mediates
 * is decided afterwards, among the members (`games.setMediator`).
 */

/** The Game's invite code, minted on the first ask. Organizer only. */
export const link = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<string> => {
    const membership = await requireOrganizer(ctx, args.gameId)
    const current = await currentInvite(ctx, args.gameId)
    if (current !== null) return current.code
    return (await mintInvite(ctx, membership)).code
  },
})

/**
 * Replace the Game's invite URL with a new one. Every code the Game held stops
 * working; nobody already seated is removed. Organizer only. Returns the new
 * code.
 */
export const reset = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<string> => {
    const membership = await requireOrganizer(ctx, args.gameId)
    const now = Date.now()
    const invites = await ctx.db
      .query('invites')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    for (const invite of invites) {
      if (invite.revokedAt === undefined) await ctx.db.patch(invite._id, { revokedAt: now })
    }
    return (await mintInvite(ctx, membership)).code
  },
})

/**
 * What the URL is for, without spending it: the Game's name and who invited
 * you, or null for a code that is not the Game's invite URL. Never the member
 * list or the crew: ADR-030 §5 visibility begins at membership.
 *
 * Unauthenticated on purpose: someone following the link has not signed in
 * yet, and should learn the link is dead before being asked to.
 */
export const preview = query({
  args: { code: v.string() },
  returns: v.union(v.object({ gameName: v.string(), invitedBy: v.string() }), v.null()),
  handler: async (ctx, args) => {
    const invite = await inviteByCode(ctx, args.code)
    if (invite === null || !(await isCurrent(ctx, invite))) return null
    const game = await ctx.db.get(invite.gameId)
    if (game === null) return null
    const inviter = await ctx.db.get(invite.createdBy)
    return { gameName: game.name, invitedBy: displayNameOf(inviter, 'the Organiser') }
  },
})

export type RedeemResult = { kind: 'joined' | 'already'; gameId: Id<'games'> }

/**
 * Open the URL: join the Game as a player.
 *
 * Joining is the only self-serve membership act. Redeeming twice is a no-op
 * rather than an error, and someone already seated lands in the Game even from
 * a code that has since been reset.
 */
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<RedeemResult> => {
    const userId = await requireUser(ctx)
    const invite = await inviteByCode(ctx, args.code)
    if (invite === null) throw new NotAuthorized('That invite link is not valid')

    const existing = await getMembership(ctx, invite.gameId, userId)
    if (existing !== null) return { kind: 'already', gameId: invite.gameId }

    if (!(await isCurrent(ctx, invite))) {
      throw new NotAuthorized('That invite link no longer works')
    }

    await ctx.db.insert('memberships', {
      gameId: invite.gameId,
      userId,
      mediator: false,
      organizer: false,
      joinedAt: Date.now(),
    })
    return { kind: 'joined', gameId: invite.gameId }
  },
})

/** The invite columns nothing reads now that a Game has one invite URL. */
const RETIRED_COLUMNS = [
  'expiresAt',
  'role',
  'requiresApproval',
  'usesRemaining',
  'label',
  'grants',
] as const

/**
 * One-off repair, run once on production after the release deploys: clears the
 * retired columns from every invite and empties `joinRequests` and
 * `inviteRedemptions`, so a later schema change can drop them. Reports what it
 * would change unless passed `{ apply: true }`. Deleted with that schema change.
 * The addressed-invite fields (`target`, `declinedAt`, `delivery`,
 * `sourceInteractionId`) stay until the last addressed invite has expired.
 *
 * @operator Run by hand from the dashboard; nothing calls it.
 */
export const dropRetired = internalMutation({
  args: { apply: v.optional(v.boolean()) },
  handler: async (
    ctx,
    args
  ): Promise<{ invites: number; joinRequests: number; inviteRedemptions: number }> => {
    const apply = args.apply === true
    let invites = 0
    for (const invite of await ctx.db.query('invites').collect()) {
      const stale = RETIRED_COLUMNS.filter((column) => invite[column] !== undefined)
      if (stale.length === 0) continue
      invites++
      if (apply) {
        await ctx.db.patch(
          invite._id,
          Object.fromEntries(stale.map((column) => [column, undefined]))
        )
      }
    }
    const joinRequests = await ctx.db.query('joinRequests').collect()
    const inviteRedemptions = await ctx.db.query('inviteRedemptions').collect()
    if (apply) {
      for (const row of joinRequests) await ctx.db.delete(row._id)
      for (const row of inviteRedemptions) await ctx.db.delete(row._id)
    }
    return {
      invites,
      joinRequests: joinRequests.length,
      inviteRedemptions: inviteRedemptions.length,
    }
  },
})
