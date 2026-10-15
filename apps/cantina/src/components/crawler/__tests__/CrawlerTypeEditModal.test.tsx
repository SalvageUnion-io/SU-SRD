/**
 * CrawlerTypeEditModal — the live sheet's "Change crawler type" picker.
 *
 * Pins the destructive flow: the confirm button is inert until a DIFFERENT
 * type is chosen, nothing is written until the danger dialog is confirmed, the
 * write is ONE record update (new type, the new type's default NPC, the old
 * type's Keepsake/Motto dropped), and a failed write says so and leaves the
 * picker open rather than closing as if it had worked.
 *
 * Renders against the real crawler types (five of them); the store is an
 * injected mock, so no backend is involved.
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { Crawler } from 'cantina-domain/schemas/crawler'
import { Toaster, toast } from 'component-lib'
import { WIZARD_TXN } from '../../../stores/surfaceProvenance'
import { crawlerFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { CrawlerTypeEditModal } from '../CrawlerTypeEditModal'

const CRAWLER = crawlerFixture({
  id: 'crawler-1',
  name: 'Tenacity',
  type: 'augmented',
  typeNpc: { npcName: 'Oracle' },
  bayChoices: {
    augmented: { 'aug-motto': ['We see all'] },
    'storage-bay': { 'storage-keepsake': ['A key'] },
  },
})

type UpdateFn = (type: string, id: string, patch: Partial<Crawler>, meta?: unknown) => unknown

function renderModal(update: UpdateFn, onClose = mock(() => {})) {
  const store = makeEntityStoreMock({
    crawlers: [CRAWLER],
    update: mock(async (type, id, patch, meta) => {
      await update(type, id, patch as Partial<Crawler>, meta)
      return CRAWLER
    }),
  })
  render(
    <>
      <Toaster />
      <CrawlerTypeEditModal
        open
        onClose={onClose}
        crawler={CRAWLER}
        storeState={store.getState()}
      />
    </>
  )
  return { onClose }
}

const changeButton = () => screen.getByRole('button', { name: 'Change type…' })

// A mounting Toaster replays every toast still active from earlier files.
beforeEach(() => {
  toast.dismiss()
})
afterEach(() => {
  toast.dismiss()
})

describe('CrawlerTypeEditModal', () => {
  test('starts on the current type and offers no change until another is picked', async () => {
    const writes: unknown[] = []
    renderModal((...args) => writes.push(args))

    expect(screen.getByTestId('rail-entry').textContent).toContain('Augmented')
    expect(changeButton().hasAttribute('disabled')).toBe(true)

    // Clicking the current type clears the pick — still no change to make.
    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Augmented' }))
    })
    expect(screen.queryAllByTestId('rail-entry')).toHaveLength(0)
    expect(changeButton().hasAttribute('disabled')).toBe(true)
    expect(writes).toEqual([])
  })

  test('confirming writes the new type, its default NPC, and drops the old Keepsake/Motto', async () => {
    const writes: Parameters<UpdateFn>[] = []
    const { onClose } = renderModal((...args) => {
      writes.push(args)
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Battle' }))
    })
    expect(changeButton().hasAttribute('disabled')).toBe(false)
    await act(async () => {
      fireEvent.click(changeButton())
    })

    // The danger dialog names the destination and has written nothing yet.
    const dialog = screen.getByRole('dialog', { name: 'Change crawler type?' })
    expect(within(dialog).getByText('Battle')).toBeTruthy()
    expect(writes).toEqual([])

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Change type' }))
    })

    expect(writes).toEqual([
      [
        'crawler',
        'crawler-1',
        {
          type: 'battle',
          // Augmented's motto is gone; the bay's own choices stay.
          bayChoices: { 'storage-bay': { 'storage-keepsake': ['A key'] } },
          // Reset to Battle's default (10 HP) — Oracle's name does not carry over.
          typeNpc: { npcCurrentHP: 10 },
        },
        WIZARD_TXN,
      ],
    ])
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Changed crawler type to Battle.')).toBeTruthy()
  })

  test('Cancel in the confirm returns to the picker with the pick kept', async () => {
    const writes: unknown[] = []
    const { onClose } = renderModal((...args) => writes.push(args))

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Engineering' }))
    })
    await act(async () => {
      fireEvent.click(changeButton())
    })
    const dialog = screen.getByRole('dialog', { name: 'Change crawler type?' })
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    })

    expect(screen.queryByRole('dialog', { name: 'Change crawler type?' })).toBeNull()
    expect(screen.getByTestId('rail-entry').textContent).toContain('Engineering')
    expect(writes).toEqual([])
    expect(onClose).not.toHaveBeenCalled()
  })

  test('a failed write is said, and the modal stays open', async () => {
    const { onClose } = renderModal(() => {
      throw new Error('boom')
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('radio', { name: 'Exploratory' }))
    })
    await act(async () => {
      fireEvent.click(changeButton())
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Change type' }))
    })

    expect(
      await screen.findByText('The crawler type could not be changed. Try again.')
    ).toBeTruthy()
    expect(onClose).not.toHaveBeenCalled()
    // Back on the picker, the pick still in hand.
    expect(screen.queryByRole('dialog', { name: 'Change crawler type?' })).toBeNull()
    expect(screen.getByTestId('rail-entry').textContent).toContain('Exploratory')
  })

  test('the rail Cancel closes without writing', async () => {
    const writes: unknown[] = []
    const { onClose } = renderModal((...args) => writes.push(args))
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    })
    expect(onClose).toHaveBeenCalled()
    expect(writes).toEqual([])
  })
})
