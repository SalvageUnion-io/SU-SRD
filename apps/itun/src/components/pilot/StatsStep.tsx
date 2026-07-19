import { Stat } from 'component-lib'
import {
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
} from '../../lib/rules/derivedStats'

/**
 * Step 1 · Your Stats (Pilot Bay p.18) — display-only briefing step. Every
 * pilot starts with 10 HP, 5 AP, and 6 Inventory Slots; the values are fixed
 * by the rules, so NO inputs exist and Next is always enabled. Renders the
 * sheets' StatBlock lozenges so the wizard previews exactly what the live
 * sheet will show.
 */
export function StatsStep() {
  return (
    <div className="flex flex-wrap gap-4">
      <Stat label="HP" value={PILOT_BASE_HP} max={PILOT_BASE_HP} compact />
      <Stat label="AP" value={PILOT_BASE_AP} max={PILOT_BASE_AP} compact />
      <Stat
        label="INV"
        value={PILOT_BASE_INVENTORY_SLOTS}
        max={PILOT_BASE_INVENTORY_SLOTS}
        compact
      />
    </div>
  )
}
