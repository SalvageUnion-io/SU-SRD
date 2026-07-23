import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { Toggle } from './Toggle'

export default {
  title: 'Atoms/Toggle',
}

/** The real dial entries the Dashboard's Configure Dial panel shows/hides. */
const DIAL_ROWS = [
  { id: 'actions', label: 'Actions', locked: true },
  { id: 'mech', label: 'Mech', locked: false },
  { id: 'pilot', label: 'Pilot', locked: false },
  { id: 'crawler', label: 'Crawler', locked: false },
  { id: 'tables', label: 'Tables', locked: false },
]

/** Real systems, for the bare-switch-in-a-dense-row case. */
const systems = SalvageUnionReference.Systems.all()
  .slice(0, 3)
  .map((s) => s.name)

/**
 * Toggle — the bare switch for rows that already frame and label themselves.
 * Contrast with `Checkbox`, which brings its own framed choice-row card.
 */
export const Default: Story = () => {
  const [hidden, setHidden] = useState<Set<string>>(new Set(['crawler']))
  const [powered, setPowered] = useState<Set<string>>(new Set([systems[0] ?? '']))

  function flip(set: Set<string>, id: string) {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }

  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <div className="flex flex-col gap-2">
        <Caption>
          On / off / disabled — the track empties out when disabled rather than fading, so an off
          control never reads as an unfamiliar enabled variant.
        </Caption>
        <div className="flex items-center gap-6">
          <Toggle label="Reactor online" showLabel defaultChecked />
          <Toggle label="Reactor offline" showLabel />
          <Toggle label="Locked on" showLabel disabled checked readOnly />
          <Toggle label="Locked off" showLabel disabled />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Caption>
          In an instrument row — the Dashboard's Configure Dial list. The row supplies its own
          border and condensed-uppercase label; the switch adds nothing around itself.
        </Caption>
        <ul className="flex list-none flex-col gap-1.5 p-0">
          {DIAL_ROWS.map((row) => (
            <li
              key={row.id}
              className="flex items-center gap-2 rounded-card border-chrome border-ink-20 bg-paper px-2.5 py-1.5"
            >
              <Toggle
                label={`Show ${row.label}`}
                checked={row.locked || !hidden.has(row.id)}
                disabled={row.locked}
                onChange={() => setHidden((h) => flip(h, row.id))}
              />
              <span
                className={
                  hidden.has(row.id)
                    ? 'font-cond text-note font-bold uppercase tracking-caps-tight text-ink line-through'
                    : 'font-cond text-note font-bold uppercase tracking-caps-tight text-ink'
                }
              >
                {row.label}
                {row.locked ? ' (locked)' : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <Caption>Label rendered inline, for a settings row that has no label of its own.</Caption>
        <div className="flex flex-col gap-2">
          {systems.map((name) => (
            <Toggle
              key={name}
              label={name}
              showLabel
              checked={powered.has(name)}
              onChange={() => setPowered((p) => flip(p, name))}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
