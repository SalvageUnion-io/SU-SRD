import type { Story } from '@ladle/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { SheetDisplay } from './SheetDisplay'
import { Text } from '../base/Text'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/Sheet Display',
}

// Real chassis drives the label|value fields.
const chassis = SalvageUnionReference.Chassis.all()[0]
const name = chassis?.name ?? 'Mule'
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const tl = chassis?.techLevel ?? 1

/** The label-over-value sheet field, across its prop variants. */
export const Fields: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-5 font-mono text-ink">
    <p className="max-w-2xl text-xs leading-relaxed text-ink-2">
      A labelled sheet field (label + value, or label + children). compact tightens spacing;
      labelColor overrides the label ink.
    </p>
    <div className="flex flex-wrap gap-6">
      <div className="w-[240px]">
        <SheetDisplay label="Chassis" value={name} />
      </div>
      <div className="w-[240px]">
        <SheetDisplay label="Tech Level" value={String(tl)} compact />
      </div>
      <div className="w-[240px]">
        <SheetDisplay label="Chassis" value={name} labelColor="text-rust" />
      </div>
      <div className="w-[240px]">
        <SheetDisplay label="Loadout">
          <Text className="text-sm text-ink-2">
            Structure {sp} · Energy {ep} · Heat cap {heat}
          </Text>
        </SheetDisplay>
      </div>
    </div>
  </div>
)

/** A row of stat fields — real chassis vitals. */
export const StatRow: Story = () => (
  <div className="flex flex-col gap-4 bg-paper p-5">
    <div className="flex flex-wrap gap-4">
      <div className="w-[200px]">
        <SheetDisplay label="Structure Points" value={`${sp} / ${sp}`} />
      </div>
      <div className="w-[200px]">
        <SheetDisplay label="Energy Points" value={`${ep} / ${ep}`} />
      </div>
      <div className="w-[200px]">
        <SheetDisplay label="Heat" value={`0 / ${heat}`} />
      </div>
    </div>
  </div>
)
