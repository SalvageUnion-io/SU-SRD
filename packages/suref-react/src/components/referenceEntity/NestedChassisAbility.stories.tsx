import type { Story } from '@ladle/react'
import { NestedChassisAbility } from './NestedChassisAbility'
import { SalvageUnionReference, getChassisAbilities } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/NestedChassisAbility',
}

// Find a chassis with abilities
const chassisEntities = SalvageUnionReference.Chassis.all()
let sampleAbility: SURefMetaAction | undefined
let sampleChassisName: string | undefined
for (const c of chassisEntities) {
  const abilities = getChassisAbilities(c)
  if (abilities && abilities.length > 0) {
    sampleAbility = abilities[0]
    sampleChassisName = 'name' in c ? String(c.name) : undefined
    break
  }
}

// Fallback mock
const mockAbility: SURefMetaAction = sampleAbility ?? {
  id: 'armored-hull',
  name: 'Armored Hull',
  activationCost: 1,
  content: [
    {
      type: 'paragraph',
      value: 'Reduce incoming damage by 1 until end of turn.',
    },
  ],
}

export const Default: Story = () => (
  <div className="w-[500px]">
    <NestedChassisAbility data={mockAbility} chassisName={sampleChassisName ?? 'Salvager'} />
  </div>
)

export const Compact: Story = () => (
  <div className="w-[400px]">
    <NestedChassisAbility
      data={mockAbility}
      compact
      chassisName={sampleChassisName ?? 'Salvager'}
    />
  </div>
)

export const HiddenContent: Story = () => (
  <div className="w-[500px]">
    <NestedChassisAbility data={mockAbility} hideContent />
  </div>
)

export const MultipleAbilities: Story = () => {
  const chassis = chassisEntities[0]
  const abilities = chassis ? getChassisAbilities(chassis) : []
  const name = chassis && 'name' in chassis ? String(chassis.name) : 'Salvager'
  return (
    <div className="flex flex-col gap-2 w-[500px]">
      {(abilities ?? []).slice(0, 3).map((ability) => (
        <NestedChassisAbility key={ability.id} data={ability} chassisName={name} />
      ))}
    </div>
  )
}
