import { getAuthUserId } from '@convex-dev/auth/server'

import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

/**
 * Capability checks for Games (ADR-030 §3).
 *
 * **Authorization lives here and only here.** The client is free to hide
 * controls it knows the user cannot use, but hiding is a courtesy, not a
 * boundary — every mutation calls into this module before it writes. A rule
 * enforced in the UI is not enforced.
 *
 * The role model is a **base role plus one modifier**, not three parallel
 * roles:
 *
 *   - every member is a Player or a Mediator (`membership.mediator`)
 *   - exactly one member additionally carries `organizer: true`
 *
 * Organizer is deliberately administrative only. It grants membership and
 * settings powers and **nothing over game content** — an Organizer's reach
 * over a pilot, a mech, or the crawler is whatever their base role already
 * gave them. The single exception is documented on
 * `requireOwnershipAssigner` below, and it is a considered one.
 */

type AnyCtx = QueryCtx | MutationCtx

/** Thrown for every authorization failure, so callers can map it to a 403. */
export class NotAuthorized extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'NotAuthorized'
  }
}

/** The signed-in user, or a throw. Solo (anonymous) callers never reach here. */
export async function requireUser(ctx: AnyCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx)
  if (userId === null) throw new NotAuthorized('Not signed in')
  return userId
}

/** This user's membership in `gameId`, or null when they are not a member. */
export async function getMembership(
  ctx: AnyCtx,
  gameId: Id<'games'>,
  userId: Id<'users'>
): Promise<Doc<'memberships'> | null> {
  return await ctx.db
    .query('memberships')
    .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', userId))
    .unique()
}

/** Membership in `gameId`, or a throw. The baseline check for any Game read. */
export async function requireMember(ctx: AnyCtx, gameId: Id<'games'>): Promise<Doc<'memberships'>> {
  const userId = await requireUser(ctx)
  const membership = await getMembership(ctx, gameId, userId)
  if (membership === null) throw new NotAuthorized('Not a member of this game')
  return membership
}

/** Membership with `mediator: true`, or a throw. */
export async function requireMediator(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  const membership = await requireMember(ctx, gameId)
  if (!membership.mediator) throw new NotAuthorized('Only the Mediator can do that')
  return membership
}

/** Membership with `organizer: true`, or a throw. Administrative acts only. */
export async function requireOrganizer(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  const membership = await requireMember(ctx, gameId)
  if (!membership.organizer) throw new NotAuthorized('Only the Organizer can do that')
  return membership
}

/** True when `gameId` has at least one member flagged as Mediator. */
export async function gameHasMediator(ctx: AnyCtx, gameId: Id<'games'>): Promise<boolean> {
  const members = await ctx.db
    .query('memberships')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect()
  return members.some((m) => m.mediator)
}

/**
 * Whoever may assign or reassign entity ownership in this Game.
 *
 * This is the **one deliberate bend** in "Organizer confers no content
 * authority" (ADR-030 §3). Assignment belongs to the Mediator, but a Game with
 * no Mediator assigned would otherwise have nobody able to hand out a pilot —
 * a dead end reachable the moment a Game is created. So the Organizer picks it
 * up, and *only* when there is no Mediator.
 *
 * It is defensible because who-owns-what is closer to membership than to
 * content: assigning a pilot never edits one.
 */
export async function requireOwnershipAssigner(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  const membership = await requireMember(ctx, gameId)
  if (membership.mediator) return membership
  if (membership.organizer && !(await gameHasMediator(ctx, gameId))) return membership
  throw new NotAuthorized(
    'Only the Mediator can assign ownership (or the Organizer, when the game has no Mediator)'
  )
}
