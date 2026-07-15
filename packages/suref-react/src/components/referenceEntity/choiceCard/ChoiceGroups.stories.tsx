import type { Story } from '@ladle/react'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { ChoiceGroups } from './ChoiceGroups'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/ChoiceGroups',
}

const weaponTypeChoice: SURefObjectChoice = {
  id: 'weapon-type',
  name: 'Weapon Type',
  choiceType: 'permanent',
  schema: ['traits'],
  schemaEntities: ['Ballistic', 'Energy'],
}

const modificationChoice: SURefObjectChoice = {
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

/** Exclusive (single-select) choice — no selection yet, all "Not Chosen". */
export const ExclusiveChoiceUnselected: Story = () => (
  <div className="w-[500px]">
    <ChoiceGroups choices={[weaponTypeChoice]} parent={parent} parentHeaderBg="bg-su-green" />
  </div>
)

/** Exclusive (single-select) choice with a pre-seeded controlled selection. */
export const ExclusiveChoiceSelected: Story = () => (
  <div className="w-[500px]">
    <ChoiceGroups
      choices={[weaponTypeChoice]}
      parent={parent}
      selections={{ 'weapon-type': ['Ballistic'] }}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

/** Multi-select with a resolved (scalesWithField) cap counter, none selected. */
export const MultiSelectWithCap: Story = () => (
  <div className="w-[500px]">
    <ChoiceGroups choices={[modificationChoice]} parent={parent} parentHeaderBg="bg-su-green" />
  </div>
)

/** Multi-select with two options already selected (cap counter reflects it). */
export const MultiSelectPartiallySelected: Story = () => (
  <div className="w-[500px]">
    <ChoiceGroups
      choices={[modificationChoice]}
      parent={parent}
      selections={{ modification: ['Rangefinder', 'Laser Guidance'] }}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const FreeTextChoice: Story = () => (
  <div className="w-[400px]">
    <ChoiceGroups choices={[nameChoice]} parent={parent} parentHeaderBg="bg-su-green" />
  </div>
)

export const FreeTextChoiceReadOnly: Story = () => (
  <div className="w-[400px]">
    <ChoiceGroups
      choices={[nameChoice]}
      parent={parent}
      selections={{ name: ['Rex'] }}
      readOnly
      parentHeaderBg="bg-su-green"
    />
  </div>
)

/** All choice types together, as they render on a real granted-equipment card. */
export const MixedChoiceGroups: Story = () => (
  <div className="w-[500px]">
    <ChoiceGroups
      choices={[weaponTypeChoice, modificationChoice]}
      parent={parent}
      parentHeaderBg="bg-su-green"
    />
  </div>
)

export const Compact: Story = () => (
  <div className="w-[420px]">
    <ChoiceGroups
      choices={[weaponTypeChoice, modificationChoice]}
      parent={parent}
      compact
      parentHeaderBg="bg-su-green"
    />
  </div>
)
