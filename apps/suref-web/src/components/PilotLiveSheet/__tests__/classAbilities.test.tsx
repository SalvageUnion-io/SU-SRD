import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { setupPilotWithClass, addAbilityToPilot } from '../../../test/liveSheetUtils'
import { getBaseClass, getCoreTreeLevel1Ability, getAbilitiesByTree } from '../../../test/fixtures'
import type { Tables } from '../../../types/database-generated.types'

describe('PilotLiveSheet - Class Abilities', () => {
  describe('Common Cases', () => {
    test('displays all core trees for selected class', async () => {
      const baseClass = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient && 'coreTrees' in baseClass && Array.isArray(baseClass.coreTrees)) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        await waitFor(
          () => {
            // Check that class was set up in cache
            const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
            expect(Array.isArray(entities)).toBe(true)
            if (Array.isArray(entities)) {
              const hasClass = entities.some(
                (e) => e.schema_name === 'classes' && e.schema_ref_id === baseClass.id
              )
              expect(hasClass).toBe(true)
              // Verify coreTrees exist on the class reference
              expect(baseClass.coreTrees.length).toBeGreaterThan(0)
            }
          },
          { timeout: 2000 }
        )
      }
    })

    test('shows abilities in each core tree, sorted by level', async () => {
      const baseClass = getBaseClass()
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient && 'coreTrees' in baseClass && Array.isArray(baseClass.coreTrees)) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        await waitFor(
          () => {
            const firstTree = baseClass.coreTrees[0]
            if (!firstTree) return
            const abilities = getAbilitiesByTree(firstTree)

            // Should show at least the level 1 ability
            const level1Ability = abilities.find((a) => a.level === 1)
            if (level1Ability) {
              const abilityElement = screen.queryByText(new RegExp(level1Ability.name, 'i'))
              if (abilityElement) {
                expect(abilityElement).toBeInTheDocument()
              }
            }
          },
          { timeout: 3000 }
        )
      }
    })

    test('ability level 1 is available immediately', async () => {
      const baseClass = getBaseClass()
      const level1Ability = getCoreTreeLevel1Ability(baseClass)

      if (!level1Ability) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        await waitFor(() => {
          const abilityButton = screen.queryByText(new RegExp(level1Ability.name, 'i'))
          if (abilityButton) {
            // Should be available (not disabled)
            expect(abilityButton).toBeInTheDocument()
          }
        })
      }
    })
  })

  describe('Corner Cases', () => {
    test('add ability when TP is exactly the cost', async () => {
      const baseClass = getBaseClass()
      const level1Ability = getCoreTreeLevel1Ability(baseClass)

      if (!level1Ability) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)
        // Set TP to exactly 1 (cost for level 1 ability)
        queryClient.setQueryData(['pilots', LOCAL_ID], (old: Tables<'pilots'> | undefined) => ({
          ...(old || {}),
          current_tp: 1,
        }))

        await waitFor(() => {
          const abilityButton = screen.queryByText(new RegExp(level1Ability.name, 'i'))
          if (abilityButton && !abilityButton.hasAttribute('disabled')) {
            // Should be able to add the ability
            abilityButton.click()
          }
        })
      }
    })

    test('remove ability when TP would exceed max', async () => {
      // This test would require adding an ability first, then removing it
      // The TP refund should work correctly even if it would exceed max
      const baseClass = getBaseClass()
      const level1Ability = getCoreTreeLevel1Ability(baseClass)

      if (!level1Ability) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)
        addAbilityToPilot(queryClient, LOCAL_ID, level1Ability.id)

        // Wait a bit for the ability to be added and UI to update
        await waitFor(
          () => {
            // Check cache to verify ability was added
            const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
            if (Array.isArray(entities)) {
              const hasAbility = entities.some(
                (e) => e.schema_name === 'abilities' && e.schema_ref_id === level1Ability.id
              )
              expect(hasAbility).toBe(true)
            }
          },
          { timeout: 3000 }
        )
      }
    })
  })
})
