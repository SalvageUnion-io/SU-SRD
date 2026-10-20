import type { EntityTable } from 'game-domain/entityKinds'
import { parseShareSegment } from 'game-domain/shareAddress'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { oldestOf } from './entities'

/**
 * Compacts by public address: the last segment of a `/p/<kind>/<segment>` link
 * (`game-domain/shareAddress`), read on `by_app_id` like every app-id lookup.
 */

/** Compacts a short address's prefix can match before the lookup stops looking. */
const PREFIX_MATCH_CAP = 8

/**
 * The rows of `table` a public address segment names (`shareAddress`): those
 * whose `appId` begins with a short address's prefix, read as one indexed
 * range, or else those whose `appId` is the whole segment — a full app id, or
 * one that predates UUIDs. A prefix shared by two app ids is a 48-bit
 * coincidence; the caller resolves it as it resolves a duplicate app id, to
 * the oldest row.
 */
async function rowsByAddress(
  ctx: QueryCtx | MutationCtx,
  table: EntityTable | 'mechPatterns',
  segment: string
): Promise<Doc<EntityTable | 'mechPatterns'>[]> {
  const parsed = parseShareSegment(segment)
  if (parsed.kind === 'prefix') {
    const matches = await ctx.db
      .query(table)
      .withIndex('by_app_id', (q) =>
        q.gte('appId', parsed.prefix).lt('appId', `${parsed.prefix}\uffff`)
      )
      .take(PREFIX_MATCH_CAP)
    if (matches.length > 0) return matches as Doc<EntityTable | 'mechPatterns'>[]
  }
  return (await ctx.db
    .query(table)
    .withIndex('by_app_id', (q) => q.eq('appId', segment))
    .collect()) as Doc<EntityTable | 'mechPatterns'>[]
}

/**
 * The entity a public address segment names (`/p/<kind>/<segment>`): a short
 * address, a full app id or a legacy one, resolved to the oldest row as
 * `oldestByAppId` resolves a duplicate.
 */
export async function oldestByAddress(
  ctx: QueryCtx | MutationCtx,
  table: EntityTable,
  segment: string
): Promise<Doc<EntityTable> | null> {
  return oldestOf((await rowsByAddress(ctx, table, segment)) as Doc<EntityTable>[])
}

/** The mech pattern a public address segment names, as {@link oldestByAddress}. */
export async function patternByAddress(
  ctx: QueryCtx | MutationCtx,
  segment: string
): Promise<Doc<'mechPatterns'> | null> {
  return oldestOf((await rowsByAddress(ctx, 'mechPatterns', segment)) as Doc<'mechPatterns'>[])
}
