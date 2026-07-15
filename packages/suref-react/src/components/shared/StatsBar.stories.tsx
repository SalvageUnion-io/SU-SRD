import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { StatsBar } from './StatsBar'
import type { StatItem } from './statsBarTypes'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/StatsBar',
}

// Real chassis stats drive the bar.
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 13
const cargo = chassis?.cargoCapacity ?? 16
const tl = chassis?.techLevel ?? 1

const noop = () => {}

const readStats: StatItem[] = [
  { key: 'sp', label: 'SP', value: Math.ceil(sp * 0.7), outOfMax: sp },
  { key: 'cargo', label: 'CARGO', value: Math.ceil(cargo * 0.5), outOfMax: cargo },
  { key: 'tl', label: 'TL', value: tl },
]

const editStats: StatItem[] = readStats.map((s) => ({ ...s, onChange: noop }))

/** Read-only bar — a row of value boxes (no steppers). */
export const Default: Story = () => <StatsBar stats={readStats} />

/** Editable bar — presence of onChange renders each stat with +/- steppers. */
export const Editable: Story = () => <StatsBar stats={editStats} />

/** Compact bar — the rail / listing density. */
export const Compact: Story = () => <StatsBar stats={readStats} compact />
