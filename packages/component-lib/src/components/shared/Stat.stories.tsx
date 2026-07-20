import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Stat } from './Stat'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Stat',
}

// Real SRD content drives every anatomy below (reference data is preloaded by
// .ladle/components.tsx before this chunk imports).
const chassis = SalvageUnionReference.Chassis.all()[0]
const sp = chassis?.structurePoints ?? 12
const ep = chassis?.energyPoints ?? 4
const heat = chassis?.heatCapacity ?? 6
const cargo = chassis?.cargoCapacity ?? 16
const tl = chassis?.techLevel ?? 1

// A real weapon action supplies a real range + trait keyword for the horizontal split-stat.
const weaponAction = SalvageUnionReference.Actions.all()[0]
const rangeLabel = weaponAction?.range?.[0] ?? 'Close'
const traitLabel = weaponAction?.traits?.[0]?.type ?? 'ballistic'

const noop = () => {}

// Each option is captioned with the prop combo that selects it, so the story
// doubles as the prop reference. Every gallery leads with its governing rule.
function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex min-h-[52px] items-center">{children}</div>
      <code className="text-nano text-ink-2">{label}</code>
    </div>
  )
}

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 font-body text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">{rule}</p>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">{children}</div>
    </div>
  )
}

/** Both anatomies at a glance — one component, picked by `orientation`. */
export const Anatomies: Story = () => (
  <Gallery rule="One component, TWO anatomies — the centred value box (default) and the horizontal [label | value] readout. No pip mode: use VitalGauge for a fill bar, BayStatus for a bay tally.">
    <Cell label="default → box">
      <Stat label="SP" value={sp} />
    </Cell>
    <Cell label='mode="edit" → box + steppers'>
      <Stat label="EP" value={Math.ceil(ep * 0.5)} max={ep} mode="edit" onChange={noop} />
    </Cell>
    <Cell label='orientation="horizontal"'>
      <Stat label="RANGE" value={rangeLabel} orientation="horizontal" />
    </Cell>
    <Cell label='horizontal + mode="edit"'>
      <Stat label="HP" value={7} max={10} orientation="horizontal" mode="edit" onChange={noop} />
    </Cell>
  </Gallery>
)

/** The centred value box (default). A `max` reads as `current /max`; mode="edit" adds steppers. */
export const ValueBox: Story = () => (
  <Gallery rule="The centred value box (default anatomy) — rounded, ink on paper. A max renders as current /max (current prominent, /max muted); a bare value centres. mode='edit' grows the +/- stepper column (the former StatControl).">
    <Cell label="read">
      <Stat label="SP" value={sp} />
    </Cell>
    <Cell label="current / max">
      <Stat label="SP" value={Math.ceil(sp * 0.5)} max={sp} />
    </Cell>
    <Cell label="compact">
      <Stat label="SP" value={sp} compact />
    </Cell>
    <Cell label="disabled">
      <Stat label="SP" value={sp} disabled />
    </Cell>
    <Cell label="inverse">
      <Stat label="SP" value={sp} inverse />
    </Cell>
    <Cell label="onClick + bottomLabel">
      <Stat label="SP" value={sp} onClick={noop} bottomLabel="MAX" />
    </Cell>
    <Cell label="hoverText">
      <Stat label="SP" value={sp} hoverText="Structure Points: the mech's health" />
    </Cell>
    <Cell label='mode="edit"'>
      <Stat
        label="EP"
        value={Math.ceil(ep * 0.5)}
        max={ep}
        mode="edit"
        onChange={noop}
        bottomLabel="MAX"
      />
    </Cell>
  </Gallery>
)

/** State lives in the border — the ONLY thing that changes between states. */
export const States: Story = () => (
  <Gallery rule="State is carried entirely by the border colour via the `state` prop; fill, value and stamp stay constant. Default = ink · good (full/at-cap) = mech · modified = rust · caution = status-warn · critical = status-bad. Which value maps to which state is the consumer's call.">
    <Cell label="default">
      <Stat label="SP" value={Math.ceil(sp * 0.5)} max={sp} />
    </Cell>
    <Cell label='state="good"'>
      <Stat label="SP" value={sp} max={sp} state="good" />
    </Cell>
    <Cell label='state="modified"'>
      <Stat label="TL" value={2} state="modified" />
    </Cell>
    <Cell label='state="caution"'>
      <Stat label="Heat" value={heat - 1} max={heat} state="caution" />
    </Cell>
    <Cell label='state="critical"'>
      <Stat label="Heat" value={heat} max={heat} state="critical" />
    </Cell>
    <Cell label="compact · critical">
      <Stat label="Heat" value={heat} max={heat} orientation="horizontal" state="critical" />
    </Cell>
  </Gallery>
)

/** The [label | value] readout — a Stat, never a badge (Tech level, Range, traits). */
export const Horizontal: Story = () => (
  <Gallery rule="orientation='horizontal' → the rounded [label | value] cell (the former ValueDisplay). Ink on paper, a max reads as value /max, state rides the border. With mode='edit' it grows a compact +/- stepper column.">
    <Cell label="range">
      <Stat label="RANGE" value={rangeLabel} orientation="horizontal" />
    </Cell>
    <Cell label="tech level">
      <Stat label="TL" value={tl} orientation="horizontal" />
    </Cell>
    <Cell label="value / max">
      <Stat label="Heat" value={heat} max={heat} orientation="horizontal" />
    </Cell>
    <Cell label="inverse">
      <Stat label="TRAIT" value={traitLabel} orientation="horizontal" inverse />
    </Cell>
    <Cell label='mode="edit" → + steppers'>
      <Stat label="HP" value={7} max={10} orientation="horizontal" mode="edit" onChange={noop} />
    </Cell>
  </Gallery>
)

/** How a full mech's stats read as a compact header cluster — always TWO rows,
 *  columns = ceil(count/2). Eight stats → 2 rows of 4 (the top-right axis on a
 *  compact/nested card). Driven by the real chassis fixture. */
export const CompactHeaderCluster: Story = () => (
  <Gallery rule="A full mech's stats as the compact header cluster — always TWO rows, columns = ceil(count/2). Eight stats → 2 rows of 4 (the top-right axis on a compact/nested card).">
    <div
      className="grid w-fit justify-items-end gap-1"
      style={{ gridTemplateColumns: 'repeat(4, max-content)' }}
    >
      <Stat orientation="horizontal" label="TL" value={tl} compact />
      <Stat orientation="horizontal" label="SP" value={sp} compact />
      <Stat orientation="horizontal" label="EP" value={ep} compact />
      <Stat orientation="horizontal" label="SV" value={chassis?.salvageValue ?? 2} compact />
      <Stat orientation="horizontal" label="Sys" value={chassis?.systemSlots ?? 7} compact />
      <Stat orientation="horizontal" label="Mod" value={chassis?.moduleSlots ?? 2} compact />
      <Stat orientation="horizontal" label="Cargo" value={cargo} compact />
      <Stat orientation="horizontal" label="Heat" value={heat} compact />
    </div>
  </Gallery>
)
