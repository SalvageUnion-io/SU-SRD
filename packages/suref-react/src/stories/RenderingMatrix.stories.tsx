import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { StatDisplay } from '../components/shared/StatDisplay'
import { VitalGauge } from '../components/stat/VitalGauge'
import { Badge } from '../components/chrome/Badge'
import { Tag } from '../components/chrome/Tag'
import { Stamp } from '../components/chrome/Stamp'
import { ConditionSwatch } from '../components/stat/ConditionSwatch'
import { SlotGrid } from '../components/shared/SlotGrid'
import { DisplayCard } from '../components/shared/DisplayCard'
import { RollTable } from '../components/shared/RollTable'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Rendering Matrix',
}

const noop = () => {}

// Real reference data drives every live example (preloaded by .ladle/components.tsx).
const chassis = SalvageUnionReference.Chassis.all()[0]
const chassisName = chassis?.name ?? 'Mule'
const sp = chassis?.structurePoints ?? 13
const cargo = chassis?.cargoCapacity ?? 16
const tl = chassis?.techLevel ?? 1
const trait = SalvageUnionReference.Traits.all()[0]
const traitLabel = (trait?.name ?? 'Ballistic').toUpperCase()
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const rollTable = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined

type MatrixRow = {
  kind: string
  context: string
  primitive: string
  rule: string
  example: ReactNode
}

const rows: MatrixRow[] = [
  {
    kind: 'Bounded stat',
    context: 'no chips · read',
    primitive: 'StatDisplay (max, no dots)',
    rule: 'Square value box; value / max, no pip track.',
    example: <StatDisplay label="SP" value={Math.ceil(sp * 0.7)} max={sp} />,
  },
  {
    kind: 'Bounded stat',
    context: 'no chips · interactive',
    primitive: 'StatDisplay mode="edit"',
    rule: 'Value box + steppers, no pips (StatControl).',
    example: <StatDisplay label="HP" value={8} max={10} mode="edit" onChange={noop} />,
  },
  {
    kind: 'Bounded stat',
    context: 'chips · read',
    primitive: 'StatDisplay dots',
    rule: 'Framed tracker, pip track read-only.',
    example: <StatDisplay dots label="SP" value={Math.ceil(sp * 0.7)} max={sp} tone="sp" />,
  },
  {
    kind: 'Bounded stat',
    context: 'chips · interactive',
    primitive: 'StatDisplay dots mode="edit"',
    rule: 'Numeral + steppers; pips click-to-set.',
    example: (
      <StatDisplay dots label="HP" value={8} max={10} mode="edit" tone="hp" onChange={noop} />
    ),
  },
  {
    kind: 'Label | value',
    context: 'inline pair',
    primitive: 'StatDisplay orientation="horizontal"',
    rule: 'The [label | value] chip; value cell paper.',
    example: <StatDisplay orientation="horizontal" label="Range" value="Close" />,
  },
  {
    kind: 'Capacity bar',
    context: 'sheet',
    primitive: 'VitalGauge',
    rule: 'Segmented current/max; skin sheet|instrument.',
    example: (
      <div className="w-52">
        <VitalGauge label="Cargo" value={Math.ceil(cargo * 0.6)} max={cargo} onChange={noop} />
      </div>
    ),
  },
  {
    kind: 'Status',
    context: 'badge',
    primitive: 'Badge surface="tone"',
    rule: 'Label-only status/keyword; uniform chip.',
    example: (
      <Badge surface="tone" tone="bad">
        Damaged
      </Badge>
    ),
  },
  {
    kind: 'Keyword',
    context: 'cite',
    primitive: 'Tag (= Badge solid)',
    rule: 'A single stamped keyword.',
    example: <Tag label={traitLabel} />,
  },
  {
    kind: 'Tech level',
    context: 'readout',
    primitive: 'StatDisplay horizontal',
    rule: 'Label+value → a Stat, never a badge.',
    example: <StatDisplay orientation="horizontal" label="TL" value={tl} />,
  },
  {
    kind: 'Condition',
    context: 'glyph',
    primitive: 'ConditionSwatch',
    rule: 'Tri-state; fill-shape primary, no gradient.',
    example: (
      <div className="flex gap-2">
        <ConditionSwatch state="intact" className="size-4" />
        <ConditionSwatch state="damaged" className="size-4" />
        <ConditionSwatch state="destroyed" className="size-4" />
      </div>
    ),
  },
  {
    kind: 'Cargo slots',
    context: 'addressable',
    primitive: 'SlotGrid',
    rule: '1 cell = 1 slot; dashed empty / cargo filled.',
    example: <SlotGrid used={Math.ceil(cargo * 0.5)} cap={cargo} />,
  },
  {
    kind: 'Section header',
    context: 'label',
    primitive: 'Stamp',
    rule: 'The one ink label/header atom.',
    example: <Stamp>Systems</Stamp>,
  },
  {
    kind: 'Entity card',
    context: 'listing',
    primitive: 'DisplayCard listing',
    rule: 'Header-only clickable row.',
    example: (
      <div className="w-56">
        <DisplayCard
          listing
          headerBg="bg-su-green"
          headerContent={
            <span className="font-cond font-bold uppercase text-ink">{chassisName}</span>
          }
        />
      </div>
    ),
  },
  {
    kind: 'Roll table',
    context: 'content',
    primitive: 'RollTable',
    rule: 'Banded d20 map; uniform peach/paper.',
    example: rollTable ? (
      <div className="w-80">
        <RollTable
          table={rollTable}
          tableName={rollTableEntity?.name}
          showCommand
          compact
          disabled
        />
      </div>
    ) : null,
  },
]

export const Matrix: Story = () => (
  <div className="bg-paper p-6 font-mono text-ink">
    <Stamp size="lg" as="span">
      Rendering Matrix
    </Stamp>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
      Kind × context → one primitive + rule, with a live render of each. This is the decision table
      for which primitive renders a given shape of data (ruleset §2).
    </p>
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            {['Kind', 'Context', 'Primitive', 'Rule', 'Example'].map((h) => (
              <th key={h} className="p-2 text-xs font-bold uppercase tracking-caps-tight">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}-${row.context}`} className="border-b border-ink/12 align-top">
              <td className="p-2 font-bold">{row.kind}</td>
              <td className="p-2 text-ink-2">{row.context}</td>
              <td className="p-2">
                <code className="rounded-badge bg-ink/8 px-1 py-0.5 text-[12px]">
                  {row.primitive}
                </code>
              </td>
              <td className="max-w-[14rem] p-2 text-ink-2">{row.rule}</td>
              <td className="p-2">{row.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)
