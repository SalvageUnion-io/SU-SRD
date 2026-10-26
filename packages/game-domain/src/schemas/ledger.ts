import { z } from 'salvageunion-reference/zod'

/**
 * Ledger — a Game's factions and jobs: who the crew deals with, how those
 * factions regard them, and the work they have taken and what it pays.
 *
 * Campaign play pays the crawler from it. Reclamation of the Wastes pays 1
 * Scrap of the crawler's Tech Level per Downtime for each faction the crew has
 * signed a deal with (pp.6–7), and False Flag's contracts pay a set count of
 * Scrap at a set Tech Level when finished (pp.18–25). The book gives standing
 * no scale of its own; the three steps here are the table's shorthand.
 *
 * One per Game, the Mediator's to write and every member's to read.
 */

/** The most factions one Game tracks. */
const LEDGER_MAX_FACTIONS = 40
/** The most jobs one Game tracks, open and closed together. */
const LEDGER_MAX_JOBS = 120
/** How long a faction's or job's name may run. */
export const LEDGER_MAX_NAME = 80
/** The most Scrap one job pays. */
export const LEDGER_MAX_PAY = 999

/** How a faction regards the crew, worst first. */
const FACTION_STANDINGS = ['hostile', 'neutral', 'friendly'] as const
export type FactionStanding = (typeof FACTION_STANDINGS)[number]

/**
 * A job's state: `open` while the crew may still take it on, `done` once
 * finished and paid, `dropped` once failed, refused or lost. Done is final: it
 * has paid out.
 */
const JOB_STATES = ['open', 'done', 'dropped'] as const
export type JobState = (typeof JOB_STATES)[number]

const NameSchema = z.string().trim().min(1).max(LEDGER_MAX_NAME)

const FactionSchema = z
  .object({
    id: z.string().min(1),
    name: NameSchema,
    standing: z.enum(FACTION_STANDINGS),
    /** A signed deal: a trade link that pays every Downtime. */
    deal: z.boolean(),
  })
  .strict()

export type Faction = z.infer<typeof FactionSchema>

const JobSchema = z
  .object({
    id: z.string().min(1),
    name: NameSchema,
    /** The faction offering it, or null for anyone else. */
    factionId: z.string().min(1).nullable(),
    /** How much Scrap it pays; 0 for a favour. */
    pay: z.number().int().min(0).max(LEDGER_MAX_PAY),
    /** The Tech Level of that Scrap. */
    payTl: z.number().int().min(1).max(6),
    state: z.enum(JOB_STATES),
  })
  .strict()

export type Job = z.infer<typeof JobSchema>

export const LedgerSchema = z
  .object({
    factions: z.array(FactionSchema).max(LEDGER_MAX_FACTIONS),
    jobs: z.array(JobSchema).max(LEDGER_MAX_JOBS),
    /**
     * The `startedAt` of the Downtime whose deal income was collected, so it
     * pays once per Downtime; absent before the first.
     */
    incomeCollectedFor: z.number().optional(),
  })
  .strict()

export type Ledger = z.infer<typeof LedgerSchema>
