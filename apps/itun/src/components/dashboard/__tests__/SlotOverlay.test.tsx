/**
 * ⤢ on a Minor opens that entity's Major over the display, as a modal, without
 * moving the slots (ADR-038 §3).
 *
 * The overlay is a ModalShell portalled into the display region, inside the
 * scaled canvas: it takes focus, closes on Escape, and hands focus back to the
 * ⤢ that opened it. Rendered through the whole Dashboard, so the slot row and
 * the overlay are the real ones. The pilot is in no Game, so the seat is the
 * default: on foot.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'

// Module scope, before the imports below — see `convexMock.ts`. Every Game
// query skips, so none needs an answer.
const convexMocks = await installConvexMocks()
setQueryAnswers({})

const { setEntityBackendAuthState } = await import('../../../stores/entityBackend')
const { useEntityStore } = await import('../../../stores/entityStore')
const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { Dashboard } = await import('../Dashboard')

const PILOT = 'ovl-pilot'
const MECH = 'ovl-mech'
const CRAWLER = 'ovl-crawler'

beforeAll(async () => {
  await hydrateStores()
  setEntityBackendAuthState({ signedIn: false, online: true, authSettled: true })
  const store = useEntityStore.getState()
  await store.adopt('pilot', pilotFixture({ id: PILOT, name: 'Rook' }))
  await store.adopt('mech', mechFixture({ id: MECH, name: 'Scrapper', currentSP: 6 }))
  await store.adopt('crawler', crawlerFixture({ id: CRAWLER, name: 'Mother Hen' }))
  await store.adopt('softLink', softLinkFixture('mech-to-pilot', MECH, PILOT, 'ovl-l1'))
  await store.adopt('softLink', softLinkFixture('pilot-to-crawler', PILOT, CRAWLER, 'ovl-l2'))
})

afterAll(async () => {
  const store = useEntityStore.getState()
  await store.forget('softLink', 'ovl-l1')
  await store.forget('softLink', 'ovl-l2')
  await store.forget('crawler', CRAWLER)
  await store.forget('mech', MECH)
  await store.forget('pilot', PILOT)
  convexMocks.restore()
})

async function openMech() {
  render(<Dashboard pilotId={PILOT} />)
  const expand = screen.getByRole('button', { name: 'Open the Mech controls' })
  await act(async () => {
    fireEvent.click(expand)
  })
  return { expand, dialog: screen.getByRole('dialog', { name: 'Mech · Scrapper' }) }
}

describe('⤢ overlay', () => {
  test("opens the entity's Major controls over the display, and takes focus", async () => {
    const { dialog } = await openMech()
    // Portalled into the display region, not the document body: the Major's
    // `.pc-*` styling needs the canvas's `.pc-root` scope.
    expect(dialog.closest('.pc-root')).toBeTruthy()
    expect(dialog.contains(document.activeElement)).toBe(true)
    // The parked mech's Reactor and Chassis, without boarding it.
    expect(within(dialog).getByText('Reactor')).toBeTruthy()
    expect(within(dialog).getByText('Chassis')).toBeTruthy()
    expect(within(dialog).getByText('Parked')).toBeTruthy()
  })

  test('does not move the slots', async () => {
    const { dialog } = await openMech()
    expect(dialog).toBeTruthy()
    // The pilot still holds the Major; the Mech is still a Minor. (Behind the
    // modal, so hidden from the accessibility tree while it is open.)
    expect(screen.getByText('On Foot')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Mech · Scrapper', hidden: true })).toBeTruthy()
  })

  test('closes on Escape and returns focus to ⤢', async () => {
    const { expand, dialog } = await openMech()
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' })
    })
    expect(screen.queryByRole('dialog', { name: 'Mech · Scrapper' })).toBeNull()
    expect(document.activeElement).toBe(expand)
  })

  test('Close returns focus to ⤢ too', async () => {
    const { expand, dialog } = await openMech()
    const close = within(dialog)
      .getAllByRole('button', { name: 'Close' })
      .at(0) as HTMLButtonElement
    await act(async () => {
      fireEvent.click(close)
    })
    expect(screen.queryByRole('dialog', { name: 'Mech · Scrapper' })).toBeNull()
    expect(document.activeElement).toBe(expand)
  })

  test('Escape inside a prompt closes the prompt, not the overlay', async () => {
    const { dialog } = await openMech()
    await act(async () => {
      fireEvent.click(within(dialog).getByText('Take Dmg'))
    })
    expect(within(dialog).getByRole('dialog', { name: 'Take Structure Damage' })).toBeTruthy()
    await act(async () => {
      fireEvent.keyDown(within(dialog).getByText('Apply −1 SP'), { key: 'Escape' })
    })
    expect(within(dialog).queryByRole('dialog', { name: 'Take Structure Damage' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Mech · Scrapper' })).toBeTruthy()
  })
})
