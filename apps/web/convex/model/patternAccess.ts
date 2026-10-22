import type { Infer } from 'convex/values'
import { v } from 'convex/values'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { oldestOf } from './entities'

/**
 * Shared mech patterns: who may read one (ADR-032 §7) and the build count its
 * page shows. Split from `model/entities.ts`, which keeps the entity writes.
 */

/**
 * Who may read a saved pattern: its maker's choice of three, held in the
 * `publicRead` and `gameId` columns (see `mechPatterns` in `schema.ts`).
 */
export const patternVisibility = v.union(v.literal('private'), v.literal('link'), v.literal('game'))
export type PatternVisibility = Infer<typeof patternVisibility>

/** The visibility a pattern row's columns encode. */
export function patternVisibilityOf(row: Doc<'mechPatterns'>): PatternVisibility {
  if (row.publicRead === true) return 'link'
  if (row.gameId !== null) return 'game'
  return 'private'
}

/**
 * One pattern by the id inside its body, whoever made it — the pattern page's
 * address. A duplicate resolves to the oldest row, as in `oldestByAppId`.
 */
async function patternByAppId(
  ctx: QueryCtx | MutationCtx,
  appId: string
): Promise<Doc<'mechPatterns'> | null> {
  const rows = await ctx.db
    .query('mechPatterns')
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .collect()
  return oldestOf(rows)
}

/**
 * Whether `userId` (null: nobody is signed in) may read this pattern: its
 * maker always; anyone at all when it is shared by link (ADR-032's opt-in);
 * a member of its Game when it is shared with the crew. Nobody else — and the
 * caller answers "no" exactly as it answers "no such pattern".
 */
export async function mayReadPattern(
  ctx: QueryCtx | MutationCtx,
  row: Doc<'mechPatterns'>,
  userId: Id<'users'> | null
): Promise<boolean> {
  if (row.publicRead === true) return true
  if (userId === null) return false
  if (row.ownerId === userId) return true
  const gameId = row.gameId
  if (gameId === null) return false
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', userId))
    .unique()
  return membership !== null
}

/**
 * Count a mech built from a pattern, in the same mutation that creates it.
 *
 * Read from the new mech's `body.sourcePattern`. Only a pattern the builder may
 * read is counted, so a forged id cannot inflate a stranger's private pattern,
 * and a missing one (deleted since) is simply not counted.
 */
export async function countPatternBuild(
  ctx: MutationCtx,
  body: unknown,
  userId: Id<'users'>
): Promise<void> {
  const source = (body as { sourcePattern?: unknown } | null)?.sourcePattern
  if (typeof source !== 'string') return
  const row = await patternByAppId(ctx, source)
  if (row === null || !(await mayReadPattern(ctx, row, userId))) return
  await ctx.db.patch(row._id, { builtCount: (row.builtCount ?? 0) + 1 })
}
