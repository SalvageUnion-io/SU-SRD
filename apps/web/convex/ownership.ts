import { v } from 'convex/values'
import type { OwnableTable } from 'game-domain/entityKinds'
import type { Id } from './_generated/dataModel'
import type { MutationCtx } from './_generated/server'
import { loadOwnable, logIdOf, mutation } from './model/entities'
import { getMembership, isTableRunner, NotAuthorized, requireMember } from './model/permissions'
import { ownableTable } from './schema'

/**
 * Who a pilot or mech in a Game is assigned to (ADR-030 §3–4, as amended).
 *
 * `ownerId` is nullable and a null owner is a **normal state**, not an error:
 * an unassigned entity arises when a player leaves a Game, when the Mediator
 * pre-builds a character, or when a Game is seeded from a template. Every
 * surface that renders an owner must render "Unassigned" rather than a blank.
 *
 * This module is the whole of the write path for the `ownerId` column, and
 * every act in it lands in the Change Log.
 *
 * ## Assign, never claim
 *
 * A pilot or mech in a Game is the crew's: what a member holds is an
 * **assignment**, not ownership. The member it is assigned to edits it, the
 * rest of the crew reads it (ADR-030 §5), and the table runner (the Mediator,
 * or the Organizer while nobody mediates) may assign it to anyone in the Game,
 * reassigning what somebody holds. A player may assign a *free* one to
 * themselves: a pre-gen or a spare mech is an offer to the crew, and a round
 * trip through the Mediator for each seat buys nothing. A player never takes
 * what a crewmate holds; it is unassigned first, by its holder or the table
 * runner.
 */

/**
 * Record an ownership change on the Change Log.
 *
 * Ownership moves are `transaction` provenance rather than `manual`: they are
 * lifecycle events performed through an enforced path, not free-hand edits.
 * They are written `applied` — an assignment is not a proposal, because it acts
 * on *who holds* an entity rather than on its contents, which is the boundary
 * the propose-and-confirm rule actually protects.
 */
async function logOwnershipChange(
  ctx: MutationCtx,
  args: {
    table: OwnableTable
    entityId: string
    gameId: Id<'games'> | null
    before: Id<'users'> | null
    after: Id<'users'> | null
    actorId: Id<'users'>
  }
): Promise<void> {
  await ctx.db.insert('changeLog', {
    gameId: args.gameId,
    entityType: args.table === 'pilots' ? 'pilot' : 'mech',
    entityId: args.entityId,
    ts: Date.now(),
    kind: 'transaction',
    field: 'ownerId',
    before: args.before,
    after: args.after,
    source: 'ownership',
    actorId: args.actorId,
    state: 'applied',
  })
}

/** Why a shelved entity has nobody to be assigned to or from. */
const ON_SHELF = 'That build is in somebody’s Training Bay, not in a Game'

/**
 * Assign a pilot or mech in a Game to a member (`userId`, the caller when
 * absent).
 *
 * - **To yourself, when it is free:** any member. This is how a player sits
 *   down with a pre-gen or boards a spare mech.
 * - **To anyone, held or not:** the table runner only. Reassigning is how a
 *   Game recovers from somebody vanishing mid-campaign, or hands a pre-gen to
 *   the player who asked for it at the table.
 *
 * The assignee must be a member of the entity's Game. Note what is deliberately
 * absent: any crawler check. Assigning adds nothing to the Game — it only puts
 * a name to something the table already holds — so it leaves the entity's
 * crawler and pilot links exactly as they were (ADR-037).
 *
 * Racing is resolved by the transaction: two players assigning themselves the
 * same pre-gen in the same instant serialize, and the second one finds it held
 * and is told so, rather than silently overwriting the first.
 */
export const assign = mutation({
  args: {
    table: ownableTable,
    entityId: v.string(),
    userId: v.optional(v.id('users')),
  },
  handler: async (ctx, args): Promise<void> => {
    const doc = await loadOwnable(ctx, args.table, args.entityId)
    if (doc.gameId === null) throw new NotAuthorized(ON_SHELF)

    const membership = await requireMember(ctx, doc.gameId)
    const assignee = args.userId ?? membership.userId
    if (doc.ownerId === assignee) return

    const self = assignee === membership.userId
    if (!self || doc.ownerId !== null) {
      if (!(await isTableRunner(ctx, doc.gameId, membership))) {
        throw new NotAuthorized(
          self
            ? 'A crewmate already holds that — it has to be unassigned before anyone else can take it'
            : 'Only the Mediator can assign that to somebody else'
        )
      }
    }
    if (!self && (await getMembership(ctx, doc.gameId, assignee)) === null) {
      throw new NotAuthorized('They are not in this Game')
    }

    await ctx.db.patch(doc._id, { ownerId: assignee, updatedAt: Date.now() })
    await logOwnershipChange(ctx, {
      table: args.table,
      entityId: logIdOf(doc),
      gameId: doc.gameId,
      before: doc.ownerId,
      after: assignee,
      actorId: membership.userId,
    })
  },
})

/**
 * Hand back something assigned to you; it stays in the Game, unassigned.
 *
 * Always open to its holder and never requires the Mediator: an assignment is
 * voluntary in the outward direction. The table runner may also unassign on a
 * player's behalf.
 */
export const unassign = mutation({
  args: { table: ownableTable, entityId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const doc = await loadOwnable(ctx, args.table, args.entityId)
    if (doc.gameId === null) {
      /*
       * A shelved entity is NOT unassigned.
       *
       * ADR-030 §2 allows three states, and they are not interchangeable:
       * `gameId` set + `ownerId` null is **unassigned** — in a Game, waiting
       * for somebody to take it; `gameId` null + `ownerId` set is **on the
       * owner's shelf** — already somebody's. Both null is the one invalid
       * combination, which is exactly what unassigning a shelved entity would
       * produce, and is why this refuses rather than no-ops. `NotAuthorized`
       * reaches the player, so the message teaches the model.
       */
      throw new NotAuthorized(
        'A build in your Training Bay is already yours — there is no crew here to hand it to. Move it into a Game first.'
      )
    }
    if (doc.ownerId === null) return

    const membership = await requireMember(ctx, doc.gameId)
    const isHolder = doc.ownerId === membership.userId
    if (!isHolder && !(await isTableRunner(ctx, doc.gameId, membership))) {
      throw new NotAuthorized('Only its holder or the Mediator can unassign this')
    }

    await ctx.db.patch(doc._id, { ownerId: null, updatedAt: Date.now() })
    await logOwnershipChange(ctx, {
      table: args.table,
      entityId: logIdOf(doc),
      gameId: doc.gameId,
      before: doc.ownerId,
      after: null,
      actorId: membership.userId,
    })
  },
})
