import type { Story } from '@ladle/react'
import { NestedActionDisplay } from './NestedActionDisplay'
import { SalvageUnionReference, extractVisibleActions } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/NestedActionDisplay',
}

// A real action off the first system that has one.
let action: SURefMetaAction | undefined
for (const sys of SalvageUnionReference.Systems.all()) {
  const actions = extractVisibleActions(sys)
  if (actions && actions.length > 0) {
    action = actions[0]
    break
  }
}
const mockAction: SURefMetaAction = action ?? {
  id: 'fire-weapon',
  name: 'Fire Weapon',
  activationCost: 1,
  content: [{ type: 'paragraph', value: 'Make an attack against a target within range.' }],
}

/** The nested action row across its densities — default, compact, header-only. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      The left-border nested action block. compact tightens spacing; hideContent drops the body to a
      header-only row.
    </p>
    <div className="flex flex-col gap-1.5">
      <div className="w-[480px]">
        <NestedActionDisplay data={mockAction} />
      </div>
      <code className="font-mono text-nano text-ink-2">default</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="w-[400px]">
        <NestedActionDisplay data={mockAction} compact />
      </div>
      <code className="font-mono text-nano text-ink-2">compact</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="w-[480px]">
        <NestedActionDisplay data={mockAction} hideContent />
      </div>
      <code className="font-mono text-nano text-ink-2">hideContent</code>
    </div>
  </div>
)
