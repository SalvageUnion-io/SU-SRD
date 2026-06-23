/**
 * Crawler capacity rule enforcement (Phase 3, soft-warn).
 *
 * Computes bay and system usage for a crawler and surfaces violations.
 * All operations are synchronous and pure — same input always yields same output.
 * No React, no IndexedDB.
 *
 * Bay caps are derived from tech level per the Salvage Union Workshop Manual:
 *   Bays: techLevel × 2  (TL1=2, TL2=4, TL3=6, TL4=8, TL5=10, TL6=12)
 *
 * The Weapons System cap is gated by CRAWLER TYPE, not tech level. Per the
 * Salvage Union Core Book Digital Edition 2.0a:
 *   - p. 213, Crawler Creation step 3 ("Choose your Weapons System"): "A Union
 *     Crawler can mount a single Weapons System in its Armament Bay." — one
 *     system for every crawler type, independent of tech level.
 *   - p. 216, Battle Crawler ability "Improved Armour and Armaments": "Your
 *     Union Crawler may mount two Weapons Systems in its Armament Bay instead
 *     of the usual one..." — the sole exception, raising the cap to 2.
 *
 * So: Battle Crawler = 2 systems, every other crawler type = 1 system.
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
  /**
   * Whether the crawler is a Battle Crawler. A Battle Crawler mounts two
   * Weapons Systems (Core Book p. 216, "Improved Armour and Armaments");
   * every other crawler type mounts one (p. 213, step 3). Defaults to false.
   */
  isBattleCrawler?: boolean
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

/** Weapons System slots by crawler type (Core Book p. 213 / p. 216). */
const SYSTEMS_NON_BATTLE = 1
const SYSTEMS_BATTLE = 2

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute crawler capacity from a `CrawlerCapacityInput` and return usage + violations.
 *
 * Violation kinds:
 * - `tech-level-unknown` — the `techLevel` is outside the valid 1–6 range
 * - `bays-over-capacity`    — bays used exceeds cap for the tech level
 * - `systems-over-capacity` — systems used exceeds the crawler-type cap
 *
 * The systems cap is gated by crawler type (Battle = 2, otherwise = 1), not
 * tech level, so it is enforced even when the tech level is unknown — only the
 * bay cap depends on tech level. When `tech-level-unknown` is present,
 * `baysMax` is 0 and the bay violation is suppressed (can't enforce without a
 * cap).
 *
 * Violations are SOFT — they do not prevent saving. Surface them as warnings
 * in the UI with a red-ring indicator and a capacity banner; do not disable
 * the submit button.
 */
export function computeCrawlerCapacity(crawler: CrawlerCapacityInput): CrawlerCapacityResult {
  const violations: CrawlerCapacityViolation[] = []

  const systemsMax = crawler.isBattleCrawler ? SYSTEMS_BATTLE : SYSTEMS_NON_BATTLE
  const systemsUsed = crawler.systems.length

  if (systemsUsed > systemsMax) {
    violations.push({
      kind: 'systems-over-capacity',
      message: `System capacity exceeded: ${systemsUsed} used, ${systemsMax} available.`,
      details: { used: systemsUsed, max: systemsMax },
    })
  }

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
      systemsUsed,
      systemsMax,
      violations,
    }
  }

  const baysMax = BAYS_BY_TL[crawler.techLevel]!
  const baysUsed = crawler.bays.length

  if (baysUsed > baysMax) {
    violations.push({
      kind: 'bays-over-capacity',
      message: `Bay capacity exceeded: ${baysUsed} used, ${baysMax} available.`,
      details: { used: baysUsed, max: baysMax },
    })
  }

  return { baysUsed, baysMax, systemsUsed, systemsMax, violations }
}
