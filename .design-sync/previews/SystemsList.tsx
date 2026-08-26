/* Ported from packages/component-lib/src/components/wizard/SystemsList.stories.tsx. */
import { SystemsList } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

function weapons() {
  return SalvageUnionReference.Systems.all().slice(0, 4)
}

/**
 * The crawler Armament-Bay picker. `maxSelectable` is the bay's weapon
 * allowance.
 */
export function Picker() {
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <Caption>capped weapons picker — nothing installed yet</Caption>
      <SystemsList
        systems={weapons()}
        selectedSystemSlugs={[]}
        installedWeaponCount={0}
        maxSelectable={2}
        onChange={() => {}}
      />
    </div>
  )
}

/**
 * At the cap. Once the allowance is reached the remaining cards disable and
 * carry a reason chip — the state that makes the cap legible.
 */
export function AtCap() {
  const list = weapons()
  const picked = list.slice(0, 2).map((s) => s.slug ?? s.id)
  return (
    <div className="flex flex-col gap-4 bg-paper p-4">
      <Caption>at the cap — the rest disable with a reason</Caption>
      <SystemsList
        systems={list}
        selectedSystemSlugs={picked}
        installedWeaponCount={2}
        maxSelectable={2}
        onChange={() => {}}
      />
    </div>
  )
}
