import { v } from 'convex/values'

import type { Doc, Id } from './_generated/dataModel'
import { mutation } from './_generated/server'
import type { MutationCtx } from './_generated/server'
import {
  NotAuthorized,
  getMembership,
  requireMember,
  requireOwnershipAssigner,
  requireUser,
} from './model/permissions'

/**
 * Entity ownership (ADR-030 §3–4).
 *
 * `ownerId` is nullable and a null owner is a **normal state**, not an error:
 * an unclaimed entity arises when a player leaves a Game, when the Mediator
 * pre-builds a character, or when a Game is seeded from a template. Every
 * surface that renders an owner must render "Unclaimed" rather than a blank.
 *
 * This module is the whole of the write path for the `ownerId` column, and
 * every act in it lands in the Change Log.
 *
 * ## Players self-claim what is offered (amends ADR-030 §4)
 *
 * ADR-030 originally said assignment was the Mediator's alone and players never
 * self-claimed. That has been amended, and the reason is what the unclaimed
 * state is actually *for*: a Mediator pre-builds characters, or a template
 * seeds six of them, precisely so people can arrive and take one. Making the
 * Mediator hand each one over individually adds a round trip to the table's
 * first ten minutes and buys nothing — an unclaimed entity is already an offer
 * to the crew, and `claim` is a player accepting it.
 *
 * What did **not** change is the boundary the original rule protected: claiming
 * touches only what is *free*. An entity somebody already holds cannot be taken
 * — it must be released first, by its owner or the Mediator — so no player can
 * ever pull a character out from under a crewmate. `assign` remains the
 * table runner's power for placing an entity with a *particular* person, which
 * self-claim cannot express.
 */

/** The two entity tables that carry an owner. Crawlers are communal by design. */
const OWNABLE = ['pilots', 'mechs'] as const
export type OwnableTable = (typeof OWNABLE)[number]

const ownableTable = v.union(v.literal('pilots'), v.literal('mechs'))

async function loadOwnable(
  ctx: MutationCtx,
  table: OwnableTable,
  entityId: string
): Promise<Doc<'pilots'> | Doc<'mechs'>> {
  const doc = await ctx.db.get(entityId as Id<'pilots'> | Id<'mechs'>)
  if (doc === null) throw new Error('That entity no longer exists')
  if (!('ownerId' in doc)) throw new Error(`${table} rows are not ownable`)
  return doc as Doc<'pilots'> | Doc<'mechs'>
}

/**
 * Record an ownership change on the Change Log.
 *
 * Ownership moves are `transaction` provenance rather than `manual`: they are
 * lifecycle events performed through an enforced path, not free-hand edits.
 * They are written `applied` — an assignment is not a proposal, because it acts
 * on *who holds* an entity rather than on its contents, which is the boundary
 * the propose-and-confirm rule actually protects.
 */
