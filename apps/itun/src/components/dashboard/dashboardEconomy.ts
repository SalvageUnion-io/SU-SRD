/**
 * dashboardEconomy — pure patch builders for the Downtime economy layers
 * (F2/F3/F4 of the rules-parity plan, #599).
 *
 * Same contract as `dashboardRules`: nothing here touches React or the store.
 * Each function takes live numbers and returns the write-through patch(es) the
 * caller hands to `storeState.update` / `.transfer`, so the handlers stay
 * trivially testable and the ADR-006 pure-math boundary holds — `lib/rules/*`
 * owns the maths, this only assembles patches.
 *
 * `crafting`, `salvage` and `scrapMech` were fully implemented and tested with
 * **zero non-test importers**: their Live-Sheet panels were deleted on the way
 * to the Dashboard and never rebuilt. This module is the missing seam, not new
 * rules.
 *
 * ADR-007 boundary: nothing here decides to destroy anything. `scrapMechPatch`
 * assembles the consequence of a scrap the player has already confirmed; the
 * confirmation itself stays an explicit call at the UI layer.
 */

import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { craftQuote, craftedLot, type CraftableItem } from '../../lib/rules/crafting'
import {
  depositScrapDeposits,
  handOffCargo,
  mechScrapComponents,
  scrapMechBreakdown,
} from '../../lib/rules/scrapMech'
import { performAreaSalvage, type AreaSalvageResult } from '../../lib/rules/salvage'
import type { ScrapPool } from '../../lib/schemas/crawler'
import type { Roll } from '../../lib/rules/heatCheck'

/** The crawler's numeric Tech Level, or undefined when the slug is unparseable. */
export function crawlerTechLevelOf(crawler: Pick<Crawler, 'techLevel'>): number | undefined {
  const digits = (crawler.techLevel ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : undefined
}

// ─── crafting (F3) ───────────────────────────────────────────────────────────

export type CraftOutcome = {
  quote: ReturnType<typeof craftQuote>
  /** Null when the craft is not allowed — the caller shows the reason instead. */
  patch: Partial<Crawler> | null
  /** Why the craft is blocked, for the rule brief. Undefined when allowed. */
  blocked?: 'tech-level' | 'scrap'
}

/**
 * Quote a craft and, when it is legal AND affordable, assemble the patch:
 * the pool after paying, plus the crafted item as a cargo lot.
 *
 * Guided Play enforces (ADR-021), so an ineligible or unaffordable craft
 * returns a null patch and a reason rather than a patch the caller must
 * remember not to apply.
 */
export function craftOutcome(
  crawler: Pick<Crawler, 'techLevel' | 'scrapPool' | 'cargoLots'>,
  item: CraftableItem
): CraftOutcome {
  const crawlerTl = crawlerTechLevelOf(crawler) ?? 0
  const quote = craftQuote(item, (crawler.scrapPool ?? {}) as ScrapPool, crawlerTl)
  if (!quote.eligible) return { quote, patch: null, blocked: 'tech-level' }
  if (!quote.affordable) return { quote, patch: null, blocked: 'scrap' }
  return {
    quote,
    patch: {
      scrapPool: quote.pool,
      cargoLots: [...(crawler.cargoLots ?? []), craftedLot(item)],
    },
  }
}

// ─── area salvage (F2) ───────────────────────────────────────────────────────

export type AreaSalvageOutcome = {
  result: AreaSalvageResult
  /** Absent when the roll yielded nothing — there is no write to make. */
  patch: Partial<Crawler> | null
}

/**
 * Apply an Area Salvage roll to the crawler's scrap pool.
 *
 * A "nothing" band is a legitimate outcome, not a failure: it returns a null
 * patch so the caller reports the result without a no-op write (which would
 * otherwise appear in the Change Log as a change that changed nothing).
 */
export function areaSalvageOutcome(
  crawler: Pick<Crawler, 'scrapPool'>,
  input: { areaTl: number; roll: Roll }
): AreaSalvageOutcome {
  const result = performAreaSalvage(input)
  // A "nothing" band and a jackpot both yield 0 scrap: the first found none,
  // the second hands the player an ITEM choice rather than scrap. Neither has a
  // pool write to make.
  if (result.scrapQty <= 0) return { result, patch: null }
  return {
    result,
    patch: {
      scrapPool: depositScrapDeposits((crawler.scrapPool ?? {}) as ScrapPool, [
        { tl: result.areaTl, count: result.scrapQty },
      ]),
    },
  }
}

// ─── scrap mech (F4) ─────────────────────────────────────────────────────────

export type ScrapMechOutcome = {
  breakdown: ReturnType<typeof scrapMechBreakdown>
  /** The crawler patch: its pool after the scrap, plus any cargo handed over. */
  crawlerPatch: Partial<Crawler>
  /** The mech patch marking it consumed. */
  mechPatch: Partial<Mech>
  /** True when the mech's hold moved to the crawler rather than being lost. */
  cargoHandedOff: boolean
}

/**
 * Assemble the consequence of scrapping a mech into a crawler's pool.
 *
 * Cross-entity by nature — the scrap leaves the mech and enters the crawler —
 * so the caller commits both halves through `entityStore.transfer`, which is
 * all-or-nothing: a partial write here would duplicate or destroy player value.
 *
 * **A scrapped mech is not a destroyed one.** Deliberately breaking a mech down
 * hands its hold to the crawler; nothing in the hold was ever part of the mech,
 * so losing it would be silent data loss. A mech that was already DESTROYED has
 * lost its cargo with it (p.234/p.240), so the hand-off is skipped — the rule
 * `handOffCargo` states in its own header, and the distinction the caller must
 * make rather than the module.
 *
 * The mech is marked `destroyed` rather than deleted: deleting the record would
 * take its Change Log and its soft-links with it, and ADR-007 keeps destruction
 * visible rather than silently dropping data.
 */
export function scrapMechOutcome(
  mech: Parameters<typeof mechScrapComponents>[0] & Pick<Mech, 'id' | 'cargoLots' | 'destroyed'>,
  crawler: Pick<Crawler, 'scrapPool' | 'cargoLots'>
): ScrapMechOutcome {
  const components = mechScrapComponents(mech)
  const breakdown = scrapMechBreakdown(components)
  const pooled = depositScrapDeposits((crawler.scrapPool ?? {}) as ScrapPool, breakdown.deposits)

  if (mech.destroyed) {
    return {
      breakdown,
      crawlerPatch: { scrapPool: pooled },
      mechPatch: { destroyed: true },
      cargoHandedOff: false,
    }
  }

  const handed = handOffCargo(mech.cargoLots ?? [], crawler.cargoLots ?? [], pooled)
  return {
    breakdown,
    crawlerPatch: { scrapPool: handed.pool, cargoLots: handed.crawlerLots },
    mechPatch: { destroyed: true, cargoLots: [] },
    cargoHandedOff: true,
  }
}
