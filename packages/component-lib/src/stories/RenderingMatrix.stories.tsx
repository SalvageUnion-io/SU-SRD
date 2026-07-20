import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

import { Stat } from '../components/shared/Stat'
import { VitalGauge } from '../components/stat/VitalGauge'
import { BayStatus } from '../components/stat/BayStatus'
import { Badge } from '../components/chrome/Badge'
import { ConditionSwatch } from '../components/stat/ConditionSwatch'
import { SlotGrid } from '../components/shared/SlotGrid'
import { RollTable } from '../components/shared/RollTable'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Foundations/Rendering Matrix',
}

const noop = () => {}

// Real reference data drives every live example (preloaded by .ladle/components.tsx).
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 13
const cargo = chassis?.cargoCapacity ?? 16
const tl = chassis?.techLevel ?? 1
const trait = SalvageUnionReference.Traits.all()[0]
const traitLabel = (trait?.name ?? 'Ballistic').toUpperCase()
const rollTableEntity = SalvageUnionReference.RollTables.all()[0]
const rollTable = rollTableEntity && 'table' in rollTableEntity ? rollTableEntity.table : undefined

// A row is a ROLE — the job a piece of data does on screen. Each role maps to
// exactly one primitive; `when` is the situation that picks its anatomy, `rule`
// tailors it. Instances collapse into their role (a Tech level is not a role —
// it's the Stat/label|value role, so it lives on that row).
type MatrixRow = {
  role: string
  when: string
  use: string
  rule: string
  example: ReactNode
}

const rows: MatrixRow[] = [
  {
    role: 'Stat',
    when: 'read',
    use: 'Stat',
    rule: 'Square value box; value / max, no pip track.',
    example: <Stat label="SP" value={Math.ceil(sp * 0.7)} max={sp} />,
  },
  {
    role: 'Stat',
    when: 'interactive',
    use: 'Stat mode="edit"',
    rule: 'Value box + steppers, no pips (was StatControl).',
    example: <Stat label="HP" value={8} max={10} mode="edit" onChange={noop} />,
  },
  {
    role: 'Stat',
    when: 'bay tally',
    use: 'BayStatus',
    rule: 'The crawler-bay condition tally (intact / damaged / destroyed) — its own primitive, not a Stat mode.',
    example: <BayStatus states={['intact', 'intact', 'damaged', 'destroyed']} />,
  },
  {
    role: 'Stat',
    when: 'label | value',
    use: 'Stat orientation="horizontal"',
    rule: 'The printed [label | value] readout — a Stat, never a badge (Tech level, Range, …).',
    example: <Stat orientation="horizontal" label="TL" value={tl} />,
  },
  {
    role: 'Capacity',
    when: 'sheet',
    use: 'VitalGauge',
    rule: 'Segmented current/max; skin sheet|instrument.',
    example: (
      <div className="w-52">
        <VitalGauge label="Cargo" value={Math.ceil(cargo * 0.6)} max={cargo} onChange={noop} />
      </div>
    ),
  },
  {
    role: 'Status',
    when: 'badge',
    use: 'Badge surface="tone"',
    rule: 'Label-only status/keyword; uniform chip.',
    example: (
      <Badge surface="tone" tone="bad">
        Damaged
      </Badge>
    ),
  },
  {
    role: 'Keyword',
    when: 'cite',
    use: 'Badge (solid, the default)',
    rule: 'A single stamped keyword — the solid Badge.',
    example: <Badge>{traitLabel}</Badge>,
  },
  {
    role: 'Condition',
    when: 'glyph',
    use: 'ConditionSwatch',
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
    role: 'Slots',
    when: 'addressable',
    use: 'SlotGrid',
    rule: '1 cell = 1 slot; dashed empty / filled.',
    example: <SlotGrid used={Math.ceil(cargo * 0.5)} cap={cargo} />,
  },
  {
    role: 'Label / header',
    when: '—',
    use: 'Badge shape="stamp"',
    rule: 'The one ink label/header atom — the square Badge.',
    example: <Badge shape="stamp">Systems</Badge>,
  },
  {
    role: 'Roll table',
    when: 'content',
    use: 'RollTable',
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

export const Default: Story = () => (
  <div className="bg-paper p-6 font-body text-ink">
    <Badge shape="stamp" size="full" as="span">
      Rendering Matrix
    </Badge>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-2">
      <span className="font-bold text-ink">What to use, when.</span> Every UI <em>role</em> — the
      job a piece of data does on screen — maps to exactly one primitive, with a live render of
      each; the rule tailors it to context. Instances collapse into their role (ruleset §2).
    </p>
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-ink text-left">
            {['Role', 'When', 'Use', 'Rule', 'Example'].map((h) => (
              <th key={h} className="p-2 text-xs font-bold uppercase tracking-caps-tight">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.role}-${row.when}`} className="border-b border-ink/12 align-top">
              <td className="p-2 font-bold">{row.role}</td>
              <td className="p-2 text-ink-2">{row.when}</td>
              <td className="p-2">
                <code className="rounded-badge bg-ink/8 px-1 py-0.5 text-[12px]">{row.use}</code>
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
