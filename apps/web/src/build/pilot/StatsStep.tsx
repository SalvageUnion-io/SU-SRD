import type { CSSProperties } from 'react'
import {
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
} from 'salvageunion-reference/rules'
import { Stat, tokens } from '../../components/index'

/** The three stat lozenges, wrapping on a narrow column. */
const STAT_ROW = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[16],
} satisfies CSSProperties

/**
 * Step 1 · Your Stats (Pilot Bay p.18) — display-only briefing step. Every
 * pilot starts with 10 HP, 5 AP, and 6 Inventory Slots; the values are fixed
 * by the rules, so NO inputs exist and Next is always enabled. Renders the
 * sheets' StatBlock lozenges so the wizard previews exactly what the live
 * sheet will show.
 */
export function StatsStep() {
  return (
    <div style={STAT_ROW}>
      <Stat label="HP" value={PILOT_BASE_HP} max={PILOT_BASE_HP} />
      <Stat label="AP" value={PILOT_BASE_AP} max={PILOT_BASE_AP} />
      <Stat label="INV" value={PILOT_BASE_INVENTORY_SLOTS} max={PILOT_BASE_INVENTORY_SLOTS} />
    </div>
  )
}
