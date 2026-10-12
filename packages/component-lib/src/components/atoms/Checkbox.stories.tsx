import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Checkbox, Radio } from './Checkbox'

export default {
  title: 'Atoms/Checkbox',
}

const stack = (gap: string) =>
  ({ display: 'flex', flexDirection: 'column', gap }) satisfies CSSProperties

const PAGE = {
  ...stack(space[32]),
  backgroundColor: color.paper,
  maxWidth: '28rem',
  padding: space[32],
} satisfies CSSProperties

/** Real chassis, for the one-of-many radio group. */
const chassis = SalvageUnionReference.Chassis.all()
  .slice(0, 4)
  .map((c) => ({
    name: c.name,
    tl: c.techLevel,
  }))

/** Real systems, for the multi-select checkbox column. */
const systems = SalvageUnionReference.Systems.all()
  .slice(0, 4)
  .map((s) => s.name)

/** Checkbox (multi-select) and Radio (one-of-many) — one framed-row skin, two semantics. */
export const Default: Story = () => {
  const [chosenChassis, setChosenChassis] = useState(chassis[0]?.name ?? '')
  const [loadout, setLoadout] = useState<Set<string>>(new Set([systems[0] ?? '']))

  function toggle(name: string) {
    setLoadout((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  return (
    <div style={PAGE}>
      <div style={stack(space[8])}>
        <Caption>
          Radio — choose one chassis (name shares a group; arrow keys move between).
        </Caption>
        <div style={stack(space[8])}>
          {chassis.map((c) => (
            <Radio
              key={c.name}
              name="chassis"
              value={c.name}
              checked={chosenChassis === c.name}
              onChange={() => setChosenChassis(c.name)}
              label={c.name}
              description={c.tl != null ? `TL ${c.tl}` : undefined}
            />
          ))}
        </div>
      </div>

      <div style={stack(space[8])}>
        <Caption>Checkbox — multi-select systems for a loadout (independent toggles).</Caption>
        <div style={stack(space[8])}>
          {systems.map((name) => (
            <Checkbox
              key={name}
              value={name}
              checked={loadout.has(name)}
              onChange={() => toggle(name)}
              label={name}
            />
          ))}
        </div>
      </div>

      <div style={stack(space[8])}>
        <Caption>Disabled — native disabled attribute on the same row.</Caption>
        <Checkbox label="Reinforced Chassis" description="Locked" disabled checked readOnly />
      </div>
    </div>
  )
}
