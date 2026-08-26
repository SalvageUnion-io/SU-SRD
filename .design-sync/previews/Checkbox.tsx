/*
 * Ported from packages/component-lib/src/components/chrome/Checkbox.stories.tsx.
 * The story drives selection with `useState`; a card is a still image, so the
 * settled state is expressed with `checked` + `readOnly` instead.
 */
import { Checkbox } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Group, Stack } from '../preview-lib/harness'

/**
 * Multi-select. One framed-row skin shared with `Radio` — the difference is
 * semantics: independent toggles here, one-of-many there.
 */
export function Loadout() {
  const systems = SalvageUnionReference.Systems.all()
    .slice(0, 4)
    .map((s) => s.name)
  const chosen = new Set([systems[0], systems[2]])
  return (
    <div className="flex max-w-md flex-col gap-8 bg-paper p-8">
      <Group caption="multi-select systems for a loadout (independent toggles)">
        <div className="space-y-2">
          {systems.map((name) => (
            <Checkbox key={name} value={name} checked={chosen.has(name)} readOnly label={name} />
          ))}
        </div>
      </Group>
      <Group caption="disabled — native disabled attribute on the same row">
        <Checkbox label="Reinforced Chassis" description="Locked" disabled checked readOnly />
      </Group>
    </div>
  )
}

/** Unchecked, checked, described, and disabled — the whole row vocabulary. */
export function States() {
  const systems = SalvageUnionReference.Systems.all()
    .slice(0, 2)
    .map((s) => s.name)
  return (
    <div className="flex max-w-md flex-col gap-3 bg-paper p-8">
      <Checkbox label={systems[0] ?? 'System'} checked={false} readOnly />
      <Checkbox label={systems[1] ?? 'System'} checked readOnly />
      <Checkbox label="Mining Laser" description="TL 2 · 2 slots" checked readOnly />
      <Checkbox label="Reinforced Chassis" description="Locked" disabled checked readOnly />
    </div>
  )
}
