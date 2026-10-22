import type { ObjectType } from 'convex/values'
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { OwnedTable } from './entities'
import {
  assignToPrimary,
  countPatternBuild,
  linkIdOf,
  oldestByAppId,
  parseBody,
  pruneLinksAcrossContainers,
  pruneLinksOfRow,
} from './entities'
import { getMembership, NotAuthorized } from './permissions'
import { handOffSoloSeat, releaseSeatsOf } from './seats'
import { staleWriteError } from './staleWrite'

/**
 * The owned-entity writes behind `entities.ts`: pilots, mechs and built NPCs,
 * addressed by app id and written whole by their owner (ADR-030 §1, ADR-044).
 * The public mutations live in `entities.ts`; this module is their helpers, so
 * `transfer` can run the same write as `upsertByAppId` and `removeByAppId`.
 */

/** The tables written whole by their owner: pilots, mechs and built NPCs (ADR-044). */
export const OWNED = v.union(v.literal('pilots'), v.literal('mechs'), v.literal('npcs'))

/** A pilot, mech or NPC body write, addressed by app id (`upsertByAppId`). */
export const OWNABLE_WRITE = {
  table: OWNED,
  appId: v.string(),
  gameId: v.union(v.id('games'), v.null()),
  body: v.any(),
  /** The row version the client's copy came from; `null` when it holds none. */
  expectedUpdatedAt: v.union(v.number(), v.null()),
}

/**
 * Who may write an entity.
 *
 * Synchronous and ctx-free on purpose: the answer depends only on the row's
 * own `ownerId`. There is deliberately no lookup that could grant a Mediator a
 * privileged write here — changing someone else's sheet goes through a
 * proposal (ADR-030 §4), and giving this function a ctx would invite exactly that.
 */
export function assertMayWrite(
  doc: Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'>,
  userId: Id<'users'>
): void {
  if (doc.ownerId === userId) return
  if (doc.ownerId === null) {
    throw new NotAuthorized(
      'That entity is unclaimed — it must be assigned before it can be edited'
    )
  }
  throw new NotAuthorized("You cannot edit another player's entity")
}

/**
 * Whether this user may add a pilot or mech to this container — by creating it
 * there or moving their own in.
 *
 * The shelf is unconditional: it is your own. A Game takes a member's builds
 * whether or not it has a crawler yet (ADR-037 dropped that gate); being a
 * member is the whole rule.
 */
async function assertMayAddToContainer(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'> | null,
  userId: Id<'users'>
): Promise<void> {
  if (gameId === null) return
  const membership = await getMembership(ctx, gameId, userId)
  if (membership === null) throw new NotAuthorized('Not a member of this Game')
}

/** `oldestByAppId` over the owned tables, warning on a duplicate. */
export async function byAppId(
  ctx: MutationCtx,
  table: OwnedTable,
  appId: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'> | null> {
  return (await oldestByAppId(ctx, table, appId, { warn: true })) as Doc<OwnedTable> | null
}

/**
 * A claimed template pre-gen the writer owns, addressed by its body id.
 *
 * `templates.createGame` seeds its crew with no `appId`. A claimed pre-gen is
 * cached in the browser under its body id (`listMine` serves the body), so its
 * writes arrive addressed by that id, which `byAppId` cannot find: the write
 * would insert a second copy of the character. Only the owner may write a row
 * (`assertMayWrite`), so the row is looked for among the writer's own, wherever
 * it is (a write that moves it to the shelf names the shelf, not its Game).
 *
 * The id is NOT stamped on the row as its `appId`. Every Game made from a
 * template carries the same body ids, and `byAppId` and `resolveLinkEnd` look
 * an app id up across every Game, so a stamped pre-gen would answer for its
 * namesake in the next Game (boarding a second table's Scrapper found the
 * first's).
 *
 * `gameId` narrows the search to the write's own Game (`undefined` searches
 * every container the writer holds rows in).
 */
async function ownedTemplateRow(
  ctx: MutationCtx,
  userId: Id<'users'>,
  table: OwnedTable,
  gameId: Id<'games'> | null | undefined,
  bodyId: string
): Promise<Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'> | null> {
  const owned = (await ctx.db
    .query(table)
    .withIndex('by_owner_game', (q) =>
      gameId === undefined ? q.eq('ownerId', userId) : q.eq('ownerId', userId).eq('gameId', gameId)
    )
    .collect()) as Array<Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'>>
  return owned.find((r) => r.appId === undefined && linkIdOf(r) === bodyId) ?? null
}

/**
 * The row a write addressed by `appId` lands on.
 *
 * The writer's own seeded pre-gen in the write's Game answers first. Only then
 * is the app id looked up, because rows stamped with a template body id exist
 * (edits to claimed pre-gens inserted them before `ownedTemplateRow` did), and
 * `byAppId` searches every account and Game: answering with another player's
 * stamped row refused the write as theirs, and the writer's own stamped row in
 * another Game was moved into this one, leaving the seeded row unwritten.
 *
 * A stamped row the writer does not own still loses to a seeded row of theirs
 * elsewhere (a claimed pre-gen moved to the shelf names the shelf).
 */
