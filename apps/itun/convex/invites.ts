import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { mutation } from './model/entities'
import { inviteByCode, inviteStatus, mayRedeem, mintInvite, statusOf } from './model/invites'
import {
  getMembership,
  NotAuthorized,
  requireMember,
  requireOrganizer,
  requireUser,
} from './model/permissions'
import { inviteRole } from './schema'

/**
 * Invites (ADR-030 §3, and the invite amendments) — how a player joins a Game.
 * Not §2: that section is Containers, and its only mention of invites is that a
 * shelf has none.
 *
 * An invite travels as a **link**, `/invite/<code>`, never as a typed code.
 * The `code` column is the link's token: Crockford base32,
 * collision-checked against the `by_code` index and drawn from
 * `crypto.getRandomValues`. Minting itself is `model/invites.ts#mintInvite`,
 * shared with every other door that creates one.
 *
 * An invite carries two things beyond the code itself:
 *
 *   - **A seat** (`role`). A Mediator invite hands over the GM chair on join,
 *     which is the Organizer pre-exercising the authority `games.setMediator`
 *     already gives them.
 *   - **A door** (`requiresApproval`). A bearer code IS the authority; a knock
 *     grants nothing until the Organizer approves it, which is what a code
 *     posted somewhere public needs, since membership confers read access to
 *     every crewmate's sheet (ADR-030 §5).
 */

/** Mint an invite for a Game. Administrative, so Organizer only. */
export const create = mutation({
  args: {
    gameId: v.id('games'),
    usesRemaining: v.optional(v.number()),
    expiresInMs: v.optional(v.number()),
    label: v.optional(v.string()),
    role: v.optional(inviteRole),
    requiresApproval: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string> => {
    const membership = await requireOrganizer(ctx, args.gameId)
    const invite = await mintInvite(ctx, membership, args)
    return invite.code
  },
})

/**
 * The Game's invite link, for "Copy invite link" (the Game page and the
 * Dashboard's Crew tab). Any member may ask; what they get depends on
 * who they are:
 *
 *   - **The Organizer** gets an open link: anyone holding it joins. Minting a
 *     bearer invite is already theirs to do (`create`).
 *   - **Anyone else** gets an approval link: holding it only asks to join, and
 *     nobody is seated until the Organizer lets them in (`decideRequest`). A
 *     player can bring a friend to the door, never through it — membership
 *     confers read access to every crewmate's sheet (ADR-030 §5), which is the
 *     Organizer's to hand out.
 *
 * One standing link per door, reused while it is live, so copying twice hands
 * out the same link and the Organizer's list does not fill with duplicates. A
 * revoked, expired or used-up one is replaced by a fresh one on the next ask.
 * Returns the token; the client builds the URL from its own origin.
 */
export const link = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<string> => {
    const membership = await requireMember(ctx, args.gameId)
    const requiresApproval = !membership.organizer
    const now = Date.now()

    const invites = await ctx.db
      .query('invites')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()
    const live = invites.find(
      (invite) =>
        invite.standing === true &&
        invite.requiresApproval === requiresApproval &&
        statusOf(invite, now) === 'active'
    )
    if (live !== undefined) return live.code

    const invite = await mintInvite(ctx, membership, { requiresApproval, standing: true })
    return invite.code
  },
})

