import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { CountStepper } from './CountStepper'

/**
 * CountStepper — the `[− n +]` duplicate-quantity control, driven by real
 * equipment so the accessible labels ("Add one …") read as they ship. It
 * normally rides an entity card's controls overlay as a `stepper` control (see In Card).
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Count Stepper',
}

const firstEquipment = () => SalvageUnionReference.Equipment.all()[0]

/** Interactive, bounded 0–3. */
export const Default: Story = () => {
  const subject = firstEquipment()?.name ?? 'Item'
  const [count, setCount] = useState(1)
  return (
    <div className="flex flex-col gap-3">
      <Caption>Bounded 0–3; the ± buttons carry "Add/Remove one {subject}".</Caption>
      <CountStepper subject={subject} count={count} onChange={setCount} max={3} />
    </div>
  )
}

/** The three boundary states side by side (− disabled at the floor, + at the cap). */
export const Bounds: Story = () => {
  const subject = firstEquipment()?.name ?? 'Item'
  return (
    <div className="flex flex-col gap-4">
      <Caption>At floor (0), mid, and cap (3) — the bounding button disables.</Caption>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-start gap-1">
          <span className="font-cond text-label uppercase tracking-caps text-wk-muted">Floor</span>
          <CountStepper subject={subject} count={0} onChange={() => {}} max={3} />
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className="font-cond text-label uppercase tracking-caps text-wk-muted">Mid</span>
          <CountStepper subject={subject} count={2} onChange={() => {}} max={3} />
        </div>
        <div className="flex flex-col items-start gap-1">
          <span className="font-cond text-label uppercase tracking-caps text-wk-muted">Cap</span>
          <CountStepper subject={subject} count={3} onChange={() => {}} max={3} />
        </div>
      </div>
    </div>
  )
}

/**
 * The two surfaces side by side. `instrument` absorbed the former standalone
 * `DamageStepper`: same control, same accessible contract, a looser cluster with
 * a large tabular readout for the dashboard's Take-Damage overlay.
 */
export const Surfaces: Story = () => {
  const [sheet, setSheet] = useState(2)
  const [instrument, setInstrument] = useState(3)
  return (
    <div className="flex flex-col gap-4">
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
    <div className="flex max-w-md flex-col gap-3">
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
