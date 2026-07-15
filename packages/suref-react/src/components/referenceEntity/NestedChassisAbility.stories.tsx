import type { Story } from '@ladle/react'
import { NestedChassisAbility } from './NestedChassisAbility'
import { SalvageUnionReference, getChassisAbilities } from 'salvageunion-reference'
import type { SURefMetaAction } from 'salvageunion-reference'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Legacy/NestedChassisAbility',
}

// A real chassis with abilities.
const chassisEntities = SalvageUnionReference.Chassis.all()
let ability: SURefMetaAction | undefined
let chassisName: string | undefined
for (const c of chassisEntities) {
  const abilities = getChassisAbilities(c)
  if (abilities && abilities.length > 0) {
    ability = abilities[0]
    chassisName = 'name' in c ? String(c.name) : undefined
    break
  }
}
const mockAbility: SURefMetaAction = ability ?? {
  id: 'armored-hull',
  name: 'Armored Hull',
  activationCost: 1,
  content: [{ type: 'paragraph', value: 'Reduce incoming damage by 1 until end of turn.' }],
}
const name = chassisName ?? 'Salvager'
const firstChassis = chassisEntities[0]
const abilityList = firstChassis ? (getChassisAbilities(firstChassis) ?? []) : []
const listName = firstChassis && 'name' in firstChassis ? String(firstChassis.name) : name

/** The chassis-ability block across densities, plus a real multi-ability stack. */
export const Variants: Story = () => (
  <div className="flex flex-col gap-5 bg-paper p-5 text-ink">
    <p className="max-w-2xl font-mono text-xs leading-relaxed text-ink-2">
      A chassis ability. compact tightens; hideContent is header-only; a chassis renders its full
      ability list stacked.
    </p>
    <div className="flex flex-col gap-1.5">
      <div className="w-[480px]">
        <NestedChassisAbility data={mockAbility} chassisName={name} />
      </div>
      <code className="font-mono text-nano text-ink-2">default</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="w-[400px]">
        <NestedChassisAbility data={mockAbility} compact chassisName={name} />
      </div>
      <code className="font-mono text-nano text-ink-2">compact</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="w-[480px]">
        <NestedChassisAbility data={mockAbility} hideContent />
      </div>
      <code className="font-mono text-nano text-ink-2">hideContent</code>
    </div>
    <div className="flex flex-col gap-1.5">
      <div className="flex w-[480px] flex-col gap-2">
        {abilityList.slice(0, 3).map((a) => (
          <NestedChassisAbility key={a.id} data={a} chassisName={listName} />
        ))}
      </div>
      <code className="font-mono text-nano text-ink-2">{listName} — full ability list</code>
    </div>
  </div>
)
