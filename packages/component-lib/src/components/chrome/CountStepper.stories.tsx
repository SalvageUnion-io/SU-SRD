import type { Story } from '@ladle/react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../stories/_harness'
import { CountStepper } from './CountStepper'

/**
 * CountStepper — the `[− n +]` duplicate-quantity control, driven here by a real
 * equipment name so the accessible labels ("Add one …") read as they ship. It
 * normally sits in an entity card's footActions band.
 */
// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default {
  title: 'Atoms/Count Stepper',
}

export const Default: Story = () => {
  const item = SalvageUnionReference.Equipment.all()[0]
  const [count, setCount] = useState(1)
  const subject = item?.name ?? 'Item'
  return (
    <div className="flex flex-col gap-3">
      <Caption>Bounded 0–3; the ± buttons carry "Add/Remove one {subject}".</Caption>
      <CountStepper subject={subject} count={count} onChange={setCount} max={3} />
    </div>
  )
}
