/**
 * ⤢ on a Minor opens that entity's Major over the display, as a modal, without
 * moving the slots (docs/architecture/dashboard-redesign.md D3).
 *
 * The overlay renders inside the scaled canvas rather than through a portal,
 * so it owns what a portalled dialog would get for free: it takes focus,
 * closes on Escape, and hands focus back to the ⤢ that opened it. Rendered
 * through the whole Dashboard, so the slot row and the overlay are the real
 * ones. With no Convex in a test build the seat is the default: on foot.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { setEntityBackendAuthState } from '../../../stores/entityBackend'
import { useEntityStore } from '../../../stores/entityStore'
import {
  crawlerFixture,
  mechFixture,
  pilotFixture,
  softLinkFixture,
} from '../../__tests__/fixtures'
import { hydrateStores } from '../../__tests__/hydrateStores'
import { Dashboard } from '../Dashboard'

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
  test("opens the entity's Major controls as a modal that takes focus", async () => {
    const { dialog } = await openMech()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(dialog)
    // The parked mech's Reactor and Chassis, without boarding it.
    expect(within(dialog).getByText('Reactor')).toBeTruthy()
    expect(within(dialog).getByText('Chassis')).toBeTruthy()
    expect(within(dialog).getByText('Parked')).toBeTruthy()
  })

  test('does not move the slots', async () => {
    const { dialog } = await openMech()
    expect(dialog).toBeTruthy()
    // The pilot still holds the Major; the Mech is still a Minor.
    expect(screen.getByText('On Foot')).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Mech · Scrapper' })).toBeTruthy()
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

  test('Tab stays inside the overlay', async () => {
    const { dialog } = await openMech()
    const buttons = within(dialog).getAllByRole('button')
    const first = buttons.at(0) as HTMLButtonElement
    const last = buttons.at(-1) as HTMLButtonElement
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })
})
