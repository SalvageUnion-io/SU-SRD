/**
 * A Game's ledger (`schemas/ledger`), pure: the edits the Game room
 * writes and what they pay. Each answers the next ledger, or null when the
 * edit does not apply (no such row, or a job already done).
 */

import type { Faction, Job, JobState, Ledger } from '../schemas/ledger'
import { LedgerSchema } from '../schemas/ledger'

/** A ledger with nothing in it: a Game's before the Mediator writes one. */
export const EMPTY_LEDGER: Ledger = { factions: [], jobs: [] }

/** A stored body as a ledger; anything unreadable reads as empty. */
export function readLedger(body: unknown): Ledger {
  const parsed = LedgerSchema.safeParse(body)
  return parsed.success ? parsed.data : EMPTY_LEDGER
}

/** Add a faction, or replace the one with its id. */
export function upsertFaction(ledger: Ledger, faction: Faction): Ledger {
  const at = ledger.factions.findIndex((f) => f.id === faction.id)
  const factions =
    at === -1
      ? [...ledger.factions, faction]
      : ledger.factions.map((f, i) => (i === at ? faction : f))
  return { ...ledger, factions }
}

/** Remove a faction. Its jobs stay, offered by nobody in particular. */
export function removeFaction(ledger: Ledger, id: string): Ledger | null {
  if (!ledger.factions.some((f) => f.id === id)) return null
  return {
    ...ledger,
    factions: ledger.factions.filter((f) => f.id !== id),
    jobs: ledger.jobs.map((j) => (j.factionId === id ? { ...j, factionId: null } : j)),
  }
}

/** A job as the Mediator writes it: everything but its state. */
export type JobTerms = Omit<Job, 'state'>

/**
 * Add a job, open, or rewrite the terms of the one with its id, keeping its
 * state. A faction the ledger does not hold reads as nobody.
 */
export function upsertJob(ledger: Ledger, terms: JobTerms): Ledger {
  const factionId =
    terms.factionId !== null && ledger.factions.some((f) => f.id === terms.factionId)
      ? terms.factionId
      : null
  const current = ledger.jobs.find((j) => j.id === terms.id)
  const job: Job = { ...terms, factionId, state: current?.state ?? 'open' }
  const jobs =
    current === undefined
      ? [...ledger.jobs, job]
      : ledger.jobs.map((j) => (j === current ? job : j))
  return { ...ledger, jobs }
}

/** Remove a job. */
export function removeJob(ledger: Ledger, id: string): Ledger | null {
  if (!ledger.jobs.some((j) => j.id === id)) return null
  return { ...ledger, jobs: ledger.jobs.filter((j) => j.id !== id) }
}

/**
 * Drop a job, or open it again. A done job has paid, so it stays done: null
 * for it, as for a job the ledger does not hold.
 */
export function setJobState(
  ledger: Ledger,
  id: string,
  state: Exclude<JobState, 'done'>
): Ledger | null {
  const job = ledger.jobs.find((j) => j.id === id)
  if (job === undefined || job.state === 'done') return null
  return { ...ledger, jobs: ledger.jobs.map((j) => (j.id === id ? { ...j, state } : j)) }
}

/**
 * Finish an open job: the ledger with it done, and the job, whose pay the
 * caller credits. Null when it is not open, so it pays once.
 */
export function completeJob(ledger: Ledger, id: string): { ledger: Ledger; job: Job } | null {
  const job = ledger.jobs.find((j) => j.id === id)
  if (job === undefined || job.state !== 'open') return null
  const done: Job = { ...job, state: 'done' }
  return {
    ledger: { ...ledger, jobs: ledger.jobs.map((j) => (j.id === id ? done : j)) },
    job: done,
  }
}

/** How many factions the crew has a deal with: the Scrap their Downtime income comes to. */
export function dealCount(ledger: Ledger): number {
  return ledger.factions.filter((f) => f.deal).length
}

/** The faction a job is for, or undefined when it is nobody's. */
export function factionOf(ledger: Ledger, job: Pick<Job, 'factionId'>): Faction | undefined {
  return job.factionId === null ? undefined : ledger.factions.find((f) => f.id === job.factionId)
}
