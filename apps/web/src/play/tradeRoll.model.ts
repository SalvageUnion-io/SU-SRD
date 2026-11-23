/**
 * This Downtime's Trading Bay roll, shared by the Trade step and Craft · Trade
 * (r8 D3): one roll a Downtime (Core Book p.223), whichever of them made it.
 * Held in the tab, as the roll always was, and let go when Downtime's column
 * goes (`clearTradeRolls`). Its own small module, so the column holds it
 * without loading the bays.
 */

import { create } from 'zustand'
import type { Ware } from './craftTrade.model'

/** A roll: what came up, what is for sale, and what of it is bought. */
export type TradeRoll = {
  rolled: { roll: number; label: string; tl: number }
  offers: Ware[]
  bought: readonly string[]
}

export const useTradeRolls = create<{
  byCrawler: Readonly<Record<string, TradeRoll>>
  put: (crawlerId: string, roll: TradeRoll) => void
}>((set) => ({
  byCrawler: {},
  put: (crawlerId, roll) => set((was) => ({ byCrawler: { ...was.byCrawler, [crawlerId]: roll } })),
}))

/** Forget every roll: Downtime is over. */
export function clearTradeRolls() {
  useTradeRolls.setState({ byCrawler: {} })
}
