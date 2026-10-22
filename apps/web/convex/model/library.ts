import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { LibraryKind } from './libraryTables'

/**
 * The Homebrew library's shared reads and its one invariant (ADR-056).
 *
 * **A listing is only ever as public as its source.** The library lists what
 * its maker already shares by link (`publicRead`), so every read checks the
 * source row again (`listedSource`), and the triggers in `model/entities.ts`
 * call `withdrawListing` when the link is withdrawn or the thing is deleted:
 * however the link goes (Only me, a move, an account deletion), the listing
 * goes with it. A hidden listing outlives a withdrawn link, so a takedown
 * cannot be undone by relisting.
 */

type AnyCtx = QueryCtx | MutationCtx

/** The source row a listing names. */
export type LibrarySource = Doc<'mechPatterns'> | Doc<'npcs'>

/** The table each listed kind lives in. */
export const LIBRARY_TABLE = { pattern: 'mechPatterns', npc: 'npcs' } as const

/**
 * The listing of a thing, or null. Given its maker, only that maker's: two
 * accounts can hold rows under one app id, and one maker's listing, delisting
 * or deletion never reaches the other's. Without one (a reader's view, which
 * knows only the app id), the oldest.
 */
export async function entryFor(
  ctx: AnyCtx,
  kind: LibraryKind,
  appId: string,
  ownerId?: Id<'users'>
): Promise<Doc<'libraryEntries'> | null> {
  const entries = ctx.db
    .query('libraryEntries')
    .withIndex('by_kind_app_id', (q) => q.eq('kind', kind).eq('appId', appId))
  if (ownerId === undefined) return await entries.first()
  return (await entries.take(16)).find((entry) => entry.ownerId === ownerId) ?? null
}

/**
 * The maker's own row behind a listing, or null. A pattern by its maker and
 * app id (`by_owner_app_id`); an NPC by its app id, the oldest of the maker's
 * rows on a duplicate, so another account's row with the same id never stands
 * in for it.
 */
export async function sourceOf(
  ctx: AnyCtx,
  kind: LibraryKind,
  ownerId: Id<'users'>,
  appId: string
): Promise<LibrarySource | null> {
  if (kind === 'pattern') {
    return await ctx.db
      .query('mechPatterns')
      .withIndex('by_owner_app_id', (q) => q.eq('ownerId', ownerId).eq('appId', appId))
      .first()
  }
  const rows = await ctx.db
    .query('npcs')
    .withIndex('by_app_id', (q) => q.eq('appId', appId))
    .take(16)
  return rows.find((row) => row.ownerId === ownerId) ?? null
}

/** The source of a listing that may be shown: still its maker's and still shared by link. */
export async function listedSource(
  ctx: AnyCtx,
  entry: Doc<'libraryEntries'>
): Promise<LibrarySource | null> {
  const row = await sourceOf(ctx, entry.kind, entry.ownerId, entry.appId)
  return row !== null && row.publicRead === true ? row : null
}

/** Delete a listing and every report of it. */
export async function deleteListing(ctx: MutationCtx, entry: Doc<'libraryEntries'>) {
  const reports = await ctx.db
    .query('libraryReports')
    .withIndex('by_entry_reporter', (q) => q.eq('entryId', entry._id))
    .collect()
  for (const report of reports) await ctx.db.delete(report._id)
  await ctx.db.delete(entry._id)
}

/**
 * Take a maker's thing out of the library when its link is withdrawn
 * (`gone: false`) or the thing is deleted (`gone: true`). A hidden listing
 * survives the first, so the takedown stands if the link comes back.
 */
export async function withdrawListing(
  ctx: MutationCtx,
  kind: LibraryKind,
  source: { appId?: string; ownerId?: Id<'users'> | null },
  { gone }: { gone: boolean }
) {
  if (source.appId === undefined || source.ownerId == null) return
  const entry = await entryFor(ctx, kind, source.appId, source.ownerId)
  if (entry === null) return
  if (entry.hidden && !gone) return
  await deleteListing(ctx, entry)
}

/** The row went from shared by link to not, or away: what a trigger hands `withdrawListing`. */
export function linkWithdrawn(
  oldDoc: { publicRead?: boolean } | null,
  newDoc: { publicRead?: boolean } | null
): boolean {
  return oldDoc?.publicRead === true && newDoc?.publicRead !== true
}

/** Delete every report one account made, each listing's count with it: the account is going. */
export async function deleteReportsBy(ctx: MutationCtx, reporterId: Id<'users'>) {
  const reports = await ctx.db
    .query('libraryReports')
    .withIndex('by_reporter', (q) => q.eq('reporterId', reporterId))
    .collect()
  for (const report of reports) {
    await ctx.db.delete(report._id)
    const entry = await ctx.db.get(report.entryId)
    if (entry !== null && entry.reportCount > 0) {
      await ctx.db.patch(entry._id, { reportCount: entry.reportCount - 1 })
    }
  }
}
