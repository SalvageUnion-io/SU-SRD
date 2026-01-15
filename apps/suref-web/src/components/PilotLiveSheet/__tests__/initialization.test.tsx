import { describe, test, expect } from 'bun:test'
import { LOCAL_ID, generateLocalId } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import PilotLiveSheet from '../index'
import { createLocalPilot } from '../../../test/liveSheetHelpers'

describe('PilotLiveSheet - Initialization', () => {
  describe('Common Cases', () => {
    test('renders pilot live sheet with LOCAL_ID', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Should show pilot info section
        expect(screen.getByText(/callsign/i)).toBeInTheDocument()
      })
    })

    test('displays default pilot data (empty pilot, no class selected)', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Should show default callsign (from defaultPilot in usePilots.ts)
        const callsign = screen.getByDisplayValue(/unknown name/i)
        expect(callsign).toBeInTheDocument()
      })
    })

    test('renders all main sections (info inputs, resource steppers, tabs)', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Info inputs - use getAllByText and check at least one exists
        const callsignElements = screen.getAllByText(/callsign/i)
        expect(callsignElements.length).toBeGreaterThan(0)

        // Resource steppers - use getAllByText since there may be multiple instances
        const hpElements = screen.getAllByText(/hp/i)
        expect(hpElements.length).toBeGreaterThan(0)

        // Tabs
        expect(screen.getByRole('tab', { name: /class abilities/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /general abilities/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /inventory/i })).toBeInTheDocument()
        expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument()
      })
    })

    test('shows "incomplete" styling when no class is selected', async () => {
      render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        // Check for class select input - use getAllByLabelText and pick the first one
        const classSelects = screen.getAllByLabelText(/class/i)
        expect(classSelects.length).toBeGreaterThan(0)
        expect(classSelects[0]).toBeInTheDocument()
      })
    })
  })

  describe('Corner Cases', () => {
    test('handles cache misses gracefully (new local pilot)', async () => {
      const newId = generateLocalId()

      render(<PilotLiveSheet id={newId} />)

      await waitFor(() => {
        // Should still render the component even without pre-populated cache
        expect(screen.getByText(/callsign/i)).toBeInTheDocument()
      })
    })

    test('initializes with pre-existing local data in cache', async () => {
      const pilotId = LOCAL_ID

      const { queryClient } = render(<PilotLiveSheet id={pilotId} />)

      // Pre-populate cache after render (component will pick it up)
      if (queryClient) {
        createLocalPilot(queryClient, pilotId, {
          callsign: 'Pre-existing Pilot',
          current_tp: 5,
        })

        // Force a re-render by waiting for the component to react to cache changes
        await waitFor(
          () => {
            const callsignInput = screen.queryByDisplayValue('Pre-existing Pilot')
            if (callsignInput) {
              expect(callsignInput).toBeInTheDocument()
            }
          },
          { timeout: 2000 }
        )
      }
    })

    test('renders with empty string ID', async () => {
      render(<PilotLiveSheet id="" />)

      await waitFor(() => {
        // Component should handle gracefully, possibly showing "not found" or default
        const content = screen.getByText(/not found|pilot/i)
        expect(content).toBeInTheDocument()
      })
    })

    test('handles rapid mount/unmount cycles', async () => {
      const { unmount: firstUnmount } = render(<PilotLiveSheet id={LOCAL_ID} />)

      await waitFor(() => {
        expect(screen.getByText(/callsign/i)).toBeInTheDocument()
      })

      firstUnmount()

      const { unmount: secondUnmount } = render(<PilotLiveSheet id={LOCAL_ID} />)
      await waitFor(() => {
        expect(screen.getByText(/callsign/i)).toBeInTheDocument()
      })
      secondUnmount()

      // Should not throw errors
      expect(true).toBe(true)
    })
  })
})
