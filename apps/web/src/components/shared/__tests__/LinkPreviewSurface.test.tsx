import { describe, expect, test } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import { answerRoutes, withWorkerRoutes } from '../../../lib/sharing/__tests__/workerRoutes'
import { sharedPaths } from '../../../lib/sharing/paths'
import { LinkPreviewSurface } from '../LinkPreviewSurface'

/**
 * The render surface Browser Rendering screenshots for a player thing's link
 * preview: the card from the same public answers the Worker's
 * words come from, and `data-og-ready` once it is drawn.
 */

withWorkerRoutes()

const PATTERN = {
  kind: 'pattern',
  body: { name: 'Tow Rig', chassisRef: 'scrapper', systems: [], modules: [] },
  ownerName: 'alxjrvs',
  gameName: null,
}

describe('LinkPreviewSurface', () => {
  test('draws a shared pattern as the user-made card, then says it is ready', async () => {
    answerRoutes({ [sharedPaths.preview('pattern', 'pat-1')]: PATTERN })
    const { container } = render(<LinkPreviewSurface kind="pattern" id="pat-1" />)

    expect(await screen.findByRole('heading', { name: '“Tow Rig”' })).toBeTruthy()
    // The foot is set as a page's footer: the kind, then the byline; the
    // kicker above the title is gone.
    expect(screen.getByText('Mech Pattern · Scrapper')).toBeTruthy()
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(container.querySelector('[data-og-card="userMade"]')).not.toBeNull()
    await waitFor(() => {
      expect(document.documentElement.hasAttribute('data-og-ready')).toBe(true)
    })
  })

  test('draws a thing that is not shared as the plain Private card', async () => {
    answerRoutes({ [sharedPaths.preview('pilot', 'p-2')]: null })
    const { container } = render(<LinkPreviewSurface kind="pilot" id="p-2" />)
    expect(await screen.findByRole('heading', { name: 'Private' })).toBeTruthy()
    expect(container.querySelector('[data-og-card="private"]')).not.toBeNull()
  })

  test('draws nothing while the answer is on its way', () => {
    // No answer yet: the route is still being asked.
    answerRoutes({})
    const { container } = render(<LinkPreviewSurface kind="mech" id="m-1" />)
    expect(container.querySelector('[data-og-card]')).toBeNull()
  })

  test('draws an invite with the Game and its Mediator', async () => {
    answerRoutes({
      [sharedPaths.invite('K7QR2XA')]: {
        gameName: 'Reclamation of the Wastes',
        mediatedBy: 'alxjrvs',
      },
    })
    render(<LinkPreviewSurface kind="invite" id="K7QR2XA" />)
    expect(await screen.findByRole('heading', { name: 'Reclamation of the Wastes' })).toBeTruthy()
    expect(screen.getByText('Mediated by alxjrvs.')).toBeTruthy()
    expect(screen.queryByText(/K7QR2XA/)).toBeNull()
  })

  test('an unknown kind is the private card', () => {
    render(<LinkPreviewSurface kind="private" />)
    expect(screen.getByRole('heading', { name: 'Private' })).toBeTruthy()
  })
})
