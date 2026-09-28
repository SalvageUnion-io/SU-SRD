import { Caption } from 'component-lib/stories/harness'
import { useState } from 'react'
import { EquipmentStep } from './EquipmentStep'

export default {
  title: 'Compositions/Wizard/Equipment Step',
}

/** Pilot starting-equipment picker, with the budget cap applied. */
export const Default = () => {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div className="sheet--pilot bg-paper p-4">
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
