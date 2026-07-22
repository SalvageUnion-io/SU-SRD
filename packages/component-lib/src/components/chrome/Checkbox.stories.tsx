import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Checkbox, Radio } from './Checkbox'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Checkbox',
}

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
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <div className="flex flex-col gap-2">
        <Caption>
          Radio — choose one chassis (name shares a group; arrow keys move between).
        </Caption>
        <div className="space-y-2">
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

      <div className="flex flex-col gap-2">
        <Caption>Checkbox — multi-select systems for a loadout (independent toggles).</Caption>
        <div className="space-y-2">
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

      <div className="flex flex-col gap-2">
        <Caption>Disabled — native disabled attribute on the same row.</Caption>
        <Checkbox label="Reinforced Chassis" description="Locked" disabled checked readOnly />
      </div>
    </div>
  )
}
