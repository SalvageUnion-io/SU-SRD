import { getAuthUserId } from '@convex-dev/auth/server'
import type { Infer } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import type { Doc, Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { callerIsAdmin, isAdmin, requireAdmin } from './model/admin'
import { mutation, parseBody } from './model/entities'
import type { LibrarySource } from './model/library'
import { deleteListing, entryFor, LIBRARY_TABLE, listedSource, sourceOf } from './model/library'
import type { LibraryKind } from './model/libraryTables'
import { libraryKind } from './model/libraryTables'
import { NotAuthorized, requireUser } from './model/permissions'

/**
 * The Homebrew library (ADR-053): a public gallery of the patterns and built
 * NPCs their makers chose to list.
 *
 * - **Opt-in, on top of the link.** Only a thing its maker already shares
 *   with "Anyone with the link" (ADR-032) can be listed, and listing is the
 *   maker's own act (`setListed`). Withdrawing the link delists it
 *   (`model/library.ts`).
 * - **Public browsing.** `list` is unauthenticated, like the public pages it
 *   leads to; copying one to your own Training Bay is a client write, as
 *   "Make a copy" on a pattern page always was.
 * - **Reports and takedown.** A signed-in reader may report a listing
 *   (`report`); a site admin (`model/admin.ts`) reads the reports
 *   (`moderation`) and hides a listing (`setHidden`), which its maker cannot
 *   undo by listing it again.
 */

/** The most listings one read returns, newest first: the gallery's whole page for now. */
export const LIBRARY_LIMIT = 240

/** A report's reason, at most this long once trimmed. */
export const REPORT_REASON_MAX = 500

/** One listing as the gallery draws it. */
const listing = v.object({
  kind: libraryKind,
  appId: v.string(),
  body: v.any(),
  madeBy: v.string(),
  listedAt: v.number(),
  /** The reader made it. */
  mine: v.boolean(),
})
type Listing = Infer<typeof listing>

/** The body, parsed as its table parses it, or null when the page could not draw it. */
function readableBody(kind: LibraryKind, row: LibrarySource): unknown {
  try {
    return parseBody(LIBRARY_TABLE[kind], row.body)
  } catch {
    // A body its own page cannot render is left out of the gallery rather
    // than drawn broken; its maker still has it, and its page says why.
    return null
  }
}

/** A listing, drawn from its live source: null when that is no longer listable. */
async function drawListing(
  ctx: QueryCtx,
  entry: Doc<'libraryEntries'>,
  userId: Id<'users'> | null
): Promise<Listing | null> {
  const row = await listedSource(ctx, entry)
  if (row === null) return null
  const body = readableBody(entry.kind, row)
  if (body === null) return null
  const maker = await ctx.db.get(entry.ownerId)
  return {
    kind: entry.kind,
    appId: entry.appId,
    body,
    madeBy: displayNameOf(maker, 'a player'),
    listedAt: entry.listedAt,
    mine: entry.ownerId === userId,
  }
}

/**
 * The library, newest first: every listing not hidden whose source is still
 * shared by link, of one kind or both.
 *
 * **Unauthenticated by design.** It serves only what anyone with the link
 * could already read, and names only the maker its pages already credit.
 */
export const list = query({
  args: { kind: v.optional(libraryKind) },
  returns: v.array(listing),
  handler: async (ctx, args): Promise<Listing[]> => {
    const userId = await getAuthUserId(ctx)
    const entries = await ctx.db
      .query('libraryEntries')
      .withIndex('by_hidden_listed', (q) => q.eq('hidden', false))
      .order('desc')
      .take(LIBRARY_LIMIT)
    const wanted = args.kind === undefined ? entries : entries.filter((e) => e.kind === args.kind)
    const drawn = await Promise.all(wanted.map((entry) => drawListing(ctx, entry, userId)))
    return drawn.filter((row) => row !== null)
  },
})

/** Where one thing stands in the library, as its page and its maker's Share dialog read it. */
const libraryStatus = v.object({
  /** In the gallery now. */
  listed: v.boolean(),
  /** Taken down by a site admin: told to its maker and admins only. */
  hidden: v.boolean(),
  /** The reader has reported it. */
  reported: v.boolean(),
  /** The reader made it. */
  mine: v.boolean(),
  /** The reader is a site admin. */
  admin: v.boolean(),
})
type LibraryStatus = Infer<typeof libraryStatus>

/** One thing's place in the library. Unauthenticated: a stranger learns only whether it is listed. */
export const status = query({
  args: { kind: libraryKind, appId: v.string() },
  returns: libraryStatus,
  handler: async (ctx, args): Promise<LibraryStatus> => {
    const userId = await getAuthUserId(ctx)
    const admin = userId !== null && (await isAdmin(ctx, userId))
    // The caller's own listing first: their Share toggle reads this.
    const own = userId === null ? null : await entryFor(ctx, args.kind, args.appId, userId)
    const entry = own ?? (await entryFor(ctx, args.kind, args.appId))
    if (entry === null) return { listed: false, hidden: false, reported: false, mine: false, admin }
    const live = (await listedSource(ctx, entry)) !== null
    const told = admin || entry.ownerId === userId
    const report =
      userId === null
        ? null
        : await ctx.db
            .query('libraryReports')
            .withIndex('by_entry_reporter', (q) =>
              q.eq('entryId', entry._id).eq('reporterId', userId)
            )
            .first()
    return {
      listed: live && !entry.hidden,
      hidden: told && entry.hidden,
      reported: report !== null,
      mine: entry.ownerId === userId,
      admin,
    }
  },
})

/** What a refusal calls each kind. */
const NOUN: Record<LibraryKind, string> = { pattern: 'pattern', npc: 'NPC' }

/**
 * List or delist one of the caller's own things.
 *
 * Listing needs it shared by link first, and parses its body, as going public
 * does (`publicSheet.setPublic`): a body the gallery cannot draw fails here,
 * where its maker is standing. A listing a site admin hid stays hidden.
 * Delisting is always allowed.
 */
export const setListed = mutation({
  args: { kind: libraryKind, appId: v.string(), listed: v.boolean() },
  handler: async (ctx, args): Promise<{ listed: boolean }> => {
    const userId = await requireUser(ctx)
    const noun = NOUN[args.kind]
    const row = await sourceOf(ctx, args.kind, userId, args.appId)
    if (row === null) throw new NotAuthorized(`That ${noun} no longer exists`)
    const entry = await entryFor(ctx, args.kind, args.appId, userId)

    if (!args.listed) {
      if (entry !== null && !entry.hidden) await deleteListing(ctx, entry)
      return { listed: false }
    }

    if (entry?.hidden) {
      throw new ConvexError(`A site admin took this ${noun} out of the Homebrew library.`)
    }
    if (row.publicRead !== true) {
      throw new ConvexError(
        `Share this ${noun} with anyone with the link first: the library lists only what anyone can open.`
      )
    }
    try {
      parseBody(LIBRARY_TABLE[args.kind], row.body)
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'unknown'
      throw new ConvexError(`This ${noun} cannot be listed: ${detail}`)
    }
    if (entry === null) {
      await ctx.db.insert('libraryEntries', {
        kind: args.kind,
        appId: args.appId,
        ownerId: userId,
        listedAt: Date.now(),
        hidden: false,
        reportCount: 0,
      })
    }
    return { listed: true }
  },
})

/** A listing a reader may report or a site admin may act on: listed, or (`hidden: true`) taken down. */
async function requireEntry(
  ctx: MutationCtx,
  kind: LibraryKind,
  appId: string
): Promise<Doc<'libraryEntries'>> {
  const entry = await entryFor(ctx, kind, appId)
  if (entry === null) throw new ConvexError(`That ${NOUN[kind]} is not in the Homebrew library`)
  return entry
}

/**
 * Report a listing to the site admins, with a reason. Signed in, and never
 * your own. One report per reader: reporting again replaces the reason.
 */
export const report = mutation({
  args: { kind: libraryKind, appId: v.string(), reason: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const entry = await requireEntry(ctx, args.kind, args.appId)
    if (entry.hidden || (await listedSource(ctx, entry)) === null) {
      throw new ConvexError(`That ${NOUN[args.kind]} is not in the Homebrew library`)
    }
    if (entry.ownerId === userId) throw new ConvexError('You cannot report your own homebrew')
    const reason = args.reason.trim()
    if (reason.length === 0) throw new ConvexError('Say what is wrong with it')
    if (reason.length > REPORT_REASON_MAX) {
      throw new ConvexError(`Keep the reason under ${REPORT_REASON_MAX} characters`)
    }

    const existing = await ctx.db
      .query('libraryReports')
      .withIndex('by_entry_reporter', (q) => q.eq('entryId', entry._id).eq('reporterId', userId))
      .first()
    if (existing !== null) {
      await ctx.db.patch(existing._id, { reason, at: Date.now() })
      return
    }
    await ctx.db.insert('libraryReports', {
      entryId: entry._id,
      reporterId: userId,
      reason,
      at: Date.now(),
    })
    await ctx.db.patch(entry._id, { reportCount: entry.reportCount + 1 })
  },
})

/** Delete a listing's reports and zero its count: a takedown or a dismissal settles them. */
async function settleReports(ctx: MutationCtx, entry: Doc<'libraryEntries'>) {
  const reports = await ctx.db
    .query('libraryReports')
    .withIndex('by_entry_reporter', (q) => q.eq('entryId', entry._id))
    .collect()
  for (const row of reports) await ctx.db.delete(row._id)
  await ctx.db.patch(entry._id, { reportCount: 0 })
}

/** Hide a listing from the library, or put it back. Site admins only. */
export const setHidden = mutation({
  args: { kind: libraryKind, appId: v.string(), hidden: v.boolean() },
  handler: async (ctx, args): Promise<{ hidden: boolean }> => {
    await requireAdmin(ctx)
    const entry = await requireEntry(ctx, args.kind, args.appId)
    if (args.hidden) {
      await settleReports(ctx, entry)
      await ctx.db.patch(entry._id, { hidden: true, hiddenAt: Date.now() })
    } else {
      await ctx.db.patch(entry._id, { hidden: false, hiddenAt: undefined })
    }
    return { hidden: args.hidden }
  },
})

/** Clear a listing's reports and leave it listed. Site admins only. */
export const dismissReports = mutation({
  args: { kind: libraryKind, appId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx)
    await settleReports(ctx, await requireEntry(ctx, args.kind, args.appId))
  },
})

