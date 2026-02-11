import type { ReactNode } from 'react'
import type { EntityButtonConfig } from './entityDisplayContext'

export type CreateChoiceButtonConfigParams = {
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
): (EntityButtonConfig & { children: ReactNode }) | undefined {
  const { isSelected, isMultiSelect, choiceId, entityValue, onChoiceSelection } = params

  if (!onChoiceSelection) {
    return undefined
  }

  if (isSelected) {
    // Remove button for selected items
    return {
      className: 'bg-brand-srd text-su-white font-bold uppercase hover:bg-su-black cursor-pointer',
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
      className: 'bg-su-orange text-su-white font-bold uppercase hover:bg-su-black cursor-pointer',
      onClick: (e) => {
        e.stopPropagation()
        onChoiceSelection(choiceId, entityValue)
      },
      children: 'Add',
    }
  }
}
