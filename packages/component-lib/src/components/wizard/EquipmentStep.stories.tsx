import type { Story } from '@ladle/react'
import { useState } from 'react'
import { Caption } from '../../stories/_harness'
import { EquipmentStep } from './EquipmentStep'

export default {
  title: 'Compositions/Wizard/Equipment Step',
}

/** Pilot starting-equipment picker, with the budget cap applied. */
export const Default: Story = () => {
  const [selected, setSelected] = useState<string[]>([])
  return (
    <div className="sheet--pilot bg-paper p-4">
      <Caption>EquipmentStep</Caption>
      <EquipmentStep
        selectedEquipment={selected}
        budget={3}
        onToggle={(id) =>
          setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
        }
      />
    </div>
  )
}
