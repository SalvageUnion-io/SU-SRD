import type { Story } from '@ladle/react'
import { SalvageUnionReference, type SURefEntity } from 'salvageunion-reference'

import {
  LiveSheetLegacyPilot,
  type LegacyAbility,
  type LegacyEquipment,
} from './LiveSheetLegacyPilot'

/**
 * Legacy/Live Sheet — the "before" capture for the live-sheet reconciliation.
 *
 * A faithful, presentational reproduction of ITUN's CURRENT Pilot live sheet,
 * rebuilt inside component-lib (which cannot import the ITUN app) from real ORM
 * data. It stakes the L1 baseline the reconciliation converges away from — see
 * `docs/design/livesheet-reconciliation.md`. Mech + Crawler captures follow as
 * parity increments; Pilot is the reference implementation.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Live Sheet',
}

/**
 * Named pick with an INDEX fallback (mirrors the composition story's `pick`,
 * but the index keeps the three cards distinct even when a named entity is
 * absent from the current dataset — no duplicate React keys).
 */
function pick(schema: 'Abilities' | 'Equipment', name: string, index: number): SURefEntity {
  const all = SalvageUnionReference[schema].all() as ReadonlyArray<SURefEntity>
  if (all.length === 0) throw new Error(`Legacy/Live Sheet: ${schema} is empty (data drift)`)
  return (all.find((e) => (e as { name?: string }).name === name) ??
    all[index % all.length]) as SURefEntity
}

const abilities: LegacyAbility[] = [
  { entity: pick('Abilities', 'Auto-Turret', 0), apCost: 1 },
  { entity: pick('Abilities', 'Overclock', 1), apCost: 2, used: true },
  { entity: pick('Abilities', 'Field Medic', 2), apCost: '—' },
]

const equipment: LegacyEquipment[] = [
  { entity: pick('Equipment', 'Combat Knife', 0), slots: 1 },
  { entity: pick('Equipment', 'Med Kit', 1), slots: 1 },
  { entity: pick('Equipment', 'Rope', 2), slots: 1 },
]

/** Desktop poster (wide `@container` → 12-col region grid). */
export const Pilot: Story = () => (
  <LiveSheetLegacyPilot abilities={abilities} equipment={equipment} />
)

/** Phone width (~390px) — the `@container` grid collapses to a single column. */
export const PilotMobile: Story = () => (
  <div className="mx-auto w-[390px] overflow-hidden rounded-[6px] border-2 border-ink/30 shadow-lg">
    <LiveSheetLegacyPilot abilities={abilities} equipment={equipment} />
  </div>
)
