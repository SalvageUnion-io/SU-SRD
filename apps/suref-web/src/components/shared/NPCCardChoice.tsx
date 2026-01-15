import { Box } from '@chakra-ui/react'
import { SheetInput } from './SheetInput'
import { rollTable } from '@randsum/salvageunion'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefObjectChoice } from 'salvageunion-reference'
import { getParagraphString } from '../../lib/contentBlockHelpers'

interface NPCCardChoiceProps {
  choice: SURefObjectChoice
  position: string
  value: string
  tilted?: boolean
  nameRotation?: number
  disabled?: boolean
  onUpdateChoice?: (id: string, value: string) => void
}

export function NPCCardChoice({
  choice,
  position,
  value,
  tilted = false,
  nameRotation = 0,
  disabled = false,
  onUpdateChoice,
}: NPCCardChoiceProps) {
  // Don't render choices with schema - those should be handled by SheetEntityChoiceDisplay in BayInfo
  if (choice.schema && choice.schema.length > 0) {
    return null
  }

  const isName = choice.name === 'Name'
  // Check if choice explicitly specifies a roll table, or if the choice name matches a roll table
  const rollTableName = choice.rollTable || choice.name
  const hasValidRollTable =
    SalvageUnionReference.RollTables.find((table) => table.name === rollTableName) !== undefined

  return (
    <Box
      transform={tilted && isName ? `rotate(${nameRotation}deg)` : undefined}
      transition="transform 0.3s ease"
    >
      <SheetInput
        label={isName ? undefined : choice.name}
        placeholder={
          isName
            ? `Enter ${position} name...`
            : getParagraphString(choice.content) || 'Enter value...'
        }
        suffixText={isName ? `the ${position}` : undefined}
        onDiceRoll={
          onUpdateChoice && hasValidRollTable
            ? () => {
                const {
                  result: { label },
                } = rollTable(rollTableName)
                onUpdateChoice(choice.id, label)
              }
            : undefined
        }
        value={value}
        onChange={onUpdateChoice ? (value) => onUpdateChoice(choice.id, value) : undefined}
        disabled={disabled || !onUpdateChoice}
      />
    </Box>
  )
}
