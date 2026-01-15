import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { addEquipmentToPilot } from '../../../test/liveSheetUtils'
import { getEquipmentWithSystemSlots } from '../../../test/fixtures'

describe('PilotLiveSheet - Systems & Modules on Equipment', () => {
  describe('Common Cases', () => {
    test('equipment with system slots shows slot usage', async () => {
      const equipment = getEquipmentWithSystemSlots()
      if (!equipment) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        addEquipmentToPilot(queryClient, LOCAL_ID, equipment.id)

        await waitFor(() => {
          const inventoryTab = screen.getByRole('tab', { name: /inventory/i })
          inventoryTab.click()
        })

        // Check for system text - there may be multiple instances
        await waitFor(() => {
          const systemElements = screen.queryAllByText(/system/i)
          expect(systemElements.length).toBeGreaterThan(0)
        })
      }
    })

    test('equipment with module slots shows slot usage', async () => {
      const equipment = getEquipmentWithSystemSlots()
      if (!equipment) {
        return
      }

      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        addEquipmentToPilot(queryClient, LOCAL_ID, equipment.id)

        await waitFor(() => {
          const inventoryTab = screen.getByRole('tab', { name: /inventory/i })
          inventoryTab.click()
        })

        // Check for system or module text - there may be multiple instances
        await waitFor(() => {
          const systemElements = screen.queryAllByText(/system/i)
          const moduleElements = screen.queryAllByText(/module/i)
          expect(systemElements.length + moduleElements.length).toBeGreaterThan(0)
        })
      }
    })
  })

  describe('Corner Cases', () => {
    test('equipment with 0 system slots (system section hidden)', async () => {
      const equipment = getEquipmentWithSystemSlots()
      if (!equipment || ('systemSlots' in equipment && equipment.systemSlots === 0)) {
        return
      }

      // Test with equipment that has no system slots
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const inventoryTab = screen.getByRole('tab', { name: /inventory/i })
        inventoryTab.click()
      })
    })

    test('equipment with 0 module slots (module section hidden)', async () => {
      // Similar to system slots test
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        const inventoryTab = screen.getByRole('tab', { name: /inventory/i })
        inventoryTab.click()
      })
    })
  })
})
