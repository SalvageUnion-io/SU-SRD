import { rollTable } from '@randsum/salvageunion'
import { SheetInput } from '../shared/SheetInput'
import { useHydratedMech, useUpdateMech } from '../../hooks/mech'

export function QuirkInput({ disabled, id }: { disabled: boolean; id: string }) {
  const { mech } = useHydratedMech(id)
  const quirk = mech?.quirk ?? ''
  const updateMech = useUpdateMech()

  const handleRollQuirk = () => {
    const result = rollTable('Quirks')
    const quirkText = result.result.description || result.result.label
    updateMech.mutate({ id, updates: { quirk: quirkText } })
  }

  return (
    <SheetInput
      label="Quirk"
      value={quirk}
      onChange={(value) => updateMech.mutate({ id, updates: { quirk: value } })}
      placeholder="Enter quirk..."
      disabled={disabled}
      isOwner={!disabled}
      onDiceRoll={handleRollQuirk}
      diceRollAriaLabel="Roll for quirk"
      diceRollTitle="Roll on the Quirks table"
    />
  )
}