/** Every invite for a Game, with its derived status and who has used it. */
export const list = query({
  args: { gameId: v.id('games') },
  returns: v.array(
    v.object({
      _id: v.id('invites'),
      code: v.string(),
      label: v.union(v.string(), v.null()),
      role: inviteRole,
      requiresApproval: v.boolean(),
      expiresAt: v.number(),
      usesRemaining: v.union(v.number(), v.null()),
      status: inviteStatus,
      redeemers: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, args.gameId)
    const now = Date.now()

    const invites = await ctx.db
      .query('invites')
      .withIndex('by_game', (q) => q.eq('gameId', args.gameId))
      .collect()

    const out = []
    for (const invite of invites) {
      const redemptions = await ctx.db
        .query('inviteRedemptions')
        .withIndex('by_invite', (q) => q.eq('inviteId', invite._id))
        .collect()

      const redeemers: string[] = []
      for (const redemption of redemptions) {
        const user = await ctx.db.get(redemption.userId)
        redeemers.push(displayNameOf(user, 'Crewmate'))
      }

      out.push({
        _id: invite._id,
        code: invite.code,
        label: invite.label ?? null,
        role: invite.role,
        requiresApproval: invite.requiresApproval,
        expiresAt: invite.expiresAt,
        usesRemaining: invite.usesRemaining ?? null,
        status: statusOf(invite, now),
        redeemers,
      })
    }

    // Newest first — the code an Organizer just minted is the one they want to
    // read out. `_creationTime` is Convex's own field and always present.
    return out.sort((a, b) => b._id.localeCompare(a._id))
  },
})

/**
 * Revoke an invite early.
 *
 * A soft delete: the row stays so its redemption history keeps resolving. It
 * also does **not** evict anyone already seated — removing a member is a
 * different act, and a revoked code that silently kicked people out would be a
 * nasty surprise.
 */
export const revoke = mutation({
  args: { inviteId: v.id('invites') },
  handler: async (ctx, args): Promise<void> => {
    const invite = await ctx.db.get(args.inviteId)
    if (invite === null) return
    await requireOrganizer(ctx, invite.gameId)
    if (invite.revokedAt !== undefined) return
    await ctx.db.patch(invite._id, { revokedAt: Date.now() })
  },
})

/**
 * What a code is worth, without spending it — the landing page's oracle.
 *
 * Returns only what the invite already tells its bearer: never the member list,
 * never the crew, never entity names. A valid code is not yet a seat, and
 * ADR-030 §5 visibility begins at membership.
 *
 * Unauthenticated on purpose — someone following an invite link has not signed
 * in yet, and refusing to say what the link is for until they do is how you get
 * a person signing in to find out they were sent a dead code.
 */
export const preview = query({
  args: { code: v.string() },
  returns: v.union(
    v.object({
      gameName: v.string(),
      invitedBy: v.string(),
      role: inviteRole,
      requiresApproval: v.boolean(),
      status: inviteStatus,
      expiresAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const invite = await inviteByCode(ctx, args.code)
    if (invite === null) return null

    const game = await ctx.db.get(invite.gameId)
    if (game === null) return null

    const inviter = await ctx.db.get(invite.createdBy)

    return {
      gameName: game.name,
      invitedBy: displayNameOf(inviter, 'the Organiser'),
      role: invite.role,
      requiresApproval: invite.requiresApproval,
      status: statusOf(invite, Date.now()),
      expiresAt: invite.expiresAt,
    }
  },
})

/**
 * Seat someone in a Game in the seat their invite promised.
 *
 * Shared by `redeem` (the bearer door) and `decideRequest` (the knock door) so
 * the seat is identical whichever way someone came in — one implementation
 * rather than two that drift.
 */
async function seat(ctx: MutationCtx, invite: Doc<'invites'>, userId: Id<'users'>): Promise<void> {
  const now = Date.now()

  await ctx.db.insert('memberships', {
    gameId: invite.gameId,
    userId,
    mediator: invite.role === 'mediator',
    organizer: false,
    joinedAt: now,
  })

  await ctx.db.insert('inviteRedemptions', {
    inviteId: invite._id,
    gameId: invite.gameId,
    userId,
    redeemedAt: now,
  })

  if (invite.usesRemaining !== undefined) {
    await ctx.db.patch(invite._id, { usesRemaining: invite.usesRemaining - 1 })
  }
}

/**
 * The refusal for a Discord-addressed invite opened by somebody else. It names
 * nobody: who an invite was for is the Organizer's business, and saying it here
 * would turn every leaked link into a lookup.
 */
const NOT_YOUR_INVITE =
  'That invite was sent to a different Discord account. Sign in with the account it was sent to.'

/** Reject a code that cannot currently be spent, with wording worth showing. */
function assertSpendable(invite: Doc<'invites'>): void {
  switch (statusOf(invite, Date.now())) {
    case 'revoked':
      throw new NotAuthorized('That invite link has been revoked')
    case 'declined':
      throw new NotAuthorized('That invite was declined')
    case 'expired':
      throw new NotAuthorized('That invite link has expired')
    case 'exhausted':
      throw new NotAuthorized('That invite link has already been used up')
    default:
      return
  }
}

export type RedeemResult =
  | { kind: 'joined'; gameId: Id<'games'> }
  | { kind: 'pending'; gameId: Id<'games'> }
  | { kind: 'already'; gameId: Id<'games'> }

/**
 * Redeem a code and join the Game.
 *
 * Joining is deliberately the *only* self-serve membership act. Everything
 * downstream of it — whether you mediate, what you own — is decided by the
 * Organizer, when they minted the invite or afterwards (ADR-030 §3), so a
 * valid code buys the seat it was minted for and nothing else.
 *
 * Redeeming twice is a no-op rather than an error: a player who taps a link
 * again should land in the Game, not read a failure. No use is consumed in that
 * case, because they did not take a new seat.
 */
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<RedeemResult> => {
    const userId = await requireUser(ctx)
    const invite = await inviteByCode(ctx, args.code)
    if (invite === null) throw new NotAuthorized('That invite link is not valid')

    // Membership is checked before spendability: someone already seated is home
    // whether or not the code has since expired or been revoked.
    const existing = await getMembership(ctx, invite.gameId, userId)
    if (existing !== null) return { kind: 'already', gameId: invite.gameId }

    assertSpendable(invite)
    if (!(await mayRedeem(ctx, invite, userId))) throw new NotAuthorized(NOT_YOUR_INVITE)

    if (invite.requiresApproval) {
      const prior = await ctx.db
        .query('joinRequests')
        .withIndex('by_invite_user', (q) => q.eq('inviteId', invite._id).eq('userId', userId))
        .unique()

      if (prior === null) {
        await ctx.db.insert('joinRequests', {
          gameId: invite.gameId,
          inviteId: invite._id,
          userId,
          requestedAt: Date.now(),
          state: 'pending',
        })
      } else if (prior.state === 'declined') {
        // Let a declined knocker ask again: an Organizer who declined by mistake
        // should not have to mint a fresh code to undo it.
        await ctx.db.patch(prior._id, {
          state: 'pending',
          requestedAt: Date.now(),
          decidedBy: undefined,
          decidedAt: undefined,
        })
      }
      // Knocking twice is knocking once, and notably NO use is consumed here —
      // otherwise a spam of knocks could burn a code before anyone joined.
      return { kind: 'pending', gameId: invite.gameId }
    }

    await seat(ctx, invite, userId)
    return { kind: 'joined', gameId: invite.gameId }
  },
})

/** Pending knocks for a Game, for the Organizer to answer. */
export const pendingRequests = query({
  args: { gameId: v.id('games') },
  returns: v.array(
    v.object({
      _id: v.id('joinRequests'),
      displayName: v.string(),
      requestedAt: v.number(),
      inviteLabel: v.union(v.string(), v.null()),
      role: inviteRole,
    })
  ),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, args.gameId)
    const requests = await ctx.db
      .query('joinRequests')
      .withIndex('by_game_state', (q) => q.eq('gameId', args.gameId).eq('state', 'pending'))
      .collect()

    const out = []
    for (const request of requests) {
      const user = await ctx.db.get(request.userId)
      const invite = await ctx.db.get(request.inviteId)
      out.push({
        _id: request._id,
        displayName: displayNameOf(user, 'Someone'),
        requestedAt: request.requestedAt,
        inviteLabel: invite?.label ?? null,
        role: invite?.role ?? 'player',
      })
    }
    return out
  },
})

/** Answer a knock. Approving seats them exactly as a direct redeem would. */
export const decideRequest = mutation({
  args: { requestId: v.id('joinRequests'), approve: v.boolean() },
  handler: async (ctx, args): Promise<void> => {
    const request = await ctx.db.get(args.requestId)
    if (request === null) throw new NotAuthorized('That request no longer exists')
    const membership = await requireOrganizer(ctx, request.gameId)
    // Deciding twice is not an error, but the first decision stands.
    if (request.state !== 'pending') return

    const now = Date.now()

    if (!args.approve) {
      await ctx.db.patch(request._id, {
        state: 'declined',
        decidedBy: membership.userId,
        decidedAt: now,
      })
      return
    }

    const invite = await ctx.db.get(request.inviteId)
    if (invite === null) throw new NotAuthorized('That invite no longer exists')

    // The code still has to be live at approval time — an Organizer who sat on a
    // knock past the expiry has let the invitation lapse.
    assertSpendable(invite)

    const already = await getMembership(ctx, request.gameId, request.userId)
    if (already === null) await seat(ctx, invite, request.userId)

    await ctx.db.patch(request._id, {
      state: 'approved',
      decidedBy: membership.userId,
      decidedAt: now,
    })
  },
})