/* Exported so invite-driven grants log identically — see `invites.ts`. */
export async function logOwnershipChange(
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

/**
 * Assign or reassign an entity to a member of its Game.
 *
 * Covers both the first assignment of an unclaimed entity and moving one
 * between members — they are the same write, and splitting them would only
 * duplicate the permission check.
 */
export const assign = mutation({
  args: {
    table: ownableTable,
    entityId: v.string(),
    toUserId: v.id('users'),
  },
  handler: async (ctx, args): Promise<void> => {
    const doc = await loadOwnable(ctx, args.table, args.entityId)
    if (doc.gameId === null) {
      throw new NotAuthorized('An entity on a shelf has no game to assign it within')
    }

    const actor = await requireOwnershipAssigner(ctx, doc.gameId)

    // The recipient must be in the Game, or the entity would become
    // unreachable — owned by someone with no membership to see it through.
    const recipient = await getMembership(ctx, doc.gameId, args.toUserId)
    if (recipient === null) throw new NotAuthorized('That user is not a member of this game')

    if (doc.ownerId === args.toUserId) return

    await ctx.db.patch(doc._id, { ownerId: args.toUserId, updatedAt: Date.now() })
    await logOwnershipChange(ctx, {
      table: args.table,
      entityId: args.entityId,
      gameId: doc.gameId,
      before: doc.ownerId,
      after: args.toUserId,
      actorId: actor.userId,
    })
  },
})

/**
 * Pick up an unclaimed entity in a Game you belong to.
 *
 * Membership is the whole check *plus* the entity being free — see the module
 * header for why that pair is the entire rule. Note what is deliberately absent:
 * there is no crawler gate here. That gate governs a player *adding* to a Game;
 * claiming adds nothing, it only puts a name to something the table already
 * holds, and a pre-gen offered before the crawler was raised should not become
 * unclaimable because of the order the Mediator worked in.
 *
 * Racing is resolved by the transaction: two players claiming the same pre-gen
 * in the same instant serialize, and the second one finds it owned and is told
 * so, rather than silently overwriting the first.
 */
export const claim = mutation({
  args: { table: ownableTable, entityId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const doc = await loadOwnable(ctx, args.table, args.entityId)
    if (doc.gameId === null) {
      throw new NotAuthorized('That build is on somebody’s shelf, not in a game')
    }

    const membership = await requireMember(ctx, doc.gameId)

    if (doc.ownerId === membership.userId) return
    if (doc.ownerId !== null) {
      throw new NotAuthorized(
        'A crewmate already holds that — it has to be released before anyone else can take it'
      )
    }

    await ctx.db.patch(doc._id, { ownerId: membership.userId, updatedAt: Date.now() })
    await logOwnershipChange(ctx, {
      table: args.table,
      entityId: args.entityId,
      gameId: doc.gameId,
      before: null,
      after: membership.userId,
      actorId: membership.userId,
    })
  },
})

/**
 * Give up something you own; it returns to unclaimed within the same Game.
 *
 * Releasing is always available to the owner and never requires the Mediator —
 * ownership is voluntary in the outward direction. The Mediator may also
 * release on a player's behalf, which is how a Game recovers from someone
 * vanishing mid-campaign.
 */
export const release = mutation({
  args: { table: ownableTable, entityId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const doc = await loadOwnable(ctx, args.table, args.entityId)
    if (doc.gameId === null) {
      throw new NotAuthorized('An entity on a shelf is already unclaimed')
    }
    if (doc.ownerId === null) return

    const userId = await requireUser(ctx)
    const membership = await requireMember(ctx, doc.gameId)
    const isOwner = doc.ownerId === userId
    if (!isOwner && !membership.mediator) {
      throw new NotAuthorized('Only the owner or the Mediator can release this')
    }

    await ctx.db.patch(doc._id, { ownerId: null, updatedAt: Date.now() })
    await logOwnershipChange(ctx, {
      table: args.table,
      entityId: args.entityId,
      gameId: doc.gameId,
      before: doc.ownerId,
      after: null,
      actorId: userId,
    })
  },
})

/**
 * Leave a Game.
 *
 * Entities stay behind, unclaimed, so the crew survives a departure and the
 * Mediator can hand the character to someone else. Nothing is destroyed —
 * a player who wants to keep a character copies it to their shelf first, which
 * is a separate, explicit act.
 *
 * The Organizer cannot leave without handing the flag on: a Game with no
 * Organizer has nobody who can invite, rename, or delete it.
 */
export const leaveGame = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args): Promise<void> => {
    const membership = await requireMember(ctx, args.gameId)
    if (membership.organizer) {
      throw new NotAuthorized('Transfer the Organizer role before leaving this game')
    }

    for (const table of OWNABLE) {
      const owned = await ctx.db
        .query(table)
        .withIndex('by_owner', (q) => q.eq('ownerId', membership.userId))
        .collect()
      for (const row of owned) {
        if (row.gameId !== args.gameId) continue
        await ctx.db.patch(row._id, { ownerId: null, updatedAt: Date.now() })
        await logOwnershipChange(ctx, {
          table,
          entityId: row._id,
          gameId: args.gameId,
          before: membership.userId,
          after: null,
          actorId: membership.userId,
        })
      }
    }

    await ctx.db.delete(membership._id)
  },
})
