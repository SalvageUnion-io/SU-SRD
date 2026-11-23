/**
 * PlayPinnedVitals — the live vitals pinned above every pane below `lg`
 * (play.md §11, `pinnedUnits`): what a spend reads, in reach whichever pane
 * is open. One quiet card of five cells (`PhoneVitalsGlance`), the pilot's HP
 * and AP then the mech's SP, EP and Heat. Tapping a cell opens that unit's
 * `PhoneVitals` block under the card (its rows with their − | + at 44px), so
 * the five take one line of the screen until a number has to change; a second
 * tap closes it. A row's number asks for an amount (`PlayVitalAmount`: "take
 * 3" is one write, LG-13). A unit that isn't live is a read-out. From `lg` the Units
 * column holds them, so nothing is pinned.
 */

import { useState } from 'react'
import { SHEET_VITALS } from '../build/sheet/sheetVitals.model'
import { heatDangerFrom, PhoneVitals, PhoneVitalsGlance } from '../components/app'
import type { CSSVarStyle, PhoneVitalCell } from '../components/index'
import { Stat } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayVitalAmount } from './PlayVitalAmount'
import type { PinnedUnit } from './playPanes.model'
import { REACTOR_STATE_TEXT } from './reactorWrites.model'
import { tableUnits } from './tableMode.model'

/** Each vital's words in full, for assistive tech (`PhoneVitals`' `name`). */
const VITAL_NAME: Record<string, string> = {
  HP: SHEET_VITALS.hp.label,
  AP: SHEET_VITALS.ap.label,
  SP: SHEET_VITALS.sp.label,
  EP: SHEET_VITALS.ep.label,
}

const danger = (v: { label: string; max: number }) =>
  v.label === 'Heat' && v.max > 0 ? heatDangerFrom(v.max) : undefined

const tone = (kind: PinnedUnit['kind']) => ({ '--tone': `var(--color-${kind})` }) as CSSVarStyle

export function PlayPinnedVitals({
  units,
  live,
  onWrite,
}: {
  units: readonly PinnedUnit[]
  /** Which units take writes (`usePlayUnits().live`). */
  live: Record<PinnedUnit['kind'], boolean>
  /** The Units pane's write: the unit, the record field, the clamped value, the vital's label. */
  /** `note` is the amount entry's, when what was typed was capped. */
  onWrite: (
    kind: PinnedUnit['kind'],
    field: string,
    next: number,
    label: string,
    note?: string
  ) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  // "Take 3 damage" in one write: an open row's number asks for the amount.
  const [asking, setAsking] = useState<string | null>(null)
  if (units.length === 0) return null
  const all = tableUnits(units).flatMap((unit) => unit.vitals.map((v) => ({ unit, v })))
  const picked = all.find(({ v, unit }) => v.label === open && live[unit.kind])
  const asked = picked?.unit.vitals.find((v) => v.label === asking)
  const cells: PhoneVitalCell[] = all.map(({ unit, v }) => {
    const redline = danger(v)
    return {
      key: v.label,
      label: v.label,
      name: `${unit.name} ${v.label}`,
      value: v.value,
      max: v.max,
      style: tone(unit.kind),
      hot: redline !== undefined && v.value > redline,
      open: picked?.v.label === v.label,
      ...(live[unit.kind] ? { onPress: () => setOpen(open === v.label ? null : v.label) } : {}),
    }
  })
  // A mech's Shut down and Vulnerable, under the five (r7 B2).
  const states = units.flatMap((unit) => unit.states ?? [])
  return (
    <section aria-label={playCopy('pinnedVitals')} className="su-play-pins">
      <PhoneVitalsGlance cells={cells} />
      {states.length > 0 ? (
        <div className="su-play-pins__states">
          {states.map((state) => (
            <Stat key={state} size="mini" state="critical" label={REACTOR_STATE_TEXT[state]} />
          ))}
        </div>
      ) : null}
      {picked && asked ? (
        <div className="su-play-pins__amount" style={tone(picked.unit.kind)}>
          <PlayVitalAmount
            label={asked.label}
            value={asked.value}
            max={asked.max}
            onChange={(next, note) =>
              onWrite(picked.unit.kind, asked.field, next, asked.label, note)
            }
            onClose={() => setAsking(null)}
            size="full"
          />
        </div>
      ) : picked ? (
        <PhoneVitals
          label={playCopy('sVitals', { name: picked.unit.name })}
          style={tone(picked.unit.kind)}
          vitals={picked.unit.vitals.map((v) => ({
            key: v.label.toLowerCase(),
            label: v.label,
            name: `${picked.unit.name} ${VITAL_NAME[v.label] ?? v.label}`,
            value: v.value,
            max: v.max,
            ...(danger(v) !== undefined ? { danger: danger(v) } : {}),
            onChange: (next: number) => onWrite(picked.unit.kind, v.field, next, v.label),
            onValuePress: () => setAsking(v.label),
          }))}
        />
      ) : null}
    </section>
  )
}