/** The most reports one moderated listing carries back. */
const REASONS_SHOWN = 10

/** One listing as a site admin reviews it. */
const moderated = v.object({
  kind: libraryKind,
  appId: v.string(),
  name: v.string(),
  madeBy: v.string(),
  reportCount: v.number(),
  /** The newest reasons first. */
  reasons: v.array(v.string()),
  hiddenAt: v.union(v.number(), v.null()),
})
type Moderated = Infer<typeof moderated>

/** What a body calls itself. */
function nameOf(body: unknown): string {
  const name = (body as { name?: unknown } | null)?.name
  return typeof name === 'string' && name.trim().length > 0 ? name.trim() : 'Unnamed'
}

async function moderatedOf(ctx: QueryCtx, entry: Doc<'libraryEntries'>): Promise<Moderated> {
  const [row, maker, reports] = await Promise.all([
    sourceOf(ctx, entry.kind, entry.ownerId, entry.appId),
    ctx.db.get(entry.ownerId),
    ctx.db
      .query('libraryReports')
      .withIndex('by_entry_reporter', (q) => q.eq('entryId', entry._id))
      .take(100),
  ])
  return {
    kind: entry.kind,
    appId: entry.appId,
    name: nameOf(row?.body),
    madeBy: displayNameOf(maker, 'a player'),
    reportCount: entry.reportCount,
    reasons: reports
      .sort((a, b) => b.at - a.at)
      .slice(0, REASONS_SHOWN)
      .map((r) => r.reason),
    hiddenAt: entry.hiddenAt ?? null,
  }
}

/**
 * The site admin's queue: listings with open reports, most reported first,
 * and the listings taken down, newest first. Null for anyone else.
 */
export const moderation = query({
  args: {},
  returns: v.union(
    v.object({ reported: v.array(moderated), hidden: v.array(moderated) }),
    v.null()
  ),
  handler: async (ctx) => {
    if (!(await callerIsAdmin(ctx))) return null
    const reported = await ctx.db
      .query('libraryEntries')
      .withIndex('by_reported', (q) => q.eq('hidden', false).gt('reportCount', 0))
      .order('desc')
      .take(100)
    const hidden = await ctx.db
      .query('libraryEntries')
      .withIndex('by_hidden_listed', (q) => q.eq('hidden', true))
      .order('desc')
      .take(100)
    return {
      reported: await Promise.all(reported.map((entry) => moderatedOf(ctx, entry))),
      hidden: await Promise.all(hidden.map((entry) => moderatedOf(ctx, entry))),
    }
  },
})
