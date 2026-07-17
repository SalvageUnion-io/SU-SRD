import type { Story } from '@ladle/react'
import type { ReactNode } from 'react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { ChoiceGroups } from './ChoiceGroups'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Choice Groups',
}

// Real Salvage Union choice vocabulary (traits, TL-scaled modifications).
const weaponType: SURefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  choiceType: 'permanent',
  schema: ['traits'],
  schemaEntities: ['Ballistic', 'Energy'],
}
const modification: SURefObjectChoice = {
  id: 'modification',
  name: 'Modification',
  choiceType: 'permanent',
  multiSelect: true,
  constraints: { scalesWithField: 'techLevel' },
  choiceOptions: [
    { label: 'Rangefinder', value: 'Rangefinder', description: 'Increases Range to Far.' },
    { label: 'Laser Guidance', value: 'Laser Guidance', description: 'Spend 2 AP to hit.' },
    { label: 'High Calibre Rounds', value: 'High Calibre Rounds', description: '+1 SP damage.' },
  ],
}
const nameChoice: SURefObjectChoice = {
  id: 'name',
  name: 'Name',
  choiceType: 'freeform',
  content: [{ type: 'paragraph', value: 'The name of your companion.' }],
}
const parent = { techLevel: 2 }

function Row({
  label,
  width = 'w-[500px]',
  children,
}: {
  label: string
  width?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={width}>{children}</div>
      <code className="font-mono text-nano text-ink-2">{label}</code>
    </div>
  )
}

/** Each choice type × its states — exclusive, multi-select (capped), free-text. */
export const Types: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      Exclusive (single-select), multi-select (with a scalesWithField cap counter), and free-text
      choices — unselected vs a pre-seeded controlled selection.
    </p>
    <Row label="exclusive · unselected">
      <ChoiceGroups choices={[weaponType]} parent={parent} toneColor="var(--color-tl-3)" />
    </Row>
    <Row label="exclusive · selected (Ballistic)">
      <ChoiceGroups
        choices={[weaponType]}
        parent={parent}
        selections={{ 'weapon-type': ['Ballistic'] }}
        toneColor="var(--color-tl-3)"
      />
    </Row>
    <Row label="multi-select · capped, none chosen">
      <ChoiceGroups choices={[modification]} parent={parent} toneColor="var(--color-tl-3)" />
    </Row>
    <Row label="multi-select · two chosen">
      <ChoiceGroups
        choices={[modification]}
        parent={parent}
        selections={{ modification: ['Rangefinder', 'Laser Guidance'] }}
        toneColor="var(--color-tl-3)"
      />
    </Row>
    <Row label="free-text · editable" width="w-[400px]">
      <ChoiceGroups choices={[nameChoice]} parent={parent} toneColor="var(--color-tl-3)" />
    </Row>
    <Row label="free-text · read-only" width="w-[400px]">
      <ChoiceGroups
        choices={[nameChoice]}
        parent={parent}
        selections={{ name: ['Rex'] }}
        readOnly
        toneColor="var(--color-tl-3)"
      />
    </Row>
  </div>
)

/** All choice types together on one granted card — full and compact. */
export const Composed: Story = () => (
  <div className="flex flex-col gap-6 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      Multiple choices as they render on a real granted-equipment card; compact tightens for
      listings.
    </p>
    <Row label="mixed">
      <ChoiceGroups
        choices={[weaponType, modification]}
        parent={parent}
        toneColor="var(--color-tl-3)"
      />
    </Row>
    <Row label="compact" width="w-[420px]">
      <ChoiceGroups
        choices={[weaponType, modification]}
        parent={parent}
        compact
        toneColor="var(--color-tl-3)"
      />
    </Row>
  </div>
)
