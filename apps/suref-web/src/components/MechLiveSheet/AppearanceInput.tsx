import { rollTable } from '@randsum/salvageunion'
import { SheetInput } from '../shared/SheetInput'
import { useHydratedMech, useUpdateMech } from '../../hooks/mech'

export function AppearanceInput({ id, disabled }: { disabled: boolean; id: string }) {
  const { mech } = useHydratedMech(id)
  const appearance = mech?.appearance ?? ''
  const updateMech = useUpdateMech()
  const handleRollAppearance = () => {
    const result = rollTable('Mech Appearance')
    const appearanceText = result.result.description || result.result.label
    updateMech.mutate({ id, updates: { appearance: appearanceText } })
  }

  return (
    <SheetInput
      label="Appearance"
      value={appearance}
      onChange={(value) => updateMech.mutate({ id, updates: { appearance: value } })}
      placeholder="Enter appearance..."
      disabled={disabled}
      isOwner={!disabled}
      onDiceRoll={handleRollAppearance}
      diceRollAriaLabel="Roll for appearance"
      diceRollTitle="Roll on the Mech Appearance table"
    />
  )
}
