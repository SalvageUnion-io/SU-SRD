import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, font, fontSize, space, tracking } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { CountStepper } from './CountStepper'

/**
 * CountStepper — the `[− n +]` duplicate-quantity control, driven by real
 * equipment so the accessible labels ("Add one …") read as they ship. It
 * normally rides an entity card's controls overlay as a `stepper` control (see In Card).
 */
export default {
  title: 'Atoms/Count Stepper',
}

const firstEquipment = () => SalvageUnionReference.Equipment.all()[0]

const stack = (gap: string) =>
  ({ display: 'flex', flexDirection: 'column', gap }) satisfies CSSProperties

const BOUNDS_ROW = { alignItems: 'center', display: 'flex', gap: space[24] } satisfies CSSProperties

const BOUND = {
  alignItems: 'flex-start',
  display: 'flex',
  flexDirection: 'column',
  gap: space[4],
} satisfies CSSProperties

const BOUND_LABEL = {
  color: color.wkMuted,
  fontFamily: font.cond,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** Interactive, bounded 0–3. */
export const Default: Story = () => {
  const subject = firstEquipment()?.name ?? 'Item'
  const [count, setCount] = useState(1)
  return (
    <div style={stack(space[12])}>
      <Caption>Bounded 0–3; the ± buttons carry "Add/Remove one {subject}".</Caption>
      <CountStepper subject={subject} count={count} onChange={setCount} max={3} />
    </div>
  )
}

/** The three boundary states side by side (− disabled at the floor, + at the cap). */
export const Bounds: Story = () => {
  const subject = firstEquipment()?.name ?? 'Item'
  return (
    <div style={stack(space[16])}>
      <Caption>At floor (0), mid, and cap (3) — the bounding button disables.</Caption>
      <div style={BOUNDS_ROW}>
        <div style={BOUND}>
          <span style={BOUND_LABEL}>Floor</span>
          <CountStepper subject={subject} count={0} onChange={() => {}} max={3} />
        </div>
        <div style={BOUND}>
          <span style={BOUND_LABEL}>Mid</span>
          <CountStepper subject={subject} count={2} onChange={() => {}} max={3} />
        </div>
        <div style={BOUND}>
          <span style={BOUND_LABEL}>Cap</span>
          <CountStepper subject={subject} count={3} onChange={() => {}} max={3} />
        </div>
      </div>
    </div>
  )
}

/**
 * The two surfaces side by side. `instrument` is the same control and the same
 * accessible contract, as a looser cluster with a large tabular readout for the
 * dashboard's Take-Damage overlay.
 */
export const Surfaces: Story = () => {
  const [sheet, setSheet] = useState(2)
  const [instrument, setInstrument] = useState(3)
  return (
    <div style={stack(space[16])}>
      <Caption>
        `sheet` (default) — the joined ink pill that rides an entity card's controls overlay.
      </Caption>
      <CountStepper subject="Assault Rifle" count={sheet} onChange={setSheet} max={5} />
      <Caption>
        `instrument` — the dashboard overlay cluster, floored at 1 (damage is never zero).
      </Caption>
      <CountStepper
        subject="damage point"
        count={instrument}
        onChange={setInstrument}
        min={1}
        surface="instrument"
      />
    </div>
  )
}

/** In its real home: an entity card's controls overlay, with the `selected` ring. */
export const InCard: Story = () => {
  const item = firstEquipment()
  const [count, setCount] = useState(2)
  if (!item) return <Caption>Equipment fixture missing.</Caption>
  return (
    <div style={{ ...stack(space[12]), maxWidth: '28rem' }}>
      <Caption>
        How pickers use it — a CountStepper `stepper` control on the card, native selected ring.
      </Caption>
      <ReferenceEntityCard
        data={item}
        size="medium"
        selected={count > 0}
        hide={{ actions: true, choices: true }}
        controls={[
          { key: 'qty', stepper: { subject: item.name, count, onChange: setCount, max: 5 } },
        ]}
      />
    </div>
  )
}
