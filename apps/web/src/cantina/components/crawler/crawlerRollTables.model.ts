/**
 * Pure helper for rolling on the Crawler Name Table (Union Crawler step 5,
 * Core Book p.212: "The Crawler Names Table can be found on p.226").
 * Isolated from React so it can be tested without a DOM — the crawler
 * counterpart of mechRollTables.
 */

import type { RefRollTable } from 'salvageunion-reference'
import { NO_EFFECT, rollOnTable, SalvageUnionReference } from 'salvageunion-reference'
import { rollD20 } from '../../../ui/index'

const CRAWLER_NAME_TABLE = 'Crawler Name'

/** Dependency interface for roll table lookup — injectable for testing. */
export type CrawlerRollTableDeps = {
  findTable: (name: string) => (RefRollTable & { schemaName: string }) | undefined
  rollD20: () => number
}

const defaultDeps: CrawlerRollTableDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.getByName(name),
  // Not a named Salvage Union table: Randsum's plain d20 (src/ui).
  rollD20,
}

/**
 * Rolls a d20 on the Crawler Name Table and returns the result string.
 * A roll that lands on no row reads `NO_EFFECT`, as on the SRD and in the bot.
 * Returns null when the table cannot be found or the roll fails — the roll
 * is an assist, never a commitment (the result stays editable).
 */
export function rollCrawlerName(deps: CrawlerRollTableDeps = defaultDeps): string | null {
  const table = deps.findTable(CRAWLER_NAME_TABLE)
  if (!table) return null
  const outcome = rollOnTable(table.table, deps.rollD20)
  if (!outcome.success) return null
  // A roll that lands on no row reads as it does on the SRD and in the bot.
  if (outcome.kind === 'no-effect') return NO_EFFECT
  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
