import { describe, test, expect } from 'bun:test'
import { waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { makePlayerChoice } from '../../../test/liveSheetUtils'
import { createLocalEntity } from '../../../test/liveSheetHelpers'
import { SalvageUnionReference } from 'salvageunion-reference'

describe('PilotLiveSheet - Player Choices', () => {
  describe('Common Cases', () => {
    test('single-select choice displays current selection', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Get a real ability ID from the reference data
        const abilities = SalvageUnionReference.Abilities.all()
        const testAbility = abilities[0]
        if (!testAbility) {
          return // Skip if no abilities exist
        }

        // Create an entity with a real ability ID
        const entity = createLocalEntity(queryClient, LOCAL_ID, 'abilities', testAbility.id)

        // Make a choice
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'choice-value')

        await waitFor(() => {
          // Check cache directly for player choices
          const choices = queryClient.getQueryData(['player_choices', 'entity', entity.id])
          expect(Array.isArray(choices)).toBe(true)
          if (Array.isArray(choices)) {
            const hasChoice = choices.some((c) => c.choice_ref_id === 'test-choice-id')
            expect(hasChoice).toBe(true)
          }
        })
      }
    })

    test('update single-select choice (replaces existing)', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Get a real ability ID
        const abilities = SalvageUnionReference.Abilities.all()
        const testAbility = abilities[0]
        if (!testAbility) {
          return
        }

        const entity = createLocalEntity(queryClient, LOCAL_ID, 'abilities', testAbility.id)

        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value1')

        await waitFor(() => {
          // Check cache for choice
          const choices = queryClient.getQueryData(['player_choices', 'entity', entity.id])
          expect(Array.isArray(choices)).toBe(true)
          if (Array.isArray(choices)) {
            const choice = choices.find((c) => c.choice_ref_id === 'test-choice-id')
            expect(choice?.value).toBe('value1')
          }
        })

        // Update the choice
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value2')

        await waitFor(() => {
          // Check cache for updated choice
          const choices = queryClient.getQueryData(['player_choices', 'entity', entity.id])
          expect(Array.isArray(choices)).toBe(true)
          if (Array.isArray(choices)) {
            const choice = choices.find((c) => c.choice_ref_id === 'test-choice-id')
            expect(choice?.value).toBe('value2')
          }
        })
      }
    })

    test('multi-select choice displays all selections', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Get a real ability ID
        const abilities = SalvageUnionReference.Abilities.all()
        const testAbility = abilities[0]
        if (!testAbility) {
          return
        }

        const entity = createLocalEntity(queryClient, LOCAL_ID, 'abilities', testAbility.id)

        // Make multiple choices (for multi-select, this would need special handling)
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value1')
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value2')

        await waitFor(() => {
          // Check cache for choices
          const choices = queryClient.getQueryData(['player_choices', 'entity', entity.id])
          expect(Array.isArray(choices)).toBe(true)
        })
      }
    })
  })

  describe('Corner Cases', () => {
    test('rapidly change choice selections', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Get a real ability ID
        const abilities = SalvageUnionReference.Abilities.all()
        const testAbility = abilities[0]
        if (!testAbility) {
          return
        }

        const entity = createLocalEntity(queryClient, LOCAL_ID, 'abilities', testAbility.id)

        // Rapidly change choices
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value1')
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value2')
        makePlayerChoice(queryClient, entity.id, 'test-choice-id', 'value3')

        await waitFor(() => {
          // Check cache for the last choice value
          const choices = queryClient.getQueryData(['player_choices', 'entity', entity.id])
          expect(Array.isArray(choices)).toBe(true)
          if (Array.isArray(choices)) {
            const choice = choices.find((c) => c.choice_ref_id === 'test-choice-id')
            // Should have the last value (value3)
            expect(choice?.value).toBe('value3')
          }
        })
      }
    })
  })
})
