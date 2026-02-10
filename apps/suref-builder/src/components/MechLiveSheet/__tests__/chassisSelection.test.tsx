import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import MechLiveSheet from '../index'

describe('MechLiveSheet - Chassis Selection', () => {
  describe('Common Cases', () => {
    test('displays chassis selector', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          const chassisElements = screen.getAllByText(/chassis/i)
          expect(chassisElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })

    test('displays chassis abilities tab', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Should show chassis abilities tab
          const abilitiesTab = screen.queryByRole('tab', { name: /chassis abilities/i })
          expect(abilitiesTab).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Corner Cases', () => {
    test('handles mech without chassis gracefully', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Should show chassis selector even when no chassis selected
          const chassisElements = screen.queryAllByText(/chassis/i)
          expect(chassisElements.length).toBeGreaterThan(0)
        },
        { timeout: 3000 }
      )
    })
  })
})
