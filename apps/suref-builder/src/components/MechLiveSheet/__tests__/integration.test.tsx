import { describe, test, expect } from 'bun:test'
import { LOCAL_ID } from '../../../lib/cacheHelpers'
import { render, waitFor, screen } from '../../../test/render'
import MechLiveSheet from '../index'

describe('MechLiveSheet - Integration', () => {
  describe('Common Cases', () => {
    test('all tabs render correctly', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Check that tabs exist - correct names from component
          expect(screen.getByRole('tab', { name: /chassis abilities/i })).toBeInTheDocument()
          expect(screen.getByRole('tab', { name: /systems.*modules/i })).toBeInTheDocument()
          expect(screen.getByRole('tab', { name: /storage/i })).toBeInTheDocument()
          expect(screen.getByRole('tab', { name: /notes/i })).toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })

    test('tabs can be clicked', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          expect(screen.getByRole('tab', { name: /storage/i })).toBeInTheDocument()
        },
        { timeout: 3000 }
      )

      // Click the storage tab
      const storageTab = screen.getByRole('tab', { name: /storage/i })
      storageTab.click()
      await waitFor(
        () => {
          expect(storageTab).toHaveAttribute('aria-selected', 'true')
        },
        { timeout: 3000 }
      )
    })

    test('control bar not shown for local mechs', async () => {
      await render(<MechLiveSheet id={LOCAL_ID} />)

      await waitFor(
        () => {
          // Control bar should not be present for local mechs
          const controlBar = screen.queryByRole('button', { name: /active|private/i })
          expect(controlBar).not.toBeInTheDocument()
        },
        { timeout: 3000 }
      )
    })
  })
})
