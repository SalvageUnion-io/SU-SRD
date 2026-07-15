import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { StatsBar } from './StatsBar'
import type { StatItem } from './statsBarTypes'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/StatsBar',
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

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div>{children}</div>
      <code className="font-mono text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** The stat row — read, editable (onChange → steppers), and compact — on one page. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      A row of StatDisplay value-boxes. A stat's onChange makes it editable (+/- steppers); compact
      tightens for rails and listings.
    </p>
    <Row label="read">
      <StatsBar stats={readStats} />
    </Row>
    <Row label="editable (onChange)">
      <StatsBar stats={editStats} />
    </Row>
    <Row label="compact">
      <StatsBar stats={readStats} compact />
    </Row>
  </div>
)
