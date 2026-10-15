import { CROSS_CONTAINER_REFUSAL, isSlotted } from 'cantina-domain/links/linkRules'
import type { SoftLink } from 'cantina-domain/schemas/softLink'
import type { ObjectType } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { crewSlot, entityRef, softLinkType } from '../schema'
import type { OwnedTable } from './entities'
import { findSoftLink, resolveLinkEnd, sameContainerRows, writeSoftLink } from './entities'
import { assertMayWrite, byAppId } from './ownableWrites'
import { getMembership, isTableRunner, NotAuthorized, requireUser } from './permissions'

/**
 * The soft-link writes behind `entities.ts` (ADR-037, ADR-044): which table a
 * link's anchor lives in, who may draw or delete a crew link, and the unwire
 * `transfer` shares with `removeSoftLink`. The public mutations live in
 * `entities.ts`.
 */

/** A soft link, addressed by its endpoints (and, for crew, its slot). */
export const LINK = {
  from: entityRef,
  to: entityRef,
  type: softLinkType,
  slot: v.optional(crewSlot),
}

/**
 * Which ownable table a link's `from` endpoint lives in.
 *
 * The `from` end is always ownable — a mech in `mech-to-pilot` and
 * `mech-to-crawler`, a pilot in `pilot-to-crawler` — which is what lets one
 * lookup answer both questions a link write has to ask: may this user draw the
 * link, and which container does it belong to.
 */
export const SOFT_LINK_FROM_TABLE: Record<SoftLink['type'], OwnedTable> = {
  'mech-to-pilot': 'mechs',
  'pilot-to-crawler': 'pilots',
  'mech-to-crawler': 'mechs',
  'npc-to-crawler': 'npcs',
}

/**
 * A crew slot names the slot it fills, and only a crew link has one. The client
 * builds both from `CrewSlotSchema`'s refinement, so a mismatch is a defect,
 * not a player's mistake.
 */
export function assertSlotMatchesType(args: ObjectType<typeof LINK>): void {
  const slotted = isSlotted(args.type)
  if (slotted && args.slot === undefined) {
    throw new Error('An npc-to-crawler link names the crew slot it fills')
  }
  if (!slotted && args.slot !== undefined) {
    throw new Error(`A ${args.type} link has no crew slot`)
  }
}

/** The copy a player sees when they may not assign or unassign this crawler's crew. */
const CREW_REFUSAL =
  'Only whoever runs the table assigns crawler crew — design an NPC on your shelf and move it into this Game to offer it.'

/**
 * Who may draw or delete an `npc-to-crawler` link: whoever may write the
 * crawler (ADR-044) — its owner on a shelf, the table runner in a Game. The one
 * link authorised by its `to` end, because in a Game the NPC is often a
 * player's while the crawler is the Mediator's.
 */
async function assertMayCrew(ctx: MutationCtx, crawler: Doc<'crawlers'>): Promise<void> {
  const userId = await requireUser(ctx)
  if (crawler.gameId === null) {
    if (crawler.ownerId !== userId) throw new NotAuthorized(CREW_REFUSAL)
    return
  }
  const membership = await getMembership(ctx, crawler.gameId, userId)
  if (membership === null || !(await isTableRunner(ctx, crawler.gameId, membership))) {
    throw new NotAuthorized(CREW_REFUSAL)
  }
}

/** Whether a crawler body has the slot: the bay installed, or a type chosen. */
function crawlerHasSlot(body: unknown, slot: NonNullable<ObjectType<typeof LINK>['slot']>) {
  const crawler = (body ?? {}) as { type?: unknown; crawlerBays?: unknown }
  if (slot.kind === 'type') return typeof crawler.type === 'string' && crawler.type.length > 0
  return (
    Array.isArray(crawler.crawlerBays) &&
    crawler.crawlerBays.some((bay) => (bay as { bayRef?: unknown })?.bayRef === slot.bayRef)
  )
}

/**
 * Draw an `npc-to-crawler` link (ADR-044). The NPC and the crawler share a
 * container, the caller may write the crawler, and the crawler has the slot.
 * Drawing it replaces the NPC's old slot and whoever filled this one, in this
 * same mutation (`writeSoftLink`). Neither end's body is written: the
 * crawler's inline crew stays exactly as it was, so unlinking restores it.
 */
export async function drawCrewLink(ctx: MutationCtx, args: ObjectType<typeof LINK>): Promise<void> {
  const npc = await byAppId(ctx, 'npcs', args.from.id)
  if (npc === null) return
  const target = await resolveLinkEnd(ctx, args.to, npc.gameId)
  if (target === null) return
  const crawler = target as Doc<'crawlers'>
  await assertMayCrew(ctx, crawler)
  if (!sameContainerRows(npc, crawler)) throw new ConvexError(CROSS_CONTAINER_REFUSAL)
  if (args.slot === undefined || !crawlerHasSlot(crawler.body, args.slot)) {
    throw new ConvexError('That crawler has no such crew slot.')
  }
  await writeSoftLink(ctx, args, crawler.gameId)
}

/**
 * Delete an `npc-to-crawler` link: the crawler's writer only, as drawing it is.
 * When the crawler is gone the link is a stale pointer, and the NPC's owner
 * may clear it.
 */
async function unwireCrewLink(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof LINK>
): Promise<void> {
  const existing = await findSoftLink(ctx, args.from.id, args.to.id, args.type)
  if (existing === null) return
  const crawler = await resolveLinkEnd(ctx, args.to, existing.gameId)
  if (crawler === null) {
    const npc = await byAppId(ctx, 'npcs', args.from.id)
    if (npc !== null) assertMayWrite(npc, userId)
  } else {
    await assertMayCrew(ctx, crawler as Doc<'crawlers'>)
  }
  await ctx.db.delete(existing._id)
}

/** `removeSoftLink`'s delete, shared with `transfer`. */
export async function unwireSoftLink(
  ctx: MutationCtx,
  userId: Id<'users'>,
  args: ObjectType<typeof LINK>
): Promise<void> {
  if (isSlotted(args.type)) {
    await unwireCrewLink(ctx, userId, args)
    return
  }
  const anchor = await byAppId(ctx, SOFT_LINK_FROM_TABLE[args.type], args.from.id)
  if (anchor === null) return
  assertMayWrite(anchor, userId)

  const existing = await findSoftLink(ctx, args.from.id, args.to.id, args.type)
  if (existing === null) return

  await ctx.db.delete(existing._id)
}
