/**
 * crawlerSheetItemRules — the crawler sheet's non-component helpers, kept beside
 * CrawlerSheetItems.tsx (which stays a components-only module). Pure lookups +
 * constants shared by CrawlerSheetItems and CrawlerSheet.
 */

import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'

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

// The scrap tech-level list used to be declared here too. It now has one home,
// `lib/rules/crawlerEconomy.ts#SCRAP_TLS`, beside the pool math that walks it.
