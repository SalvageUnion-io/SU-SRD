import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefSystem } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { SystemsList } from './SystemsList'

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Compositions/Wizard/Systems List',
}

const weaponSystems: SURefSystem[] = SalvageUnionReference.Systems.all().slice(0, 4)

/**
 * The crawler Armament-Bay picker. `maxSelectable` is the bay's weapon
 * allowance — once reached, the remaining cards disable with a reason chip.
 */
export const Default: Story = () => {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <Caption>SystemsList — capped weapons picker</Caption>
      <SystemsList
        systems={weaponSystems}
        selectedSystemSlugs={selected}
        installedWeaponCount={selected.length}
        maxSelectable={2}
        onChange={setSelected}
      />
    </div>
  )
}
