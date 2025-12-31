import type { ButtonProps } from '@chakra-ui/react'
import type { ReactNode } from 'react'

export interface CreateChoiceButtonConfigParams {
  /** Whether the choice is currently selected */
  isSelected: boolean
  /** Whether this is a multi-select choice */
  isMultiSelect: boolean
  /** The choice ID */
  choiceId: string
  /** The entity value/name for this choice */
  entityValue: string
  /** Callback when choice is selected */
  onChoiceSelection: (choiceId: string, value: string | undefined) => void
}

/**
 * Create button configuration for choice selection buttons
 * Consolidates button config creation logic from EntityListDisplay
 * @param params - Parameters for button config creation
 * @returns Button configuration or undefined if not applicable
 */
export function createChoiceButtonConfig(
  params: CreateChoiceButtonConfigParams
): (ButtonProps & { children: ReactNode }) | undefined {
  const { isSelected, isMultiSelect, choiceId, entityValue, onChoiceSelection } = params

  if (!onChoiceSelection) {
    return undefined
  }

  if (isSelected) {
    // Remove button for selected items
    return {
      bg: 'brand.srd',
      color: 'su.white',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      _hover: { bg: 'su.black' },
      onClick: (e) => {
        e.stopPropagation()
        // For multi-select, remove this specific selection
        // For single-select, clear the choice
        onChoiceSelection(choiceId, isMultiSelect ? entityValue : undefined)
      },
      children: 'Remove',
    }
  } else {
    // Add button for unselected items
    return {
      bg: 'su.orange',
      color: 'su.white',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      _hover: { bg: 'su.black' },
      onClick: (e) => {
        e.stopPropagation()
        onChoiceSelection(choiceId, entityValue)
      },
      children: 'Add',
    }
  }
}
