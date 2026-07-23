/**
 * crawlerSheetItemRules — the crawler sheet's non-component helpers, kept beside
 * CrawlerSheetItems.tsx (which stays a components-only module). Pure lookups +
 * constants shared by CrawlerSheetItems and CrawlerSheet.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'

/** Resolve a stored crawler-system ref (id or name) to its SRD entity [gap 20]. */
export function resolveCrawlerSystem(ref: string): SURefEntity | null {
  try {
    const all = SalvageUnionReference.Systems.all()
    return all.find((s) => s.id === ref || s.name === ref) ?? null
  } catch {
    return null
  }
}

/** Bay repair cost: 5 Scrap of crawler TL or higher (rules C8, S12). */
export const BAY_REPAIR_COST = 5

/** Crawler scrap tech-level buckets, used by the bay-repair pool math. */
export const SCRAP_TLS = [1, 2, 3, 4, 5, 6] as const
