import { ConvexError, v } from 'convex/values'
import {
  completeJob as completeLedgerJob,
  dealCount,
  readLedger,
  removeFaction as removeLedgerFaction,
  removeJob as removeLedgerJob,
  setJobState as setLedgerJobState,
  upsertFaction,
  upsertJob,
} from 'game-domain/games/ledger'
import { isUpkeepStep, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import type { ScrapPool } from 'game-domain/schemas/crawler'
import type { Ledger } from 'game-domain/schemas/ledger'
import { FACTION_STANDINGS, LedgerSchema } from 'game-domain/schemas/ledger'
import { parseCrawlerTechLevel } from 'salvageunion-reference/rules'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'
import { query } from './_generated/server'
import { mutation, parseBody, primaryCrawlerOf } from './model/entities'
import { membershipOrNull, requireMediator } from './model/permissions'
import { loadReferenceData } from './model/referenceData'

/**
 * A Game's ledger (`game-domain/schemas/ledger`): its factions and jobs.
 *
 * Every member reads it, as they read the crew; only the Mediator writes it,
 * as they run the world the factions live in. What it pays goes into the
 * Game's primary crawler, which is the Mediator's too (ADR-038 §5).
 *
 * ## Each pay-out is claimed and paid in one write
 *
 * A finished job pays when it becomes done, and deal income pays once per
 * Downtime. Both mark the ledger and credit the crawler's Scrap pool in the
 * same mutation, so a second press, a second tab or a reload can never pay
 * twice, and a failure pays nothing and marks nothing.
 */

const LEDGER = v.object({
  factions: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      standing: v.union(...FACTION_STANDINGS.map((s) => v.literal(s))),
      deal: v.boolean(),
    })
  ),
  jobs: v.array(
    v.object({
      id: v.string(),
      name: v.string(),
      factionId: v.union(v.string(), v.null()),
      pay: v.number(),
      payTl: v.number(),
      state: v.union(v.literal('open'), v.literal('done'), v.literal('dropped')),
    })
  ),
  incomeCollectedFor: v.optional(v.number()),
})

const FACTION_ARGS = v.object({
  id: v.string(),
  name: v.string(),
  standing: v.union(...FACTION_STANDINGS.map((s) => v.literal(s))),
  deal: v.boolean(),
})

const JOB_TERMS = v.object({
  id: v.string(),
  name: v.string(),
  factionId: v.union(v.string(), v.null()),
  pay: v.number(),
  payTl: v.number(),
})

/** What a pay-out credited, and to which crawler. */
const PAID = v.object({
  scrap: v.number(),
  tl: v.number(),
  crawlerName: v.union(v.string(), v.null()),
})
type Paid = { scrap: number; tl: number; crawlerName: string | null }

/** The Game's ledger row, one at most. */
async function ledgerRow(ctx: QueryCtx | MutationCtx, gameId: Id<'games'>) {
  return await ctx.db
    .query('ledgers')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .first()
}

/** The Game's Downtime row, or null before its first Downtime. */
async function downtimeRow(ctx: QueryCtx | MutationCtx, gameId: Id<'games'>) {
  return await ctx.db
    .query('downtime')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .unique()
}

/** The Game's ledger, empty before its first write. */
async function ledgerOf(ctx: QueryCtx | MutationCtx, gameId: Id<'games'>): Promise<Ledger> {
  return readLedger((await ledgerRow(ctx, gameId))?.body)
}

/** Replace the Game's ledger, parsed: a name too long or a pay too high is refused here. */
async function writeLedger(ctx: MutationCtx, gameId: Id<'games'>, next: Ledger): Promise<void> {
  const parsed = LedgerSchema.safeParse(next)
  if (!parsed.success) {
    throw new ConvexError(`That does not fit the ledger: ${parsed.error.issues[0]?.message ?? ''}`)
  }
  const row = await ledgerRow(ctx, gameId)
  if (row === null) await ctx.db.insert('ledgers', { gameId, body: parsed.data })
  else await ctx.db.patch(row._id, { body: parsed.data })
}

/** An edit's answer, or a refusal naming what it was looking for. */
function found<T>(next: T | null, what: string): T {
  if (next === null) throw new ConvexError(`That ${what} is not in the ledger`)
  return next
}

/**
 * Credit `scrap` Scrap into the Game's primary crawler's pool: at `tl`, or at
 * the crawler's own Tech Level when `tl` is null. Refuses when the Game has no
 * crawler to pay into.
 */
async function creditCrawler(
  ctx: MutationCtx,
  gameId: Id<'games'>,
  scrap: number,
  tl: number | null
): Promise<Paid> {
  const crawler = await primaryCrawlerOf(ctx, gameId)
  if (crawler === null) throw new ConvexError('This Game has no crawler to pay into')
  const body = crawler.body as { name?: unknown; techLevel?: unknown; scrapPool?: ScrapPool }
  const at =
    tl ?? (typeof body.techLevel === 'string' ? parseCrawlerTechLevel(body.techLevel) : 1) ?? 1
  const crawlerName = typeof body.name === 'string' ? body.name : null
  if (scrap === 0) return { scrap, tl: at, crawlerName }
  const key = `tl${at}` as keyof ScrapPool
  const pool = { ...(body.scrapPool ?? {}) }
  pool[key] = (pool[key] ?? 0) + scrap
  await ctx.db.patch(crawler._id, {
    body: parseBody('crawlers', { ...body, scrapPool: pool }),
    updatedAt: Date.now(),
  })
  return { scrap, tl: at, crawlerName }
}

