import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { ClassAbilityStep } from './ClassAbilityStep'
import { selectableClasses } from './classOptions'

const FRAME: CSSProperties = { backgroundColor: tokens.color.paper, padding: tokens.space[16] }

export default {
  title: 'Compositions/Wizard/Class Ability Step',
}

const { base } = selectableClasses(undefined, true)

/** Pick a class, then its starting ability from that class's tree. */
export const Default = () => {
  const [classId, setClassId] = useState(base[0]?.id ?? '')
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  return (
    <div className="sheet--pilot" style={FRAME}>
      <Caption>ClassAbilityStep</Caption>
      <ClassAbilityStep
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
