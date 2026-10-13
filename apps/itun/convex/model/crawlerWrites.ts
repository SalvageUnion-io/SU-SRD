import type { ObjectType } from 'convex/values'
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import {
  crawlerEnteredGame,
  crawlerLeftGame,
  parseBody,
  pruneLinksAcrossContainers,
  pruneLinksOfRow,
  unsetCrawlerFields,
} from './entities'
import { NotAuthorized, requireTableRunner, requireUser } from './permissions'

/**
 * The crawler writes behind `entities.ts`: the field-level patch, the scrap and
 * the move between a Game and a shelf (ADR-030 §5, ADR-038 §5). The public
 * mutations live in `entities.ts`; this module is their helpers, so `transfer`
 * runs the same writes as `patchCrawlerByAppId`, `moveCrawler` and
 * `removeCrawlerByAppId`.
 */

/** A crawler field patch, addressed by app id (`patchCrawlerByAppId`). */
export const CRAWLER_PATCH = {
  appId: v.string(),
  patch: v.any(),
  unset: v.optional(v.array(v.string())),
}

/**
 * Who may write a crawler's body — it depends on which container holds it.
 *
 * In a Game the crawler is the Mediator's (ADR-038 §5): Salvage,
 * Craft, Trade, Upkeep, Upgrade, damage and Scrap a mech are all theirs, and a
 * player asks at the table. While a Game has no Mediator the Organizer holds
 * it, as they hold raising and scrapping one (`requireTableRunner`), so a
 * crawler is never left with nobody to keep it.
 * On a shelf it is an ordinary owned entity and only its owner may touch it.
 *
 * Split out from the two call sites rather than inlined at each, because a
 * container-dependent rule written twice is a rule that will eventually be
 * written two different ways.
 */
async function assertMayEditCrawler(ctx: MutationCtx, doc: Doc<'crawlers'>): Promise<void> {
  if (doc.gameId !== null) {
    await requireTableRunner(ctx, doc.gameId)
    return
  }
  const userId = await requireUser(ctx)
  if (doc.ownerId !== userId) {
    throw new NotAuthorized("You cannot edit another player's crawler")
  }
}

/**
 * Who may scrap a crawler — the same people who may edit one
 * (`assertMayEditCrawler`), kept separate only for its refusal message.
 *
 * In a Game it is the **table runner's** act, as every write to the crawler is
 * (ADR-038 §5); no other member edits or scraps it. On a shelf the owner
 * decides, exactly as they do for their own pilots and mechs.
 */
export async function assertMayScrapCrawler(ctx: MutationCtx, doc: Doc<'crawlers'>): Promise<void> {
  if (doc.gameId !== null) {
    await requireTableRunner(ctx, doc.gameId)
    return
  }
  const userId = await requireUser(ctx)
  if (doc.ownerId !== userId) {
    throw new NotAuthorized("You cannot scrap another player's crawler")
  }
}

/**
 * Look a crawler up by the app-level UUID the client holds.
 *
 * Tolerant of duplicates for exactly the reasons `byAppId` is: `by_app_id` is
 * not a uniqueness constraint, and `.unique()` would turn a duplicate into a
 * thrown error on every write, locking the player out of their own crawler
 * over a row they cannot see. So this resolves the oldest row, warns, and lets
 * the write land. The crawler has no duplicates in production today, and that
 * is luck rather than a constraint: nothing in the index stops a second row.
 */
async function crawlerByAppId(ctx: MutationCtx, appId: string): Promise<Doc<'crawlers'> | null> {
  const matches = await ctx.db
    .query('crawlers')
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()

  if (matches.length === 0) return null
  if (matches.length === 1) return matches[0] ?? null

  console.warn(
    `[itun] ${matches.length} crawlers share appId="${appId}" — resolving to the oldest; this game needs de-duplicating`
  )

  return matches.reduce((oldest, row) => (row._creationTime < oldest._creationTime ? row : oldest))
}

/** `patchCrawlerByAppId`'s write, shared with `transfer`. */
export async function patchCrawler(
  ctx: MutationCtx,
  args: ObjectType<typeof CRAWLER_PATCH>
): Promise<void> {
  const existing = await crawlerByAppId(ctx, args.appId)
  if (existing === null) return

  await assertMayEditCrawler(ctx, existing)

  // A field patch never moves a crawler. Its container is the row's column
  // and the body's `gameId` together, and only `moveCrawler` writes them — a
  // body-only `gameId` here would leave a "moved" crawler put on the server
  // while every client read it somewhere else. The same goes for `unset`: clearing `gameId` would split the body from the column.
  const { gameId: _container, ...fields } = (args.patch ?? {}) as Record<string, unknown>
  const merged = unsetCrawlerFields(
    { ...(existing.body as Record<string, unknown>), ...fields },
    (args.unset ?? []).filter((key) => key !== 'gameId')
  )
  const body = parseBody('crawlers', merged)

  await ctx.db.patch(existing._id, { body, updatedAt: Date.now() })
}

/** `removeCrawlerByAppId`'s delete, shared with `transfer`. */
export async function removeCrawlerRow(ctx: MutationCtx, appId: string): Promise<void> {
  const existing = await crawlerByAppId(ctx, appId)
  if (existing === null) return

  await assertMayScrapCrawler(ctx, existing)
  await ctx.db.delete(existing._id)
  await pruneLinksOfRow(ctx, existing)
  if (existing.gameId !== null) await crawlerLeftGame(ctx, existing.gameId, existing._id)
}

/** `moveCrawler`'s write, shared with `transfer`. */
export async function moveCrawlerRow(
  ctx: MutationCtx,
  userId: Id<'users'>,
  appId: string,
  to: Id<'games'> | null
): Promise<void> {
  const existing = await crawlerByAppId(ctx, appId)
  if (existing === null) return
  const from = existing.gameId
  if (from === to) return

  if (from !== null && to !== null) {
    throw new NotAuthorized(
      'Move the crawler to your shelf first, then into the other Game — a crawler changes tables one step at a time'
    )
  }
  if (from === null) {
    if (existing.ownerId !== userId) {
      throw new NotAuthorized("You cannot move another player's crawler")
    }
    await requireTableRunner(ctx, to as Id<'games'>)
  } else {
    await requireTableRunner(ctx, from)
  }

  const body = parseBody('crawlers', {
    ...(existing.body as Record<string, unknown>),
    gameId: to,
  })
  await ctx.db.patch(existing._id, {
    gameId: to,
    ownerId: to === null ? userId : null,
    body,
    updatedAt: Date.now(),
  })

  const row = await ctx.db.get(existing._id)
  if (row === null) return
  await pruneLinksAcrossContainers(ctx, row, from)
  if (from !== null) await crawlerLeftGame(ctx, from, row._id)
  if (to !== null) await crawlerEnteredGame(ctx, row)
}
