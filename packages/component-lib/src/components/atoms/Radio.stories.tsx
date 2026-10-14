import type { CSSProperties } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color, space } from '../../design/tokens'
import type { Story } from '../../stories/_harness'
import { Caption } from '../../stories/_harness'
import { Radio } from './Radio'

export default {
  title: 'Atoms/Radio',
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

/** Radio (one-of-many) — the framed choice row. */
export const Default: Story = () => {
  const [chosenChassis, setChosenChassis] = useState(chassis[0]?.name ?? '')

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
    </div>
  )
}
