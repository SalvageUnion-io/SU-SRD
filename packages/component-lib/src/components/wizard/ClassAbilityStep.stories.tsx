import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { ClassAbilityStep } from './ClassAbilityStep'
import { selectableClasses } from './classOptions'

export default {
  title: 'Compositions/Wizard/Class Ability Step',
}

const { base } = selectableClasses(undefined, true)

/** Pick a class, then its starting ability from that class's tree. */
export const Default: Story = () => {
  const [classId, setClassId] = useState(base[0]?.id ?? '')
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  return (
    <div className="sheet--pilot bg-paper p-4">
      <Caption>ClassAbilityStep</Caption>
      <ClassAbilityStep
        isEdit={false}
        classId={classId}
        selectedAbilities={selectedAbilities}
        onSelectClass={setClassId}
        onSelectAbility={(id) =>
          setSelectedAbilities((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
          )
        }
      />
    </div>
  )
}
