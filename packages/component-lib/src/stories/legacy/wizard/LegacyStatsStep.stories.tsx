import type { Story } from '@ladle/react'
import {
  PILOT_BASE_AP,
  PILOT_BASE_HP,
  PILOT_BASE_INVENTORY_SLOTS,
} from 'salvageunion-reference/rules'
import { Stat } from '../../../components/shared/Stat'
import { Caption } from '../../_harness'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Pilot Stats Step' }

/**
 * Verbatim reproduction of the presentational shell of
 * apps/in-the-union-now/src/components/pilot/StatsStep.tsx (lines 15-28).
 *
 * Step 1 · Your Stats — display-only briefing step. Every pilot starts with
 * fixed 10 HP / 5 AP / 6 Inventory Slots, so there are NO inputs; the step just
 * renders the sheets' Stat lozenges. Real values come from the reference
 * package's PILOT_BASE_* rules constants (the same source ITUN re-exports).
 */
function LegacyStatsStep() {
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

export const Default: Story = () => (
  <div className="flex flex-col gap-4">
    <Caption>Legacy · Pilot Stats step (StatsStep.tsx lines 15-28) — fixed-stat briefing</Caption>
    <LegacyStatsStep />
  </div>
)
