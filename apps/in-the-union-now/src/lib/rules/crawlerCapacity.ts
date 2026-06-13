/**
 * Crawler capacity rule enforcement (Phase 3, soft-warn).
 *
 * Computes bay and system usage for a crawler and surfaces violations.
 * All operations are synchronous and pure — same input always yields same output.
 * No React, no IndexedDB.
 *
 * Capacity caps are derived from tech level per the Salvage Union Workshop Manual:
 *   Bays:    techLevel × 2  (TL1=2, TL2=4, TL3=6, TL4=8, TL5=10, TL6=12)
 *   Systems: techLevel × 4  (TL1=4, TL2=8, TL3=12, TL4=16, TL5=20, TL6=24)
 *
 * These caps are SOFT — violations are warnings only. Submit is never blocked.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Input shape for computeCrawlerCapacity.
 * `techLevel` is the numeric tech level (1–6). Pass 0 for "unknown".
 */
export type CrawlerCapacityInput = {
  /** Numeric tech level 1–6. 0 or out-of-range triggers tech-level-unknown violation. */
  techLevel: number
  /** Slugs of entities assigned to bays (pilots / mechs). */
  bays: string[]
  /** Slugs of system items installed. */
  systems: string[]
}

export type CrawlerCapacityViolation =
  | {
      kind: 'bays-over-capacity'
      message: string
      details: { used: number; max: number }
    }
  | {
      kind: 'systems-over-capacity'
      message: string
      details: { used: number; max: number }
    }
  | {
      kind: 'tech-level-unknown'
      message: string
      details: { techLevel: number }
    }

export type CrawlerCapacityResult = {
  baysUsed: number
  baysMax: number
  systemsUsed: number
  systemsMax: number
  violations: CrawlerCapacityViolation[]
}

// ---------------------------------------------------------------------------
// Capacity formula — derivable from the Workshop Manual TL table
// ---------------------------------------------------------------------------

const VALID_TECH_LEVELS = [1, 2, 3, 4, 5, 6] as const

/** Bays available at each tech level (index by tl-1). */
const BAYS_BY_TL: Record<number, number> = {
  1: 2,
  2: 4,
  3: 6,
  4: 8,
  5: 10,
  6: 12,
}

/** System slots available at each tech level (index by tl-1). */
const SYSTEMS_BY_TL: Record<number, number> = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute crawler capacity from a `CrawlerCapacityInput` and return usage + violations.
 *
 * Violation kinds:
 * - `tech-level-unknown` — the `techLevel` is outside the valid 1–6 range
 * - `bays-over-capacity`    — bays used exceeds cap for the tech level
 * - `systems-over-capacity` — systems used exceeds cap for the tech level
 *
 * When `tech-level-unknown` is present, `baysMax` and `systemsMax` are both 0
 * and slot violations are suppressed (can't enforce without a cap).
 *
 * Violations are SOFT — they do not prevent saving. Surface them as warnings
 * in the UI with a red-ring indicator and a capacity banner; do not disable
 * the submit button.
 */
export function computeCrawlerCapacity(crawler: CrawlerCapacityInput): CrawlerCapacityResult {
  const violations: CrawlerCapacityViolation[] = []

  const isValidTL = VALID_TECH_LEVELS.includes(
    crawler.techLevel as (typeof VALID_TECH_LEVELS)[number]
  )

  if (!isValidTL) {
    violations.push({
      kind: 'tech-level-unknown',
      message: `Tech level ${crawler.techLevel} is not a valid crawler tech level (expected 1–6).`,
      details: { techLevel: crawler.techLevel },
    })
    return {
      baysUsed: crawler.bays.length,
      baysMax: 0,
      systemsUsed: crawler.systems.length,
      systemsMax: 0,
      violations,
    }
  }

  const baysMax = BAYS_BY_TL[crawler.techLevel]!
  const systemsMax = SYSTEMS_BY_TL[crawler.techLevel]!
  const baysUsed = crawler.bays.length
  const systemsUsed = crawler.systems.length

  if (baysUsed > baysMax) {
    violations.push({
      kind: 'bays-over-capacity',
      message: `Bay capacity exceeded: ${baysUsed} used, ${baysMax} available.`,
      details: { used: baysUsed, max: baysMax },
    })
  }

  if (systemsUsed > systemsMax) {
    violations.push({
      kind: 'systems-over-capacity',
      message: `System capacity exceeded: ${systemsUsed} used, ${systemsMax} available.`,
      details: { used: systemsUsed, max: systemsMax },
    })
  }

  return { baysUsed, baysMax, systemsUsed, systemsMax, violations }
}
