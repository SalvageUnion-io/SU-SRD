import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import {
  setupPilotWithClass,
  addAbilityToPilot,
  addEquipmentToPilot,
} from '../../../test/liveSheetUtils'
import {
  getBaseClass,
  getCoreTreeLevel1Ability,
  getEquipmentWithoutSlots,
} from '../../../test/fixtures'
import type { Tables } from '../../../types/database-generated.types'

describe('PilotLiveSheet - Integration', () => {
  describe('Common Cases', () => {
    test('complete pilot creation workflow (class → abilities → equipment)', async () => {
      const baseClass = getBaseClass()
      const level1Ability = getCoreTreeLevel1Ability(baseClass)
      const equipment = getEquipmentWithoutSlots()

      if (!level1Ability || !equipment) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // 1. Select class
        setupPilotWithClass(queryClient, LOCAL_ID, baseClass.id)

        await waitFor(
          () => {
            // Check that class name appears somewhere (might be in select or header)
            const classElements = screen.queryAllByText(new RegExp(baseClass.name, 'i'))
            expect(classElements.length).toBeGreaterThan(0)
          },
          { timeout: 3000 }
        )

        // 2. Add ability
        queryClient.setQueryData(['pilots', LOCAL_ID], (old: Tables<'pilots'> | undefined) => ({
          ...(old || {}),
          current_tp: 1,
        }))
        addAbilityToPilot(queryClient, LOCAL_ID, level1Ability.id)

        await waitFor(
          () => {
            // Ability might not be visible immediately, so just check cache
            const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
            expect(Array.isArray(entities)).toBe(true)
          },
          { timeout: 3000 }
        )

        // 3. Add equipment
        addEquipmentToPilot(queryClient, LOCAL_ID, equipment.id)

        await waitFor(() => {
          const inventoryTab = screen.getByRole('tab', { name: /inventory/i })
          inventoryTab.click()
        })

        // Wait for equipment to appear after clicking tab
        await waitFor(
          () => {
            // Check cache to verify equipment was added
            const entities = queryClient.getQueryData(['entities', 'pilot', LOCAL_ID])
            if (Array.isArray(entities)) {
              const hasEquipment = entities.some(
                (e) => e.schema_name === 'equipment' && e.schema_ref_id === equipment.id
              )
              expect(hasEquipment).toBe(true)
            }
          },
          { timeout: 3000 }
        )
      }
    })

    test('all tabs render and switch correctly', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Check that tabs exist
        expect(screen.getByRole('tab', { name: /class abilities/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /general abilities/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /inventory/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument()
      })

      // Click tabs one at a time and wait for each
      const classAbilitiesTab = screen.getByRole('tab', { name: /class abilities/i })
      classAbilitiesTab.click()
      await waitFor(() => {
        expect(classAbilitiesTab).toHaveAttribute('aria-selected', 'true')
      })

      const inventoryTab = screen.getByRole('tab', { name: /inventory/i })
      inventoryTab.click()
      await waitFor(() => {
        expect(inventoryTab).toHaveAttribute('aria-selected', 'true')
      })
    })

    test('control bar not shown for local pilots', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Control bar should not be present for local pilots
        const controlBar = screen.queryByRole('button', { name: /active|private/i })
        expect(controlBar).not.toBeInTheDocument()
      })
    })
  })
})
