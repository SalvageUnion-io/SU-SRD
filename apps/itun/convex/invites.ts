import { getAuthUserId } from '@convex-dev/auth/server'
import { v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { query } from './_generated/server'
import { mutation } from './model/entities'
import { discordIdOfUser, mayRedeem, mintInvite, statusOf } from './model/invites'
import { getMembership, NotAuthorized, requireOrganizer, requireUser } from './model/permissions'
import { logOwnershipChange } from './ownership'

/**
 * Invite codes (ADR-030 §3, and the invite amendment) — how a player joins a
 * Game. Not §2: that section is Containers, and its only mention of invites is
 * that a shelf has none.
 *
 * Codes reuse `generateUniqueId` from the snapshot module rather than growing a
 * second generator: it is already Crockford base32 (no I/L/O/U, so a code read
 * aloud across a table cannot be mistyped), already collision-checked against a
 * caller-supplied `exists`, and already backed by `crypto.getRandomValues`.
 * Those are exactly the properties an invite code wants. Minting itself is
 * `model/invites.ts#mintInvite`, shared with every other door that creates one.
 *
 * An invite carries four things beyond the code itself:
 *
 *   - **A seat** (`role`). A Mediator invite hands over the GM chair on join,
 *     which is the Organizer pre-exercising the authority `games.setMediator`
 *     already gives them.
 *   - **Grants**. Unclaimed entities assigned on join. Ownership stays
 *     *assigned, never self-claimed* (ADR-030 §4) — the Organizer made the
 *     decision when minting, and the Change Log records them as the actor.
 *   - **A door** (`requiresApproval`). A bearer code IS the authority; a knock
 *     grants nothing until the Organizer approves it, which is what a code
 *     posted somewhere public needs, since membership confers read access to
 *     every crewmate's sheet (ADR-030 §5).
 *   - **An address** (`target`, ADR-038). A Discord-addressed invite is
 *     redeemable only by that Discord account; an email-addressed one by
 *     whoever holds its link. Either is single use, and either may be declined.
 */

/** Mint an invite for a Game. Administrative, so Organizer only. */
export const create = mutation({
  args: {
    gameId: v.id('games'),
    usesRemaining: v.optional(v.number()),
    expiresInMs: v.optional(v.number()),
    label: v.optional(v.string()),
    role: v.optional(v.union(v.literal('player'), v.literal('mediator'))),
    grants: v.optional(
      v.array(
        v.object({
          table: v.union(v.literal('pilots'), v.literal('mechs')),
          entityId: v.string(),
        })
      )
    ),
    requiresApproval: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<string> => {
    const membership = await requireOrganizer(ctx, args.gameId)
    const invite = await mintInvite(ctx, membership, args)
    return invite.code
  },
})

/**
 * Who an invite is addressed to, as the Organizer's list shows it.
 *
 * Never the snowflake and never the raw address: the handle is what the
 * Organizer picked from Discord's own user picker, and an address is shown
 * masked even while it is still stored, so nothing on this screen is worth
 * more to a shoulder-surfer than it is to the Organizer.
 */
function addressOf(
  invite: Doc<'invites'>
): { kind: 'discord'; name: string | null } | { kind: 'email'; masked: string } | null {
  const target = invite.target
  if (target === undefined) return null
  if (target.kind === 'discord') return { kind: 'discord', name: target.name ?? null }
  return { kind: 'email', masked: target.masked }
}

/** Every invite for a Game, with its derived status and who has used it. */
export const list = query({
  args: { gameId: v.id('games') },
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
        redeemers.push(user?.displayName ?? user?.name ?? 'Crewmate')
      }

      out.push({
        _id: invite._id,
        code: invite.code,
        label: invite.label ?? null,
        role: invite.role ?? 'player',
        grantCount: invite.grants?.length ?? 0,
        requiresApproval: invite.requiresApproval ?? false,
        expiresAt: invite.expiresAt ?? null,
        usesRemaining: invite.usesRemaining ?? null,
        status: statusOf(invite, now),
        redeemers,
        target: addressOf(invite),
        delivery:
          invite.delivery === undefined
            ? null
            : { state: invite.delivery.state, detail: invite.delivery.detail ?? null },
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
 * ADR-030 §5 visibility begins at membership, so `grants` is reported as a
 * count rather than as identity.
 *
 * Unauthenticated on purpose — someone following an invite link has not signed
 * in yet, and refusing to say what the link is for until they do is how you get
 * a person signing in to find out they were sent a dead code.
 *
 * An addressed invite (ADR-038) says only *how* it is addressed, never to whom.
 * For a Discord one, a signed-in viewer also learns whether it is theirs — the
 * same fact `redeem` would tell them, offered before they press the button.
 */
export const preview = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const code = args.code.trim().toUpperCase()
    if (code.length === 0) return null

    const invite = await ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()
    if (invite === null) return null

    const game = await ctx.db.get(invite.gameId)
    if (game === null) return null

    const inviter = await ctx.db.get(invite.createdBy)

    let forYou: boolean | null = null
    if (invite.target?.kind === 'discord') {
      const viewer = await getAuthUserId(ctx)
      if (viewer !== null) forYou = await mayRedeem(ctx, invite, viewer)
    }

    return {
      gameName: game.name,
      invitedBy: inviter?.displayName ?? inviter?.name ?? 'the organizer',
      role: invite.role ?? 'player',
      requiresApproval: invite.requiresApproval ?? false,
      grantCount: invite.grants?.length ?? 0,
      status: statusOf(invite, Date.now()),
      expiresAt: invite.expiresAt ?? null,
      addressed: invite.target?.kind ?? null,
      forYou,
    }
  },
})

/**
 * Seat someone in a Game with everything their invite promised.
 *
 * Shared by `redeem` (the bearer door) and `decideRequest` (the knock door) so
 * role and grants behave identically whichever way someone came in — one
 * implementation rather than two that drift.
 *
 * Returns how many grants actually landed.
 */
async function seat(
  ctx: MutationCtx,
  invite: Doc<'invites'>,
  userId: Id<'users'>
): Promise<number> {
  const now = Date.now()

  await ctx.db.insert('memberships', {
    gameId: invite.gameId,
    userId,
    mediator: (invite.role ?? 'player') === 'mediator',
    organizer: false,
    joinedAt: now,
  })

  let granted = 0
  for (const grant of invite.grants ?? []) {
    /*
     * A grant is a promise made when the invite was minted, and the world may
     * have moved since: the entity could have been claimed by someone else,
     * moved to another Game, or deleted. Skip it and seat them anyway —
     * arriving without the promised pilot is a notice, whereas failing the join
     * over a stale pointer would strand someone outside a Game they were
     * genuinely invited to.
     *
     * `normalizeId` is what makes `grant.table` load-bearing rather than
     * decorative: a Convex id is table-tagged, but `db.get` returns a document
     * from ANY table, so casting the string let a grant naming `pilots` hand
     * over a row from somewhere else entirely. A mismatched id is a stale
     * pointer like any other, so it takes the same skip.
     */
    const entityId = ctx.db.normalizeId(grant.table, grant.entityId)
    if (entityId === null) continue

    const doc = await ctx.db.get(entityId)
    if (doc === null) continue
    if (doc.gameId !== invite.gameId) continue
    if (doc.ownerId !== null) continue

    await ctx.db.patch(doc._id, { ownerId: userId, updatedAt: now })
    await logOwnershipChange(ctx, {
      table: grant.table,
      entityId: grant.entityId,
      gameId: invite.gameId,
      before: null,
      after: userId,
      // The Organizer decided this when they minted the invite; the joiner
      // merely turned up. Recording the joiner would make ownership look
      // self-claimed, which ADR-030 §4 is explicit that it is not.
      actorId: invite.createdBy,
    })
    granted += 1
  }

  await ctx.db.insert('inviteRedemptions', {
    inviteId: invite._id,
    gameId: invite.gameId,
    userId,
    redeemedAt: now,
  })

  if (invite.usesRemaining !== undefined) {
    await ctx.db.patch(invite._id, { usesRemaining: invite.usesRemaining - 1 })
  }

  return granted
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
      throw new NotAuthorized('That invite code has been revoked')
    case 'declined':
      throw new NotAuthorized('That invite was declined')
    case 'expired':
      throw new NotAuthorized('That invite code has expired')
    case 'exhausted':
      throw new NotAuthorized('That invite code has already been used up')
    default:
      return
  }
}

export type RedeemResult =
  | { kind: 'joined'; gameId: Id<'games'>; granted: number }
  | { kind: 'pending'; gameId: Id<'games'> }
  | { kind: 'already'; gameId: Id<'games'> }

/**
 * Redeem a code and join the Game.
 *
 * Joining is deliberately the *only* self-serve membership act. Everything
 * downstream of it — what you own, whether you mediate — is decided by the
 * Organizer, either when they minted the invite or afterwards (ADR-030 §3), so
 * a valid code buys the seat it was minted for and nothing else.
 *
 * Redeeming twice is a no-op rather than an error: a player who taps a link
 * again should land in the Game, not read a failure. No use is consumed in that
 * case, because they did not take a new seat.
 */
export const redeem = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<RedeemResult> => {
    const userId = await requireUser(ctx)
    const code = args.code.trim().toUpperCase()

    const invite = await ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()
    if (invite === null) throw new NotAuthorized('That invite code is not valid')

    // Membership is checked before spendability: someone already seated is home
    // whether or not the code has since expired or been revoked.
    const existing = await getMembership(ctx, invite.gameId, userId)
    if (existing !== null) return { kind: 'already', gameId: invite.gameId }

    assertSpendable(invite)
    if (!(await mayRedeem(ctx, invite, userId))) throw new NotAuthorized(NOT_YOUR_INVITE)

    if (invite.requiresApproval === true) {
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

    const granted = await seat(ctx, invite, userId)
    return { kind: 'joined', gameId: invite.gameId, granted }
  },
})

