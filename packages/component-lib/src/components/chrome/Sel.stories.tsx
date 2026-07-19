import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { ReferenceEntityCard } from '../referenceEntity/card/ReferenceEntityCard'
import { Sel } from './Sel'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Sel',
}

/**
 * Real SRD entity lookup (data drift safety) — throws instead of silently
 * rendering `undefined` if a schema is ever empty.
 */
function pick<T>(list: T[], index: number, schemaName: string): T {
  const found = list[index]
  if (found === undefined) throw new Error(`Sel story: no ${schemaName} entities loaded`)
  return found
}

// Real SRD subjects — reference data is preloaded by .ladle/components.tsx.
const chassis = pick(SalvageUnionReference.Chassis.all(), 0, 'chassis')
const pilotClassA = pick(SalvageUnionReference.Classes.all(), 0, 'class')
const pilotClassB = pick(SalvageUnionReference.Classes.all(), 1, 'class')

/**
 * `Sel` — the selection-ring wrapper for wizard entity cards: a 3px rust
 * box-shadow ring that doesn't shift layout. Shown selected + unselected on a
 * real entity card (the way the wizard renders it), and in interactive
 * (button/radio) vs static form.
 */
export const Default: Story = () => {
  const [picked, setPicked] = useState(true)
  const [chosenClass, setChosenClass] = useState(pilotClassA.name)
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div>
        <Caption>static (no onToggle)</Caption>
        <div className="flex flex-col gap-3">
          <Sel selected={false}>
            <ReferenceEntityCard data={chassis} size="compact" />
          </Sel>
          <Sel selected>
            <ReferenceEntityCard data={chassis} size="compact" />
          </Sel>
        </div>
      </div>
      <div>
        <Caption>interactive — button (aria-pressed)</Caption>
        <Sel selected={picked} onToggle={() => setPicked((s) => !s)} ariaLabel={chassis.name}>
          <ReferenceEntityCard data={chassis} size="compact" />
        </Sel>
      </div>
      <div>
        <Caption>interactive — radio (aria-checked)</Caption>
        <div role="radiogroup" aria-label="Pilot class" className="flex flex-col gap-3">
          {[pilotClassA, pilotClassB].map((pilotClass) => (
            <Sel
              key={pilotClass.name}
              selected={chosenClass === pilotClass.name}
              onToggle={() => setChosenClass(pilotClass.name)}
              radio
              ariaLabel={pilotClass.name}
            >
              <ReferenceEntityCard data={pilotClass} size="compact" />
            </Sel>
          ))}
        </div>
      </div>
    </div>
  )
}
