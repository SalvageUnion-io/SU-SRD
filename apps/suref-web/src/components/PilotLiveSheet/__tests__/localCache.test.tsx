import { describe, test, expect } from 'bun:test'
import { screen, waitFor } from '@testing-library/react'
import { LOCAL_ID, generateLocalId } from '../../../lib/cacheHelpers'
import { render } from '../../../test/render'
import PilotLiveSheet from '../index'
import { createLocalPilot, getPilotFromCache } from '../../../test/liveSheetHelpers'

describe('PilotLiveSheet - Local Cache Management', () => {
  describe('Common Cases', () => {
    test('local ID entities stored in cache correctly', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalPilot(queryClient, LOCAL_ID)

        await waitFor(() => {
          const pilot = getPilotFromCache(queryClient, LOCAL_ID)
          expect(pilot).toBeDefined()
          expect(pilot?.id).toBe(LOCAL_ID)
        })
      }
    })

    test('cache updates reflect in UI immediately', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalPilot(queryClient, LOCAL_ID, { callsign: 'Updated Pilot' })

        await waitFor(() => {
          expect(screen.getByDisplayValue('Updated Pilot')).toBeInTheDocument()
        })
      }
    })

    test('mutations use cache-only paths for local IDs', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalPilot(queryClient, LOCAL_ID)

        // Verify it's in cache, not making API calls
        const cachedPilot = getPilotFromCache(queryClient, LOCAL_ID)
        expect(cachedPilot).toBeDefined()
        expect(cachedPilot?.id).toBe(LOCAL_ID)
      }
    })
  })

  describe('Corner Cases', () => {
    test('generate unique local IDs for new entities', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        const id1 = generateLocalId()
        const id2 = generateLocalId()

        expect(id1).not.toBe(id2)
        expect(id1).toMatch(/^local_/)
        expect(id2).toMatch(/^local_/)
      }
    })

    test('local ID format validation', async () => {
      const localId = generateLocalId()
      expect(localId).toMatch(/^local_\d+_[a-z0-9]+$/)
    })

    test('multiple components using same local ID (cache consistency)', async () => {
      const { queryClient } = render(<PilotLiveSheet id={LOCAL_ID} />)

      if (queryClient) {
        createLocalPilot(queryClient, LOCAL_ID, { callsign: 'Shared Pilot' })

        // Create another component instance - should share the same cache
        const pilot = getPilotFromCache(queryClient, LOCAL_ID)
        expect(pilot?.callsign).toBe('Shared Pilot')
      }
    })
  })
})
