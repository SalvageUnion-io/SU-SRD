/*
 * Ported from packages/component-lib/src/components/shared/Stat.stories.tsx.
 * Every `mode="edit"` cell keeps its stepper column — the steppers render in the
 * resting state, so no interaction is needed to show them.
 */
import { Stat } from 'component-lib'
import type { ReactNode } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'

function useStats() {
  const chassis = SalvageUnionReference.Chassis.all()[0]
  const action = SalvageUnionReference.Actions.all()[0]
  return {
    sp: chassis?.structurePoints ?? 12,
    ep: chassis?.energyPoints ?? 4,
    heat: chassis?.heatCapacity ?? 6,
    range: action?.range?.[0] ?? 'Close',
  }
}

function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex min-h-[52px] items-center">{children}</div>
      <code className="font-body text-nano text-wk-muted">{label}</code>
    </div>
  )
}

function Gallery({ rule, children }: { rule: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 bg-paper p-5 font-body text-ink">
      <p className="max-w-2xl text-xs leading-relaxed text-wk-muted">{rule}</p>
      <div className="flex flex-wrap items-start gap-x-6 gap-y-5">{children}</div>
    </div>
  )
}

/**
 * One component, TWO anatomies — picked by `orientation`. There is no pip mode:
 * use `VitalGauge` for a fill bar and `BayStatus` for a bay tally.
 */
export function Anatomies() {
  const s = useStats()
  return (
    <Gallery rule="One component, two anatomies — the centred value box (default) and the horizontal [label | value] readout.">
      <Cell label="default → box">
        <Stat label="SP" value={s.sp} />
      </Cell>
      <Cell label='mode="edit" → box + steppers'>
        <Stat label="EP" value={Math.ceil(s.ep * 0.5)} max={s.ep} mode="edit" onChange={() => {}} />
      </Cell>
      <Cell label='orientation="horizontal"'>
        <Stat label="RANGE" value={s.range} orientation="horizontal" />
      </Cell>
      <Cell label='horizontal + mode="edit"'>
        <Stat
          label="HP"
          value={7}
          max={10}
          orientation="horizontal"
          mode="edit"
          onChange={() => {}}
        />
      </Cell>
    </Gallery>
  )
}

/**
 * The centred value box. A `max` reads as `current /max` — current prominent,
 * `/max` muted; a bare value centres.
 */
export function ValueBox() {
  const s = useStats()
  return (
    <Gallery rule="The centred value box (default anatomy) — rounded, ink on paper. mode='edit' grows the +/- stepper column.">
      <Cell label="read">
        <Stat label="SP" value={s.sp} />
      </Cell>
      <Cell label="current / max">
        <Stat label="SP" value={Math.ceil(s.sp * 0.5)} max={s.sp} />
      </Cell>
      <Cell label='size="full"'>
        <Stat label="SP" value={s.sp} max={s.sp} size="full" />
      </Cell>
      <Cell label='size="mini"'>
        <Stat label="SP" value={s.sp} size="mini" />
      </Cell>
      <Cell label="disabled">
        <Stat label="SP" value={s.sp} disabled />
      </Cell>
      <Cell label="inverse">
        <Stat label="SP" value={s.sp} inverse />
      </Cell>
      <Cell label="bottomLabel">
        <Stat label="SP" value={s.sp} onClick={() => {}} bottomLabel="MAX" />
      </Cell>
    </Gallery>
  )
}

/**
 * State lives in the BORDER — the only thing that changes between states. Fill,
 * value and stamp stay constant. Which value maps to which state is the
 * consumer's call.
 */
export function States() {
  const s = useStats()
  return (
    <Gallery rule="Default = ink · good (full/at-cap) = mech · modified = rust · caution = status-warn · critical = status-bad.">
      <Cell label="default">
        <Stat label="SP" value={Math.ceil(s.sp * 0.5)} max={s.sp} />
      </Cell>
      <Cell label='state="good"'>
        <Stat label="SP" value={s.sp} max={s.sp} state="good" />
      </Cell>
      <Cell label='state="modified"'>
        <Stat label="TL" value={2} state="modified" />
      </Cell>
      <Cell label='state="caution"'>
        <Stat label="Heat" value={s.heat - 1} max={s.heat} state="caution" />
      </Cell>
      <Cell label='state="critical"'>
        <Stat label="Heat" value={s.heat} max={s.heat} state="critical" />
      </Cell>
      <Cell label="horizontal · critical">
        <Stat label="Heat" value={s.heat} max={s.heat} orientation="horizontal" state="critical" />
      </Cell>
    </Gallery>
  )
}
