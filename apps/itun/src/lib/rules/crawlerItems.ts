/**
 * crawlerItems — the crawler sheet's non-component helpers (a rules home, not
 * `components/sheet/`). Pure lookups + constants shared by
 * CrawlerSheetItems and CrawlerSheet.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { resolveSystemRef } from 'salvageunion-reference/rules'
import { readReference } from '../readReference'

/** Resolve a stored crawler-system slug to its SRD entity [gap 20]. */
export function resolveCrawlerSystem(ref: string): SURefEntity | null {
  return readReference('resolveCrawlerSystem', () => resolveSystemRef(ref), null)
}

/** Bay repair cost: 5 Scrap of crawler TL or higher (rules C8, S12). */
export const BAY_REPAIR_COST = 5

// The scrap tech-level list has one home, `lib/rules/crawlerEconomy.ts#SCRAP_TLS`,
// beside the pool math that walks it.
