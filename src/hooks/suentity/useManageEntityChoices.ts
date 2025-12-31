import { useCallback } from 'react'
import { useUpsertPlayerChoice, useDeletePlayerChoice, playerChoicesKeys } from './usePlayerChoices'
import type { Tables } from '../../types/database-generated.types'
import { useQueryClient } from '@tanstack/react-query'

/**
 * Hook to manage player choices for an entity with a simplified interface
 *
 * Provides a single callback that handles both creating and deleting choices:
 * - When value is provided: creates/updates the choice (upsert)
 * - When value is undefined: deletes the choice
 * - For multi-select: toggles the selection (add if not present, remove if present)
 *
 * @param entityId - ID of the entity that owns the choices
 * @param isMultiSelect - Whether the choice allows multiple selections (optional, defaults to false)
 * @returns Callback function to update choices
 *
 * @example
 * ```tsx
 * const handleUpdateChoice = useManageEntityChoices(entityId, false)
 *
 * // Create/update a choice (single-select)
 * handleUpdateChoice('weapon-choice', 'systems::laser-rifle')
 *
 * // Delete a choice
 * handleUpdateChoice('weapon-choice', undefined)
 *
 * // Multi-select: toggles selection
 * const handleMultiChoice = useManageEntityChoices(entityId, true)
 * handleMultiChoice('modification-choice', 'Rangefinder') // Adds if not present, removes if present
 * ```
 */
export function useManageEntityChoices(entityId: string | undefined, isMultiSelect = false) {
  const queryClient = useQueryClient()
  const upsertChoice = useUpsertPlayerChoice()
  const deleteChoice = useDeletePlayerChoice()

  return useCallback(
    (choiceRefId: string, value: string | undefined) => {
      if (!entityId) return

      if (value === undefined) {
        // Delete all selections for this choice
        const choices = queryClient.getQueryData<Tables<'player_choices'>[]>(
          playerChoicesKeys.forEntity(entityId)
        )
        const existingChoices = choices?.filter((c) => c.choice_ref_id === choiceRefId) || []

        existingChoices.forEach((choice) => {
          deleteChoice.mutate({ id: choice.id, entityId })
        })
      } else {
        const choices = queryClient.getQueryData<Tables<'player_choices'>[]>(
          playerChoicesKeys.forEntity(entityId)
        )

        if (isMultiSelect) {
          // For multi-select, check if this value is already selected
          const existingSelection = choices?.find(
            (c) => c.choice_ref_id === choiceRefId && c.value === value
          )

          if (existingSelection) {
            // Toggle: remove if already selected
            deleteChoice.mutate({ id: existingSelection.id, entityId })
          } else {
            // Add new selection
            upsertChoice.mutate({
              data: {
                entity_id: entityId,
                choice_ref_id: choiceRefId,
                value,
              },
              isMultiSelect: true,
            })
          }
        } else {
          // For single-select, replace existing selection
          upsertChoice.mutate({
            data: {
              entity_id: entityId,
              choice_ref_id: choiceRefId,
              value,
            },
            isMultiSelect: false,
          })
        }
      }
    },
    [entityId, queryClient, upsertChoice, deleteChoice, isMultiSelect]
  )
}
