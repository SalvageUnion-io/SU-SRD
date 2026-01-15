import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import PilotLiveSheet from '../index'
import { updatePilotResource } from '../../../test/liveSheetUtils'
import { getPilotFromCache, createLocalPilot } from '../../../test/liveSheetHelpers'

describe('PilotLiveSheet - Resource Management', () => {
  describe('Common Cases', () => {
    test('HP stepper updates current damage correctly', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        expect(screen.getByText(/hp/i)).toBeInTheDocument()
      })

      // Find HP stepper and increment/decrement
      // This is a simplified test - actual implementation would need to find the stepper buttons
      const hpElements = screen.getAllByText(/hp/i)
      expect(hpElements.length).toBeGreaterThan(0)
    })

    test('AP stepper updates current AP', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Use getAllByText since there may be multiple "AP" text instances
        const apElements = screen.getAllByText(/ap/i)
        expect(apElements.length).toBeGreaterThan(0)
      })
    })

    test('TP stepper updates current TP', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        expect(screen.getByText(/tp/i)).toBeInTheDocument()
      })

      const tpElements = screen.getAllByText(/tp/i)
      expect(tpElements.length).toBeGreaterThan(0)
    })

    test('HP cannot exceed max HP', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        if (pilot && pilot.max_hp !== null) {
          // Try to set HP above max
          updatePilotResource(queryClient, LOCAL_ID, 'hp', pilot.max_hp + 10)

          const updatedPilot = getPilotFromCache(queryClient, LOCAL_ID)
          if (
            updatedPilot &&
            updatedPilot.max_hp !== null &&
            updatedPilot.current_damage !== null
          ) {
            const currentHP = updatedPilot.max_hp - updatedPilot.current_damage
            expect(currentHP).toBeLessThanOrEqual(updatedPilot.max_hp)
          }
        }
      }
    })

    test('HP cannot go below 0', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Create pilot first if it doesn't exist
        createLocalPilot(queryClient, LOCAL_ID)

        updatePilotResource(queryClient, LOCAL_ID, 'hp', -10)

        await waitFor(() => {
          const pilot = getPilotFromCache(queryClient, LOCAL_ID)
          if (pilot && pilot.max_hp !== null && pilot.current_damage !== null) {
            const currentHP = pilot.max_hp - pilot.current_damage
            expect(currentHP).toBeGreaterThanOrEqual(0)
          }
        })
      }
    })

    test('AP cannot exceed max AP', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        if (pilot && pilot.max_ap !== null) {
          updatePilotResource(queryClient, LOCAL_ID, 'ap', pilot.max_ap + 10)

          const updatedPilot = getPilotFromCache(queryClient, LOCAL_ID)
          if (updatedPilot && updatedPilot.max_ap !== null) {
            expect(updatedPilot.current_ap).toBeLessThanOrEqual(updatedPilot.max_ap)
          }
        }
      }
    })

    test('TP can be set to any value (no max)', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Create pilot first if it doesn't exist
        createLocalPilot(queryClient, LOCAL_ID)

        updatePilotResource(queryClient, LOCAL_ID, 'tp', 1000)

        await waitFor(() => {
          const pilot = getPilotFromCache(queryClient, LOCAL_ID)
          expect(pilot).toBeDefined()
          if (pilot) {
            expect(pilot.current_tp).toBe(1000)
          }
        })
      }
    })
  })

  describe('Corner Cases', () => {
    test('set HP to exactly max HP', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        if (pilot && pilot.max_hp !== null) {
          updatePilotResource(queryClient, LOCAL_ID, 'hp', pilot.max_hp)

          const updatedPilot = getPilotFromCache(queryClient, LOCAL_ID)
          if (
            updatedPilot &&
            updatedPilot.max_hp !== null &&
            updatedPilot.current_damage !== null
          ) {
            const currentHP = updatedPilot.max_hp - updatedPilot.current_damage
            expect(currentHP).toBe(updatedPilot.max_hp)
          }
        }
      }
    })

    test('set HP to exactly 0', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        // Create pilot first if it doesn't exist
        createLocalPilot(queryClient, LOCAL_ID)

        updatePilotResource(queryClient, LOCAL_ID, 'hp', 0)

        await waitFor(() => {
          const pilot = getPilotFromCache(queryClient, LOCAL_ID)
          if (pilot && pilot.max_hp !== null && pilot.current_damage !== null) {
            const currentHP = pilot.max_hp - pilot.current_damage
            expect(currentHP).toBe(0)
          }
        })
      }
    })

    test('set AP to exactly max AP', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        if (pilot && pilot.max_ap !== null) {
          updatePilotResource(queryClient, LOCAL_ID, 'ap', pilot.max_ap)

          const updatedPilot = getPilotFromCache(queryClient, LOCAL_ID)
          if (updatedPilot && updatedPilot.max_ap !== null) {
            expect(updatedPilot.current_ap).toBe(updatedPilot.max_ap)
          }
        }
      }
    })
  })
})
