/**
 * Pure helper for rolling on the Crawler Name Table (Union Crawler step 5,
 * Core Book p.212: "The Crawler Names Table can be found on p.226").
 * Isolated from React so it can be tested without a DOM — the crawler
 * counterpart of mechRollTables.
 */

import { roll } from '@randsum/roller'
import type { SURefRollTable } from 'salvageunion-reference'
import { rollOnTable, SalvageUnionReference } from 'salvageunion-reference'

const CRAWLER_NAME_TABLE = 'Crawler Name'

/** Dependency interface for roll table lookup — injectable for testing. */
export type CrawlerRollTableDeps = {
  findTable: (name: string) => (SURefRollTable & { schemaName: string }) | undefined
  rollD20: () => number
}

const defaultDeps: CrawlerRollTableDeps = {
  findTable: (name) => SalvageUnionReference.RollTables.find((t) => t.name === name),
  rollD20: () => roll('1d20').total,
}

/**
 * Rolls a d20 on the Crawler Name Table and returns the result string.
 * Returns null when the table cannot be found or the roll fails — the roll
 * is an assist, never a commitment (the result stays editable).
 */
export function rollCrawlerName(deps: CrawlerRollTableDeps = defaultDeps): string | null {
  const table = deps.findTable(CRAWLER_NAME_TABLE)
  if (!table) return null
  const outcome = rollOnTable(table.table, deps.rollD20)
  if (!outcome.success) return null
  return outcome.label ? `${outcome.label}: ${outcome.value}` : outcome.value
}
