import { getAuthUserId } from '@convex-dev/auth/server'
import type { Infer } from 'convex/values'
import { ConvexError, v } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { displayNameOf } from './account'
import { patternByAddress } from './model/addresses'
import { callerIsAdmin, isAdmin, requireAdmin } from './model/admin'
import { mutation } from './model/entities'
import { deletePatternReports, moderationOf } from './model/homebrew'
import { NotAuthorized, requireUser } from './model/permissions'

/**
 * Homebrew (ADR-061): the players' own mech patterns, on the SRD beside the
 * book's.
 *
 * - **Two opt-ins.** A pattern is homebrew when its maker shares it with
 *   "Anyone with the link" (ADR-032) and then also with everyone on the
 *   Reference (`setShared`). Withdrawing the link takes it off at once.
 * - **Read with no account.** The SRD's listing is the Worker's, from the
 *   shared database (`src/worker/shared/homebrew.ts`).
 * - **Reports and takedown.** A signed-in reader may report a pattern
 *   (`report`); a site admin (`model/admin.ts`) reads the reports
 *   (`moderation`) and hides one (`setHidden`), which sharing it again does
 *   not undo.
 */

/** A report's reason, at most this long once trimmed. */
export const REPORT_REASON_MAX = 500

/** Shared by link and on the Reference: homebrew, unless an admin hid it. */
function isHomebrew(row: Doc<'mechPatterns'>): boolean {
  return row.publicRead === true && row.homebrew === true
}