async function writeTarget(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: Pick<ObjectType<typeof OWNABLE_WRITE>, 'table' | 'gameId' | 'appId'>
): Promise<Doc<'pilots'> | Doc<'mechs'> | Doc<'npcs'> | null> {
  const seededHere = await ownedTemplateRow(ctx, userId, args.table, args.gameId, args.appId)
  if (seededHere !== null) return seededHere
  const stamped = await byAppId(ctx, args.table, args.appId)
  if (stamped !== null && stamped.ownerId === userId) return stamped
  return (await ownedTemplateRow(ctx, userId, args.table, undefined, args.appId)) ?? stamped
}

/** `upsertByAppId`'s write, shared with `transfer`. */
export async function writeOwnable(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof OWNABLE_WRITE>
): Promise<{ updatedAt: number }> {
  const body = parseBody(args.table, args.body)

  // A built NPC is owned like a pilot but plays no part in the primary
  // crawler's crew or a seat: it boards nothing and is never auto-assigned.
  const kind = args.table === 'pilots' ? 'pilot' : args.table === 'mechs' ? 'mech' : null
  const existing = await writeTarget(ctx, userId, args)
  const updatedAt = Date.now()
  if (existing === null) {
    await assertMayAddToContainer(ctx, args.gameId, userId)
    const id = await ctx.db.insert(args.table, {
      gameId: args.gameId,
      ownerId: userId,
      appId: args.appId,
      body,
      updatedAt,
    })
    // Created in a Game: aboard its primary crawler from the start (ADR-037).
    const created = await ctx.db.get(id)
    if (created !== null && kind !== null) {
      await assignToPrimary(ctx, kind, created as Doc<'pilots'> | Doc<'mechs'>)
    }
    // Built from a saved pattern: the pattern page counts it. Only on
    // the create — editing a mech built from one never counts it again.
    if (args.table === 'mechs') await countPatternBuild(ctx, body, userId)
    return { updatedAt }
  }

  assertMayWrite(existing, userId)
  // After the ownership check, so the refusal hands the row only to its owner.
  if (args.expectedUpdatedAt !== null && existing.updatedAt > args.expectedUpdatedAt) {
    throw staleWriteError(existing)
  }

  /**
   * The write also re-homes the row when the client has moved it.
   *
   * The move is a create *into* the target container as far as the rules are
   * concerned, so it answers to the same gate; leaving the source is
   * unconditional.
   */
  const previousGameId = existing.gameId
  const moved = previousGameId !== args.gameId
  if (moved) {
    await assertMayAddToContainer(ctx, args.gameId, userId)
    await ctx.db.patch(existing._id, { gameId: args.gameId })
  }

  await ctx.db.patch(existing._id, { body, updatedAt })

  // A link may not straddle two containers (ADR-037), so a move takes with
  // it only the links whose other end is already where it is going, and
  // drops the rest in the same mutation.
  if (moved) {
    const row = await ctx.db.get(existing._id)
    if (row !== null) {
      await pruneLinksAcrossContainers(ctx, row, previousGameId)
      if (kind !== null) {
        const crew = row as Doc<'pilots'> | Doc<'mechs'>
        // Moved off the shelf into a Game: the pilot's solo seat becomes its
        // seat there, mount and all when its mech is already there.
        if (kind === 'pilot' && previousGameId === null && crew.gameId !== null) {
          await handOffSoloSeat(ctx, crew as Doc<'pilots'>, crew.gameId)
        }
        // Moved out of a Game: a pilot's seat there goes, and a mech leaves
        // whoever was aboard it on foot (ADR-038). Off the shelf, a mech keeps
        // its solo boarder aboard so the pilot can follow it in.
        await releaseSeatsOf(ctx, kind, crew, previousGameId, { moved: true })
        // Moved into a Game: aboard its primary crawler (ADR-037).
        await assignToPrimary(ctx, kind, crew)
      }
    }
  }
  return { updatedAt }
}

/**
 * `removeByAppId`'s delete, shared with `transfer`. The row's links go with it
 * (`pruneLinksOfRow`), as they do on every remove path.
 */
export async function removeOwnable(
  ctx: MutationCtx,
  userId: Id<'users'>,
  table: OwnedTable,
  appId: string
): Promise<void> {
  const existing = await byAppId(ctx, table, appId)
  if (existing === null) return

  assertMayWrite(existing, userId)
  await ctx.db.delete(existing._id)
  // An NPC's crew link goes too, so the slot falls back to the book's line.
  await pruneLinksOfRow(ctx, existing)
  if (table === 'npcs') return
  await releaseSeatsOf(
    ctx,
    table === 'pilots' ? 'pilot' : 'mech',
    existing as Doc<'pilots'> | Doc<'mechs'>,
    existing.gameId
  )
}