/**
 * The Game's ledger, for its members; null for anybody else. With it,
 * whether the running Downtime's deal income is collected (false with none
 * running).
 */
export const get = query({
  args: { gameId: v.id('games') },
  returns: v.union(v.object({ ...LEDGER.fields, incomeCollected: v.boolean() }), v.null()),
  handler: async (ctx, args) => {
    if ((await membershipOrNull(ctx, args.gameId)) === null) return null
    const ledger = await ledgerOf(ctx, args.gameId)
    const downtime = await downtimeRow(ctx, args.gameId)
    const incomeCollected =
      downtime !== null &&
      downtime.stepIndex !== null &&
      ledger.incomeCollectedFor === (downtime.startedAt ?? 0)
    return { ...ledger, incomeCollected }
  },
})

/** Add a faction, or rewrite the one with its id: its name, standing and deal. */
export const setFaction = mutation({
  args: { gameId: v.id('games'), faction: FACTION_ARGS },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const ledger = await ledgerOf(ctx, args.gameId)
    await writeLedger(ctx, args.gameId, upsertFaction(ledger, args.faction))
  },
})

/** Remove a faction. Its jobs stay, offered by nobody in particular. */
export const removeFaction = mutation({
  args: { gameId: v.id('games'), id: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const ledger = await ledgerOf(ctx, args.gameId)
    await writeLedger(ctx, args.gameId, found(removeLedgerFaction(ledger, args.id), 'faction'))
  },
})

/** Add a job, open, or rewrite the terms of the one with its id, keeping its state. */
export const setJob = mutation({
  args: { gameId: v.id('games'), job: JOB_TERMS },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const ledger = await ledgerOf(ctx, args.gameId)
    await writeLedger(ctx, args.gameId, upsertJob(ledger, args.job))
  },
})

/** Drop a job, or open a dropped one again. A done job has paid and stays done. */
export const setJobState = mutation({
  args: {
    gameId: v.id('games'),
    id: v.string(),
    state: v.union(v.literal('open'), v.literal('dropped')),
  },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const ledger = await ledgerOf(ctx, args.gameId)
    const next = setLedgerJobState(ledger, args.id, args.state)
    if (next === null && ledger.jobs.some((j) => j.id === args.id)) {
      throw new ConvexError('That job is done: it has paid')
    }
    await writeLedger(ctx, args.gameId, found(next, 'job'))
  },
})

/** Remove a job, whatever its state. What a done job paid stays paid. */
export const removeJob = mutation({
  args: { gameId: v.id('games'), id: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await requireMediator(ctx, args.gameId)
    const ledger = await ledgerOf(ctx, args.gameId)
    await writeLedger(ctx, args.gameId, found(removeLedgerJob(ledger, args.id), 'job'))
  },
})

/**
 * Finish an open job and pay it into the crawler: its pay, at its Tech Level.
 * Null when it is no longer open (done already, or dropped), so it pays once.
 */
export const completeJob = mutation({
  args: { gameId: v.id('games'), id: v.string() },
  returns: v.union(PAID, v.null()),
  handler: async (ctx, args): Promise<Paid | null> => {
    await requireMediator(ctx, args.gameId)
    const ledger = await ledgerOf(ctx, args.gameId)
    found(ledger.jobs.find((j) => j.id === args.id) ?? null, 'job')
    const done = completeLedgerJob(ledger, args.id)
    if (done === null) return null
    const paid = await creditCrawler(ctx, args.gameId, done.job.pay, done.job.payTl)
    await writeLedger(ctx, args.gameId, done.ledger)
    return paid
  },
})

/**
 * Collect this Downtime's deal income: 1 Scrap of the crawler's Tech Level for
 * each faction the crew has a deal with (Reclamation of the Wastes p.7). In
 * the Upkeep & Upgrade step, beside the Upkeep it offsets, and once per
 * Downtime: null when this one's is already collected.
 */
export const collectIncome = mutation({
  args: { gameId: v.id('games') },
  returns: v.union(PAID, v.null()),
  handler: async (ctx, args): Promise<Paid | null> => {
    await requireMediator(ctx, args.gameId)
    const downtime = await downtimeRow(ctx, args.gameId)
    if (downtime === null || downtime.stepIndex === null) {
      throw new ConvexError('Downtime is not running')
    }
    loadReferenceData()
    if (!isUpkeepStep(downtime.stepIndex)) {
      throw new ConvexError(`Deal income is collected in the ${UPKEEP_STEP_NAME} step`)
    }
    // `startedAt` names this Downtime: a fresh one has its own.
    const thisDowntime = downtime.startedAt ?? 0
    const ledger = await ledgerOf(ctx, args.gameId)
    if (ledger.incomeCollectedFor === thisDowntime) return null
    const scrap = dealCount(ledger)
    if (scrap === 0) throw new ConvexError('The crew has no deals to collect from')
    const paid = await creditCrawler(ctx, args.gameId, scrap, null)
    await writeLedger(ctx, args.gameId, { ...ledger, incomeCollectedFor: thisDowntime })
    return paid
  },
})
