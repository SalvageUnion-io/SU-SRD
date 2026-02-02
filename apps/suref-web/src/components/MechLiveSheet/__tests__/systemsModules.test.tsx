import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import MechLiveSheet from '../index'

describe('MechLiveSheet - Systems and Modules', () => {
  describe('Common Cases', () => {
    test('displays systems and modules tab', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Tab is named "Systems & Modules"
          const systemsTab = screen.queryByRole('tab', { name: /systems.*modules/i })
          expect(systemsTab).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    test('displays storage tab', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          const storageTab = screen.queryByRole('tab', { name: /storage/i })
          expect(storageTab).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })

  describe('Corner Cases', () => {
    test('handles empty systems and modules', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Component should still render with empty systems/modules
          const systemsTab = screen.queryByRole('tab', { name: /systems.*modules/i })
          expect(systemsTab).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })
})
