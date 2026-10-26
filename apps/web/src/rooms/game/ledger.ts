import type { JobTerms } from 'game-domain/games/ledger'
import {
  completeJob,
  dealCount,
  readLedger,
  removeFaction,
  removeJob,
  setJobState,
  upsertFaction,
  upsertJob,
} from 'game-domain/games/ledger'
import { isUpkeepStep, UPKEEP_STEP_NAME } from 'game-domain/rules/downtime'
import type { ScrapPool } from 'game-domain/schemas/crawler'
import type { Faction, Ledger } from 'game-domain/schemas/ledger'
import { LedgerSchema } from 'game-domain/schemas/ledger'
import { parseCrawlerTechLevel } from 'salvageunion-reference/rules'
import { RoomRefusal } from '../refusal'
import type { GamePlay } from './play'
import type { GameStore } from './store'
import { fromJson } from './store'
import type { GameUnits } from './units'
import { BatchRefused, LEDGER_SOURCE } from './units'

/**
 * A Game's ledger, its factions and jobs, with its rules:
 * every member reads it, only the Mediator writes it, and what it pays goes
 * into the primary crawler (ADR-038 §5).
 *
 * A pay-out marks the ledger and credits the crawler in one transaction, so a
 * second press or a second tab never pays twice. The credit is an op on the
 * crawler from `LEDGER_SOURCE`, a source no client may send (`units.ts`).
 */

export type LedgerRead = Ledger & { incomeCollected: boolean }

/** What a pay-out credited, and to which crawler. */
export type Paid = { scrap: number; tl: number; crawlerName: string | null }

export class GameLedger {
  constructor(
    private readonly store: GameStore,
    private readonly units: GameUnits,
    private readonly play: GamePlay,
    private readonly newId: () => string
  ) {}

  /** The ledger for a member, and whether the running Downtime's deal income is collected; null for anybody else. */
  ledger(actor: string): LedgerRead | null {
    if (this.store.member(actor) === null) return null
    const ledger = this.read()
    const downtime = this.play.downtime(actor)
    const incomeCollected =
      downtime?.running === true && ledger.incomeCollectedFor === (downtime.startedAt ?? 0)
    return { ...ledger, incomeCollected }
  }

  /** Add a faction, or rewrite the one with its id. */
  setFaction(actor: string, faction: Faction, at: number): void {
    this.edit(actor, at, (ledger) => upsertFaction(ledger, faction))
  }

  /** Remove a faction; its jobs stay, offered by nobody in particular. */
  removeFaction(actor: string, id: string, at: number): void {
    this.edit(actor, at, (ledger) => found(removeFaction(ledger, id), 'faction'))
  }

  /** Add a job, open, or rewrite the terms of the one with its id, keeping its state. */
  setJob(actor: string, job: JobTerms, at: number): void {
    this.edit(actor, at, (ledger) => upsertJob(ledger, job))
  }

  /** Drop a job, or open a dropped one again. A done job has paid and stays done. */
  setJobState(actor: string, id: string, state: 'open' | 'dropped', at: number): void {
    this.edit(actor, at, (ledger) => {
      const next = setJobState(ledger, id, state)
      if (next === null && ledger.jobs.some((j) => j.id === id)) {
        throw new RoomRefusal('That job is done: it has paid')
      }
      return found(next, 'job')
    })
  }

  /** Remove a job, whatever its state. What a done job paid stays paid. */
  removeJob(actor: string, id: string, at: number): void {
    this.edit(actor, at, (ledger) => found(removeJob(ledger, id), 'job'))
  }

  /** Finish an open job and pay it into the crawler; null when it is no longer open, so it pays once. */
  completeJob(actor: string, id: string, at: number): Paid | null {
    return this.store.sql.transaction(() => {
      const author = this.store.requireMediator(actor).userId
      const ledger = this.read()
      found(ledger.jobs.find((j) => j.id === id) ?? null, 'job')
      const done = completeJob(ledger, id)
      if (done === null) return null
      const paid = this.credit(author, done.job.pay, done.job.payTl, at)
      this.write(done.ledger, at)
      return paid
    })
  }

