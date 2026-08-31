/*
 * Ported from packages/component-lib/src/components/wizard/ClassAbilityStep.stories.tsx.
 * The story sources its class id from `./classOptions`'s `selectableClasses`,
 * which is internal; the id is read straight off the ORM here instead.
 */
import { ClassAbilityStep } from 'component-lib'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../preview-lib/harness'

/** Pick a class, then its starting ability from that class's tree. */
export function PickClass() {
  const pilotClass = SalvageUnionReference.Classes.all()[0]
  return (
    <div className="sheet--pilot bg-paper p-4">
      <Caption>a class chosen, no ability taken yet</Caption>
      <ClassAbilityStep
        isEdit={false}
        classId={pilotClass?.id ?? ''}
        selectedAbilities={[]}
        onSelectClass={() => {}}
        onSelectAbility={() => {}}
      />
    </div>
  )
}
