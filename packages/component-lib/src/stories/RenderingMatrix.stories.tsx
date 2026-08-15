import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Badge } from '../components/chrome/Badge'
import { RollTable } from '../components/shared/RollTable'
import { SlotGrid } from '../components/shared/SlotGrid'
import { Stat } from '../components/shared/Stat'
import { BayStatus } from '../components/stat/BayStatus'
import { ConditionSwatch } from '../components/stat/ConditionSwatch'
import { VitalGauge } from '../components/stat/VitalGauge'
import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from '../design/tokens'

export default {
  title: 'Foundations/Rendering Matrix',
}

// Migrated off Tailwind in #799 (epic #802). The table chrome is static — no
// hover, no breakpoint, no pseudo-element — so all of it lands in style
// objects and this page needs no stylesheet class of its own.

const cellStyle = { padding: space[8] } satisfies CSSProperties

/** `size-4` — 16px square. */
const swatchSize = { height: space[16], width: space[16] } satisfies CSSProperties

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
      <div style={{ width: '208px' }}>
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
      // `size-4` is 16px. ConditionSwatch keeps its `className` sizing override
      // (that is its API, and it migrates with the Atoms layer); the call site
      // reaches the same size through `style`, which it already accepts.
      <div style={{ display: 'flex', gap: space[8] }}>
        <ConditionSwatch state="intact" style={swatchSize} />
        <ConditionSwatch state="damaged" style={swatchSize} />
        <ConditionSwatch state="destroyed" style={swatchSize} />
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
      <div style={{ width: '320px' }}>
        <RollTable
          table={rollTable}
          tableName={rollTableEntity?.name}
          showCommand
          size="compact"
          disabled
        />
      </div>
    ) : null,
  },
]

export const Default: Story = () => (
  <div
    style={{
      backgroundColor: color.paper,
      color: color.ink,
      fontFamily: font.body,
      padding: space[24],
    }}
  >
    <Badge shape="stamp" size="full" as="span">
      Rendering Matrix
    </Badge>
    <p
      style={{
        color: color.wkMuted,
        fontSize: fontSize.sm,
        lineHeight: 1.625,
        marginTop: space[12],
        maxWidth: '42rem',
      }}
    >
      <span style={{ color: color.ink, fontWeight: weight.bold }}>What to use, when.</span> Every UI{' '}
      <em>role</em> — the job a piece of data does on screen — maps to exactly one primitive, with a
      live render of each; the rule tailors it to context. Instances collapse into their role
      (ruleset §2).
    </p>
    <div style={{ marginTop: space[20], overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: fontSize.sm,
          minWidth: '52rem',
          width: '100%',
        }}
      >
        <thead>
          <tr style={{ borderBottom: `${borderWidth.pill} solid ${color.ink}`, textAlign: 'left' }}>
            {['Role', 'When', 'Use', 'Rule', 'Example'].map((h) => (
              <th
                key={h}
                style={{
                  ...cellStyle,
                  fontSize: fontSize.xs,
                  fontWeight: weight.bold,
                  letterSpacing: tracking.capsTight,
                  textTransform: 'uppercase',
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={`${row.role}-${row.when}`}
              style={{
                borderBottom: `${borderWidth.hairline} solid ${color.ink12}`,
                verticalAlign: 'top',
              }}
            >
              <td style={{ ...cellStyle, fontWeight: weight.bold }}>{row.role}</td>
              <td style={{ ...cellStyle, color: color.wkMuted }}>{row.when}</td>
              <td style={cellStyle}>
                <code
                  style={{
                    backgroundColor: color.ink8,
                    borderRadius: radius.badge,
                    fontSize: fontSize.xs,
                    padding: `${space[2]} ${space[4]}`,
                  }}
                >
                  {row.use}
                </code>
              </td>
              <td style={{ ...cellStyle, color: color.wkMuted, maxWidth: '14rem' }}>{row.rule}</td>
              <td style={cellStyle}>{row.example}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)