/** Where one pattern stands as homebrew, as its page reads it. */
const homebrewStatus = v.object({
  /** On the SRD now: shared by link and on the Reference, and not hidden. */
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
type HomebrewStatus = Infer<typeof homebrewStatus>

/** One pattern's place in Homebrew, by its page's address. */
export const status = query({
  args: { appId: v.string() },
  returns: homebrewStatus,
  handler: async (ctx, args): Promise<HomebrewStatus> => {
    const userId = await getAuthUserId(ctx)
    const admin = userId !== null && (await isAdmin(ctx, userId))
    const row = await patternByAddress(ctx, args.appId)
    if (row === null || !isHomebrew(row)) {
      return { listed: false, hidden: false, reported: false, mine: false, admin }
    }
    const mine = row.ownerId === userId
    const moderation = await moderationOf(ctx, row._id)
    const hidden = moderation?.hidden === true
    const report =
      userId === null
        ? null
        : await ctx.db
            .query('homebrewReports')
            .withIndex('by_pattern_reporter', (q) =>
              q.eq('patternId', row._id).eq('reporterId', userId)
            )
            .first()
    return {
      listed: !hidden,
      hidden: hidden && (admin || mine),
      reported: report !== null,
      mine,
      admin,
    }
  },
})

/**
 * Share one of the caller's own patterns with everyone on the Reference, or
 * stop. Only while it is shared by link: the link is the first opt-in.
 */
export const setShared = mutation({
  args: { patternId: v.string(), shared: v.boolean() },
  handler: async (ctx, args): Promise<{ shared: boolean }> => {
    const userId = await requireUser(ctx)
    const row = await ctx.db
      .query('mechPatterns')
      .withIndex('by_owner_app_id', (q) => q.eq('ownerId', userId).eq('appId', args.patternId))
      .first()
    if (row === null) throw new NotAuthorized('That pattern no longer exists')
    if (args.shared && row.publicRead !== true) {
      throw new ConvexError('Share it with anyone with the link first')
    }
    await ctx.db.patch(row._id, { homebrew: args.shared ? true : undefined })
    return { shared: args.shared }
  },
})

/** A homebrew pattern by its page's address, or a refusal. */
async function requireShared(ctx: MutationCtx, appId: string): Promise<Doc<'mechPatterns'>> {
  const row = await patternByAddress(ctx, appId)
  if (row === null || !isHomebrew(row)) {
    throw new ConvexError('That pattern is not shared as homebrew')
  }
  return row
}

/** A pattern's moderation row, written on first use. */
async function ensureModeration(
  ctx: MutationCtx,
  row: Doc<'mechPatterns'>
): Promise<Doc<'homebrewModeration'>> {
  const existing = await moderationOf(ctx, row._id)
  if (existing !== null) return existing
  const id = await ctx.db.insert('homebrewModeration', {
    patternId: row._id,
    hidden: false,
    reportCount: 0,
  })
  const created = await ctx.db.get(id)
  if (created === null) throw new ConvexError('That did not save')
  return created
}

/**
 * Report a homebrew pattern to the site admins, with a reason. Signed in,
 * and never your own. One report per reader: reporting again replaces the
 * reason.
 */
export const report = mutation({
  args: { appId: v.string(), reason: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await requireUser(ctx)
    const row = await requireShared(ctx, args.appId)
    if (row.ownerId === userId) throw new ConvexError('You cannot report your own homebrew')
    const reason = args.reason.trim()
    if (reason.length === 0) throw new ConvexError('Say what is wrong with it')
    if (reason.length > REPORT_REASON_MAX) {
      throw new ConvexError(`Keep the reason under ${REPORT_REASON_MAX} characters`)
    }

    const existing = await ctx.db
      .query('homebrewReports')
      .withIndex('by_pattern_reporter', (q) => q.eq('patternId', row._id).eq('reporterId', userId))
      .first()
    if (existing !== null) {
      await ctx.db.patch(existing._id, { reason, at: Date.now() })
      return
    }
    await ctx.db.insert('homebrewReports', {
      patternId: row._id,
      reporterId: userId,
      reason,
      at: Date.now(),
    })
    const moderation = await ensureModeration(ctx, row)
    await ctx.db.patch(moderation._id, { reportCount: moderation.reportCount + 1 })
  },
})

/** Hide a pattern from Homebrew, or put it back. Site admins only; hiding settles its reports. */
export const setHidden = mutation({
  args: { appId: v.string(), hidden: v.boolean() },
  handler: async (ctx, args): Promise<{ hidden: boolean }> => {
    await requireAdmin(ctx)
    const row = await patternByAddress(ctx, args.appId)
    if (row === null) throw new ConvexError('That pattern no longer exists')
    if (args.hidden) {
      await deletePatternReports(ctx, row._id, { all: false })
      const moderation = await ensureModeration(ctx, row)
      await ctx.db.patch(moderation._id, { hidden: true, hiddenAt: Date.now() })
    } else {
      const moderation = await moderationOf(ctx, row._id)
      if (moderation !== null) {
        await ctx.db.patch(moderation._id, { hidden: false, hiddenAt: undefined })
      }
    }
    return { hidden: args.hidden }
  },
})

/** Clear a pattern's reports and leave it shown. Site admins only. */
export const dismissReports = mutation({
  args: { appId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await requireAdmin(ctx)
    const row = await patternByAddress(ctx, args.appId)
    if (row !== null) await deletePatternReports(ctx, row._id, { all: false })
  },
})

/** The most reasons one moderated pattern carries back. */
const REASONS_SHOWN = 10

/** One pattern as a site admin reviews it. */
const moderated = v.object({
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

async function moderatedOf(
  ctx: QueryCtx,
  moderation: Doc<'homebrewModeration'>
): Promise<Moderated | null> {
  const row = await ctx.db.get(moderation.patternId)
  if (row === null) return null
  const [maker, reports] = await Promise.all([
    ctx.db.get(row.ownerId),
    ctx.db
      .query('homebrewReports')
      .withIndex('by_pattern_reporter', (q) => q.eq('patternId', row._id))
      .take(100),
  ])
  return {
    appId: row.appId,
    name: nameOf(row.body),
    madeBy: displayNameOf(maker, 'a player'),
    reportCount: moderation.reportCount,
    reasons: reports
      .sort((a, b) => b.at - a.at)
      .slice(0, REASONS_SHOWN)
      .map((r) => r.reason),
    hiddenAt: moderation.hiddenAt ?? null,
  }
}

/**
 * The site admin's queue: patterns with open reports, most reported first,
 * and the patterns taken down, newest first. Null for anyone else.
 */
export const moderation = query({
  args: {},
  returns: v.union(
    v.object({ reported: v.array(moderated), hidden: v.array(moderated) }),
    v.null()
  ),
  handler: async (ctx) => {
    if (!(await callerIsAdmin(ctx))) return null
    const [reported, hidden] = await Promise.all([
      ctx.db
        .query('homebrewModeration')
        .withIndex('by_reported', (q) => q.eq('hidden', false).gt('reportCount', 0))
        .order('desc')
        .take(100),
      ctx.db
        .query('homebrewModeration')
        .withIndex('by_hidden', (q) => q.eq('hidden', true))
        .order('desc')
        .take(100),
    ])
    const drawn = async (rows: Doc<'homebrewModeration'>[]) =>
      (await Promise.all(rows.map((row) => moderatedOf(ctx, row)))).filter((row) => row !== null)
    return { reported: await drawn(reported), hidden: await drawn(hidden) }
  },
})
