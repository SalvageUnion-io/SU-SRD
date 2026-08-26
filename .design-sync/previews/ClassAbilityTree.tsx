/* Ported from packages/component-lib/src/components/referenceEntity/ClassAbilityTree.stories.tsx. */
import { ClassAbilityTree } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** The full core / advanced / legendary tree listing for a real pilot class. */
export function Tree() {
  const pilotClass = SalvageUnionReference.Classes.all()[0]
  if (!pilotClass) return null
  return (
    <div className="max-w-2xl p-4">
      <Caption>{pilotClass.name}</Caption>
      <ClassAbilityTree classEntity={pilotClass} />
    </div>
  )
}

/** A second class — trees vary in depth (core count, advanced/legendary presence). */
export function AnotherClass() {
  const pilotClass = SalvageUnionReference.Classes.all()[1]
  if (!pilotClass) return null
  return (
    <div className="max-w-2xl p-4">
      <Caption>{pilotClass.name}</Caption>
      <ClassAbilityTree classEntity={pilotClass} />
    </div>
  )
}
