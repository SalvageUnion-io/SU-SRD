import { getAuthUserId } from '@convex-dev/auth/server'
import { ConvexError } from 'convex/values'
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

/**
 * Thrown for every authorization failure, so callers can map it to a 403.
 *
 * **It extends `ConvexError`, and that is the only reason any of the messages
 * in this repo reach a player.** Convex redacts a plain `Error` thrown from a
 * production function down to `"[CONVEX M(fn)] Server Error"` before the client
 * ever sees it — deliberately, so an unhandled crash cannot leak internals.
 * `ConvexError` is the documented opt-out: its `data` is sent over the wire
 * intact.
 *
 * Until this changed, every carefully-worded refusal here — "This game has no
 * Union Crawler yet — the Mediator raises one before the crew joins it", "You
 * cannot edit another player's entity" — was written, thrown, and then thrown
 * away at the boundary. A player who tried something the rules disallow got the
 * same opaque "Server Error" as a genuine crash, and so did the operator
 * reading Sentry.
 *
 * The distinction this draws is the one worth keeping: a `NotAuthorized` is an
 * **expected answer** to a request the rules refuse, and it says so out loud. A
 * plain `Error` remains what it was — a defect nobody planned for, opaque to
 * the client on purpose and legible only in the Convex logs and Sentry.
 *
 * Note the subclass itself does not survive the wire: the client receives a
 * plain `ConvexError` whose `data` is this message, so it narrows with
 * `instanceof ConvexError`, never `instanceof NotAuthorized`. See
 * `src/lib/connection/serverError.ts`.
 */
export class NotAuthorized extends ConvexError<string> {
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

/**
 * ## The `…As` variants
 *
 * Every check below comes in two forms: one that reads the actor from the
 * Convex auth token, and one taking the actor explicitly. They exist for the
 * Discord bot (ADR-030 Phase 6), which authenticates over HTTP with a bot
 * credential and resolves its actor from a linked Discord id — so it has a
 * `userId` in hand but no token for `getAuthUserId` to read.
 *
 * The split is deliberately at the *actor*, not at the *rule*. The token-based
 * functions are thin wrappers that resolve an actor and delegate, so there is
 * exactly one implementation of "what may a Mediator do" and the bot cannot
 * drift from it. Adding a rule here reaches every caller; adding one anywhere
 * else is a bug.
 */

/** Membership in `gameId` for an explicit actor, or a throw. */
export async function requireMemberAs(
  ctx: AnyCtx,
  gameId: Id<'games'>,
  userId: Id<'users'>
): Promise<Doc<'memberships'>> {
  const membership = await getMembership(ctx, gameId, userId)
  if (membership === null) throw new NotAuthorized('Not a member of this game')
  return membership
}

/** Membership in `gameId`, or a throw. The baseline check for any Game read. */
export async function requireMember(ctx: AnyCtx, gameId: Id<'games'>): Promise<Doc<'memberships'>> {
  return await requireMemberAs(ctx, gameId, await requireUser(ctx))
}

/** Membership with `mediator: true` for an explicit actor, or a throw. */
export async function requireMediatorAs(
  ctx: AnyCtx,
  gameId: Id<'games'>,
  userId: Id<'users'>
): Promise<Doc<'memberships'>> {
  const membership = await requireMemberAs(ctx, gameId, userId)
  if (!membership.mediator) throw new NotAuthorized('Only the Mediator can do that')
  return membership
}

/** Membership with `mediator: true`, or a throw. */
export async function requireMediator(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  return await requireMediatorAs(ctx, gameId, await requireUser(ctx))
}

/** Membership with `organizer: true` for an explicit actor, or a throw. */
export async function requireOrganizerAs(
  ctx: AnyCtx,
  gameId: Id<'games'>,
  userId: Id<'users'>
): Promise<Doc<'memberships'>> {
  const membership = await requireMemberAs(ctx, gameId, userId)
  if (!membership.organizer) throw new NotAuthorized('Only the Organizer can do that')
  return membership
}

/** Membership with `organizer: true`, or a throw. Administrative acts only. */
export async function requireOrganizer(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  return await requireOrganizerAs(ctx, gameId, await requireUser(ctx))
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
 * Whoever runs the table: the Mediator, or the Organizer while a Game has none.
 *
 * This is the **one deliberate bend** in "Organizer confers no content
 * authority" (ADR-030 §3), and it exists because every one of these acts is a
 * dead end otherwise. A Game is created with `mediator: false` on its only
 * membership, so if table authority were Mediator-strict there would be an
 * unreachable state the moment somebody makes a Game alone: no crawler can be
 * raised, no pilot handed out, and nothing to appoint a Mediator *for*.
 *
 * The fallback is narrow on purpose — it applies only while the Game has no
 * Mediator at all, and it is re-evaluated per call rather than latched, so
 * appointing one takes the authority back the same instant.
 *
 * Three acts share this rule, and they share it because they are the same
 * kind of act — *setting the table up* rather than editing what is on it:
 *
 *   - raising or scrapping a **crawler** (ADR-030 §5 amendment)
 *   - creating an entity **unclaimed**, for the crew to pick up
 *   - **assigning** or reassigning ownership
 *
 * None of them edits a sheet. That is the line: a table runner arranges who
 * holds what and what the crew sails in, and still cannot change a number on
 * somebody else's pilot — for that there is a proposal (§4).
 */
export async function isTableRunner(
  ctx: AnyCtx,
  gameId: Id<'games'>,
  membership: Doc<'memberships'>
): Promise<boolean> {
  if (membership.mediator) return true
  return membership.organizer && !(await gameHasMediator(ctx, gameId))
}

export async function requireTableRunner(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  const membership = await requireMember(ctx, gameId)
  if (await isTableRunner(ctx, gameId, membership)) return membership
  throw new NotAuthorized(
    'Only the Mediator can do that (or the Organizer, when the game has no Mediator)'
  )
}

/**
 * Whoever may assign or reassign entity ownership in this Game.
 *
 * Kept as its own name because the call sites read better for it and because
 * ADR-030 §3 names assignment specifically; the rule itself is
 * `requireTableRunner`, and there is deliberately only one implementation of
 * it so the two can never drift into different answers.
 */
export async function requireOwnershipAssigner(
  ctx: AnyCtx,
  gameId: Id<'games'>
): Promise<Doc<'memberships'>> {
  return await requireTableRunner(ctx, gameId)
}

/**
 * True once a Game has somewhere for its crew to live.
 *
 * The crawler is the crew's home, and in Salvage Union a pilot without one is
 * a character with no context — no Bay to repair in, no scrap pool, no place
 * to return to. So a Game is *set up* by raising a crawler, and only then does
 * it start taking pilots and mechs from its players.
 *
 * This is a gate on **players adding to a Game**, never on the table runner,
 * who has to be able to build the crawler first for anyone else to have one.
 */
export async function gameHasCrawler(ctx: AnyCtx, gameId: Id<'games'>): Promise<boolean> {
  const first = await ctx.db
    .query('crawlers')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .first()
  return first !== null
}