/**
 * Turn down an addressed invite (ADR-038).
 *
 * Only an addressed invite can be declined: a bearer code may be meant for a
 * whole table, and one person saying no must not close it for the rest. The
 * same address rule as `redeem` applies — a Discord invite can be declined
 * only by its addressee, an email one by whoever holds the link — so nobody
 * can decline on somebody else's behalf.
 *
 * Declining is terminal; asking again means asking the Organizer for a new
 * invite. Declining twice, or after it lapsed, is a no-op rather than an error.
 */
export const decline = mutation({
  args: { code: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const code = args.code.trim().toUpperCase()

    const invite = await ctx.db
      .query('invites')
      .withIndex('by_code', (q) => q.eq('code', code))
      .unique()
    if (invite === null) throw new NotAuthorized('That invite code is not valid')
    if (invite.target === undefined) {
      throw new NotAuthorized('Only an invite sent to you can be declined')
    }
    if (!(await mayRedeem(ctx, invite, userId))) throw new NotAuthorized(NOT_YOUR_INVITE)
    if (statusOf(invite, Date.now()) !== 'active') return

    await ctx.db.patch(invite._id, { declinedAt: Date.now() })
  },
})

/**
 * Live invites addressed to the signed-in player's Discord account — the hub's
 * Invitations card (ADR-038).
 *
 * This is why a failed DM is not a lost invite: whatever happened in Discord,
 * the addressee finds it here the next time they open the app. Email invites
 * are not listed, because they are redeemed by possession and the app does not
 * know which address is yours.
 *
 * Returns the same facts `preview` gives a link holder, plus the code to act
 * on — nothing about the crew, as membership has not begun.
 */
export const forMe = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx)
    if (userId === null) return []
    const discordId = await discordIdOfUser(ctx, userId)
    if (discordId === null) return []

    const now = Date.now()
    const invites = await ctx.db
      .query('invites')
      .withIndex('by_target_discord', (q) => q.eq('target.discordId', discordId))
      .collect()

    const out = []
    for (const invite of invites) {
      if (statusOf(invite, now) !== 'active') continue
      // Already seated (another door, or an earlier invite): nothing to accept.
      if ((await getMembership(ctx, invite.gameId, userId)) !== null) continue
      const game = await ctx.db.get(invite.gameId)
      if (game === null) continue
      const inviter = await ctx.db.get(invite.createdBy)
      out.push({
        _id: invite._id,
        code: invite.code,
        gameName: game.name,
        invitedBy: inviter?.displayName ?? inviter?.name ?? 'the organizer',
        role: invite.role ?? 'player',
        grantCount: invite.grants?.length ?? 0,
        expiresAt: invite.expiresAt ?? null,
      })
    }
    return out
  },
})

/** Pending knocks for a Game, for the Organizer to answer. */
export const pendingRequests = query({
  args: { gameId: v.id('games') },
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
        displayName: user?.displayName ?? user?.name ?? 'Someone',
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
