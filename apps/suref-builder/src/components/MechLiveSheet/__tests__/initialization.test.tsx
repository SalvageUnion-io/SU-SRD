import { describe, test, expect } from 'bun:test'
import { LOCAL_ID, generateLocalId } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import MechLiveSheet from '../index'

describe('MechLiveSheet - Initialization', () => {
  describe('Common Cases', () => {
    test('renders mech live sheet with LOCAL_ID', async () => {
      render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Should show mech info section - look for common mech UI elements
          const mechElements = screen.getAllByText(/mech|chassis|sp|ep/i)
          expect(mechElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('renders main sections (header, resource steppers)', async () => {
      render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Resource steppers - SP, EP
          const resourceElements = screen.queryAllByText(/sp|ep|structure|energy/i)
          expect(resourceElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Corner Cases', () => {
    test('handles cache misses gracefully (new local mech)', async () => {
      const newId = generateLocalId()

      render(<MechLiveSheet id={newId} />)

      await waitFor(
        () => {
          // Should still render the component even without pre-populated cache
          const elements = screen.queryAllByText(/mech|chassis|sp|ep/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('handles rapid mount/unmount cycles', async () => {
      const { unmount: firstUnmount } = await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          const elements = screen.queryAllByText(/mech|chassis/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )

      firstUnmount()

      const { unmount: secondUnmount } = await render(<MechLiveSheet id={LOCAL_ID} />)
      await waitFor(
        () => {
          const elements = screen.queryAllByText(/mech|chassis/i)
          expect(elements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
      secondUnmount()

      // Should not throw errors
      expect(true).toBe(true)
    })
  })
})
