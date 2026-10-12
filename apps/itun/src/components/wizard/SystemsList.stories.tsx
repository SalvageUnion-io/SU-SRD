import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { SURefSystem } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { SystemsList } from './SystemsList'

const FRAME: CSSProperties = {
  backgroundColor: tokens.color.paper,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  padding: tokens.space[16],
}

export default {
  title: 'Compositions/Wizard/Systems List',
}

const weaponSystems: SURefSystem[] = SalvageUnionReference.Systems.all().slice(0, 4)

/**
 * The crawler Armament-Bay picker. `maxSelectable` is the bay's weapon
 * allowance — once reached, the remaining cards disable with a reason chip.
 */
export const Default = () => {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div style={FRAME}>
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
