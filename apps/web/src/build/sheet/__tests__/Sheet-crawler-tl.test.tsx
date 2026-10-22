/**
 * A crawler's Tech Level is the chapter band's TL chip, ahead of its TYPE
 * chip, and nowhere in the body; in Edit the chip carries its stepper, a Free
 * Edit of the stored rung. Exercises the real in-memory store, signed in.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { installConvexMocks } from '../../../components/__tests__/convexMock'

const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
})

const { resetStores } = await import('../../../stores/__tests__/resetStores')
const { withSignedInBackend } = await import('../../../stores/__tests__/signedInBackend')
const { useEntityStore } = await import('../../../stores/entityStore')
const { Sheet } = await import('../Sheet')

afterAll(() => {
  convexMocks.restore()
})

withSignedInBackend()

const crawlerInput = {
  schemaVersion: 1 as const,
  name: 'Iron Tortoise',
  techLevel: 'tech-2',
  systems: [],
}

beforeEach(() => {
  resetStores()
})

/** The band's chips, beside the name (the sheet's one h1). */
function bandOf(): HTMLElement {
  const band = screen.getByRole('heading', { level: 1 }).closest('.su-chapter-band__row')
  if (!(band instanceof HTMLElement)) throw new Error('no chapter band')
  return band
}

describe('Crawler sheet — TL in the head', () => {
  test('Read: the band carries TL, the identity body does not', async () => {
    const crawler = await useEntityStore.getState().create('crawler', crawlerInput)
    await act(async () => {
      render(<Sheet kind="crawler" id={crawler.id} readOnly />)
    })

    const tl = within(bandOf()).getByText('TL')
    expect(tl.closest('.su-stat-cell')?.textContent).toContain('2')
    expect(within(screen.getByLabelText('Crawler identity')).queryByText('TL')).toBeNull()
    expect(screen.queryByRole('button', { name: /tech level/i })).toBeNull()
  })

  test('Edit: the TL chip steps the stored rung', async () => {
    const crawler = await useEntityStore.getState().create('crawler', crawlerInput)
    await act(async () => {
      render(<Sheet kind="crawler" id={crawler.id} />)
    })

    expect(within(screen.getByLabelText('Crawler identity')).queryByText('TL')).toBeNull()
    await act(async () => {
      fireEvent.click(within(bandOf()).getByRole('button', { name: 'Increase Tech Level' }))
    })
    await waitFor(() =>
      expect(useEntityStore.getState().get('crawler', crawler.id)?.techLevel).toBe('tech-3')
    )
  })
})