  /**
   * Collect this Downtime's deal income: 1 Scrap of the crawler's Tech Level
   * per faction the crew has a deal with (Reclamation of the Wastes p.7), in
   * the Upkeep & Upgrade step, once per Downtime: null when already collected.
   */
  collectIncome(actor: string, at: number): Paid | null {
    return this.store.sql.transaction(() => {
      const author = this.store.requireMediator(actor).userId
      const downtime = this.play.downtime(actor)
      if (downtime?.running !== true || downtime.stepIndex === null) {
        throw new RoomRefusal('Downtime is not running')
      }
      if (!isUpkeepStep(downtime.stepIndex)) {
        throw new RoomRefusal(`Deal income is collected in the ${UPKEEP_STEP_NAME} step`)
      }
      const thisDowntime = downtime.startedAt ?? 0
      const ledger = this.read()
      if (ledger.incomeCollectedFor === thisDowntime) return null
      const scrap = dealCount(ledger)
      if (scrap === 0) throw new RoomRefusal('The crew has no deals to collect from')
      const paid = this.credit(author, scrap, null, at)
      this.write({ ...ledger, incomeCollectedFor: thisDowntime }, at)
      return paid
    })
  }

  /** The ledger as stored; empty before its first write. */
  read(): Ledger {
    const row = this.store.rows('select body from ledger where id = 1')[0]
    return readLedger(row === undefined ? undefined : fromJson(row.body))
  }

  /** When the ledger last changed; 0 before its first write. */
  updatedAt(): number {
    return Number(this.store.rows('select updated_at from ledger where id = 1')[0]?.updated_at ?? 0)
  }

  private edit(actor: string, at: number, change: (ledger: Ledger) => Ledger): void {
    this.store.sql.transaction(() => {
      this.store.requireMediator(actor)
      this.write(change(this.read()), at)
    })
  }

  /** Replace the ledger, parsed: a name too long or a pay too high is refused. */
  private write(next: Ledger, at: number): void {
    const parsed = LedgerSchema.safeParse(next)
    if (!parsed.success) {
      const why = parsed.error.issues[0]?.message ?? ''
      throw new RoomRefusal(`That does not fit the ledger: ${why}`)
    }
    this.store.rows(
      `insert into ledger (id, body, updated_at) values (1, ?, ?)
       on conflict (id) do update set body = excluded.body, updated_at = excluded.updated_at`,
      JSON.stringify(parsed.data),
      at
    )
  }

  /** Credit `scrap` into the primary crawler's pool, at `tl` or the crawler's own Tech Level. */
  private credit(author: string, scrap: number, tl: number | null, at: number): Paid {
    const crawler = this.units.primaryCrawler()
    if (crawler === null) throw new RoomRefusal('This Game has no crawler to pay into')
    if (crawler.leaseId !== null) throw new RoomRefusal('The crawler is on its way somewhere else')
    const body = crawler.body as { name?: unknown; techLevel?: unknown; scrapPool?: ScrapPool }
    const own = typeof body.techLevel === 'string' ? parseCrawlerTechLevel(body.techLevel) : 1
    const level = tl ?? own ?? 1
    const crawlerName = typeof body.name === 'string' ? body.name : null
    if (scrap === 0) return { scrap, tl: level, crawlerName }
    const key = `tl${level}` as keyof ScrapPool
    const scrapPool = { ...(body.scrapPool ?? {}), [key]: (body.scrapPool?.[key] ?? 0) + scrap }
    const op = {
      id: this.newId(),
      unitId: crawler.id,
      baseSeq: crawler.headSeq,
      at,
      kind: 'transaction' as const,
      source: LEDGER_SOURCE,
      patch: { scrapPool },
    }
    try {
      this.units.applyTo(crawler, op, author)
    } catch (error) {
      if (error instanceof BatchRefused)
        throw new RoomRefusal('The crawler could not take that pay')
      throw error
    }
    return { scrap, tl: level, crawlerName }
  }
}

/** An edit's answer, or a refusal naming what it was looking for. */
function found<T>(next: T | null, what: string): T {
  if (next === null) throw new RoomRefusal(`That ${what} is not in the ledger`)
  return next
}
