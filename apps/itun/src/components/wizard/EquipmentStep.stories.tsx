import { tokens } from 'component-lib'
import { Caption } from 'component-lib/stories/harness'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { EquipmentStep } from './EquipmentStep'

const FRAME: CSSProperties = { backgroundColor: tokens.color.paper, padding: tokens.space[16] }

export default {
  title: 'Compositions/Wizard/Equipment Step',
}

/** Pilot starting-equipment picker, with the budget cap applied. */
export const Default = () => {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div className="sheet--pilot" style={FRAME}>
      <Caption>EquipmentStep</Caption>
      <EquipmentStep
        selectedEquipment={selected}
        budget={3}
        onCountChange={(id, next) =>
          setSelected((prev) => [
            ...prev.filter((x) => x !== id),
            ...new Array<string>(next).fill(id),
          ])
        }
      />
    </div>
  )
}
