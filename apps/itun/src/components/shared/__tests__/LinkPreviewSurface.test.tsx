import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import { installConvexMocks, setQueryAnswers } from '../../__tests__/convexMock'

/**
 * The render surface Browser Rendering screenshots for a player thing's link
 * preview (issue 1280): the card from the same public answers the Worker's
 * words come from, and `data-og-ready` once it is drawn.
 */

// Module scope, before the import below: `mock.module` only affects imports
// that resolve after it runs.
const convexMocks = await installConvexMocks()
const { LinkPreviewSurface } = await import('../LinkPreviewSurface')

afterAll(() => {
  convexMocks.restore()
})

const PATTERN = {
  kind: 'pattern',
  body: { name: 'Tow Rig', chassisRef: 'scrapper', systems: [], modules: [] },
  ownerName: 'alxjrvs',
  gameName: null,
}

describe('LinkPreviewSurface', () => {
  test('draws a shared pattern as the user-made card, then says it is ready', async () => {
    setQueryAnswers({ 'publicSheet:preview': PATTERN })
    const { container } = render(<LinkPreviewSurface kind="pattern" id="pat-1" />)

    expect(screen.getByRole('heading', { name: '“Tow Rig”' })).toBeTruthy()
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(container.querySelector('[data-og-card="userMade"]')).not.toBeNull()
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-og-ready')).toBe(true)
    })
  })

  test('draws a thing that is not shared as the plain Private card', () => {
    setQueryAnswers({ 'publicSheet:preview': null })
    const { container } = render(<LinkPreviewSurface kind="pilot" id="p-2" />)
    expect(screen.getByRole('heading', { name: 'Private' })).toBeTruthy()
    expect(container.querySelector('[data-og-card="private"]')).not.toBeNull()
  })

  test('draws nothing while the answer is on its way', () => {
    setQueryAnswers({ 'publicSheet:preview': undefined })
    const { container } = render(<LinkPreviewSurface kind="mech" id="m-1" />)
    expect(container.querySelector('[data-og-card]')).toBeNull()
  })

  test('draws an invite with the Game and its Mediator', () => {
    setQueryAnswers({
      'publicSheet:invitePreview': {
        gameName: 'Reclamation of the Wastes',
        mediatedBy: 'alxjrvs',
        role: 'player',
        requiresApproval: false,
        expiresAt: Date.UTC(2026, 9, 15, 12),
      },
    })
    render(<LinkPreviewSurface kind="invite" id="K7QR2XA" />)
    expect(screen.getByRole('heading', { name: 'Reclamation of the Wastes' })).toBeTruthy()
    expect(screen.getByText('Mediated by alxjrvs.')).toBeTruthy()
    expect(screen.queryByText(/K7QR2XA/)).toBeNull()
  })

  test('an unknown kind is the private card', () => {
    render(<LinkPreviewSurface kind="private" />)
    expect(screen.getByRole('heading', { name: 'Private' })).toBeTruthy()
  })
})
