import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { StatDisplay } from './StatDisplay'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Stat Display',
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
    <div className="flex flex-col gap-4 bg-paper p-5 font-mono text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-ink-2">{rule}</p>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">{children}</div>
    </div>
  )
}

/** Both anatomies at a glance — one component, picked by `orientation`. */
export const Anatomies: Story = () => (
  <Gallery rule="One component, TWO anatomies — the centred value box (default) and the horizontal [label | value] readout. No pip mode: use VitalGauge for a fill bar, BayStatus for a bay tally.">
    <Cell label="default → box">
      <StatDisplay label="SP" value={sp} />
    </Cell>
    <Cell label='mode="edit" → box + steppers'>
      <StatDisplay label="EP" value={Math.ceil(ep * 0.5)} max={ep} mode="edit" onChange={noop} />
    </Cell>
    <Cell label='orientation="horizontal"'>
      <StatDisplay label="RANGE" value={rangeLabel} orientation="horizontal" />
    </Cell>
    <Cell label='horizontal + mode="edit"'>
      <StatDisplay
        label="HP"
        value={7}
        max={10}
        orientation="horizontal"
        mode="edit"
        onChange={noop}
      />
    </Cell>
  </Gallery>
)

/** The centred value box (default). value/max; mode="edit" adds the stepper column. */
export const ValueBox: Story = () => (
  <Gallery rule="The centred value box (default anatomy). value / max; mode='edit' grows the +/- stepper column (the former StatControl).">
    <Cell label="read">
      <StatDisplay label="SP" value={sp} />
    </Cell>
    <Cell label="value / max">
      <StatDisplay label="SP" value={Math.ceil(sp * 0.5)} max={sp} />
    </Cell>
    <Cell label="compact">
      <StatDisplay label="SP" value={sp} compact />
    </Cell>
    <Cell label="disabled">
      <StatDisplay label="SP" value={sp} disabled />
    </Cell>
    <Cell label="inverse">
      <StatDisplay label="SP" value={sp} inverse />
    </Cell>
    <Cell label="onClick + bottomLabel">
      <StatDisplay label="SP" value={sp} onClick={noop} bottomLabel="MAX" />
    </Cell>
    <Cell label="isOverMax">
      <StatDisplay label="SP" value={sp + 2} max={sp} isOverMax />
    </Cell>
    <Cell label="hoverText">
      <StatDisplay label="SP" value={sp} hoverText="Structure Points: the mech's health" />
    </Cell>
    <Cell label="colour overrides">
      <StatDisplay
        label="SP"
        value={sp}
        bg="bg-su-green"
        valueColor="text-paper"
        borderColor="border-su-green"
      />
    </Cell>
    <Cell label='mode="edit"'>
      <StatDisplay
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

/** The [label | value] readout — a Stat, never a badge (Tech level, Range, traits). */
export const Horizontal: Story = () => (
  <Gallery rule="orientation='horizontal' → the black/white [label | value] readout (the former ValueDisplay). A Stat, never a badge. With mode='edit' it grows a compact +/- stepper column.">
    <Cell label="range">
      <StatDisplay label="RANGE" value={rangeLabel} orientation="horizontal" />
    </Cell>
    <Cell label="tech level">
      <StatDisplay label="TL" value={tl} orientation="horizontal" />
    </Cell>
    <Cell label="inverse">
      <StatDisplay label="TRAIT" value={traitLabel} orientation="horizontal" inverse />
    </Cell>
    <Cell label='mode="edit" → + steppers'>
      <StatDisplay
        label="HP"
        value={7}
        max={10}
        orientation="horizontal"
        mode="edit"
        onChange={noop}
      />
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
      <StatDisplay orientation="horizontal" label="TL" value={tl} compact />
      <StatDisplay orientation="horizontal" label="SP" value={sp} compact />
      <StatDisplay orientation="horizontal" label="EP" value={ep} compact />
      <StatDisplay orientation="horizontal" label="SV" value={chassis?.salvageValue ?? 2} compact />
      <StatDisplay orientation="horizontal" label="Sys" value={chassis?.systemSlots ?? 7} compact />
      <StatDisplay orientation="horizontal" label="Mod" value={chassis?.moduleSlots ?? 2} compact />
      <StatDisplay orientation="horizontal" label="Cargo" value={cargo} compact />
      <StatDisplay orientation="horizontal" label="Heat" value={heat} compact />
    </div>
  </Gallery>
)
