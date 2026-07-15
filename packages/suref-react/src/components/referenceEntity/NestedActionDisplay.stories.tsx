import type { Story } from '@ladle/react'
import { NestedActionDisplay } from './NestedActionDisplay'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/NestedActionDisplay',
}

// Find a system with visible actions to use as demo data
const systems = SalvageUnionReference.Systems.all()
let sampleAction: SURefMetaAction | undefined
for (const sys of systems) {
  const actions = extractVisibleActions(sys)
  if (actions && actions.length > 0) {
    sampleAction = actions[0]
    break
  }
}

// Fallback mock action
const mockAction: SURefMetaAction = sampleAction ?? {
  id: 'fire-weapon',
  name: 'Fire Weapon',
  activationCost: 1,
  content: [
    { type: 'paragraph', value: 'Make an attack against a target within range.' },
    { type: 'paragraph', value: 'On a hit, deal 3 damage to the target.' },
  ],
}

export const Default: Story = () => (
  <div className="w-[500px] bg-paper p-2">
    <NestedActionDisplay data={mockAction} />
  </div>
)

export const Compact: Story = () => (
  <div className="w-[400px] bg-paper p-2">
    <NestedActionDisplay data={mockAction} compact />
  </div>
)

export const HiddenContent: Story = () => (
  <div className="w-[500px] bg-paper p-2">
    <NestedActionDisplay data={mockAction} hideContent />
  </div>
)
