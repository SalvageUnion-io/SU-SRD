/**
 * A Starter Set sheet, signed out: the real sheet over the template, read-only,
 * its band naming its owner, its rail inside `/starter`, and "Make a copy"
 * asking the visitor to sign in first. The copy itself is
 * `StarterSet.connected.test.tsx`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { installConvexMocks } from '../../__tests__/convexMock'

// The signed-out "Make a copy" is the sign-in button, whose provider wants a
// live Convex client. Module scope, before the imports below.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) },
})
afterAll(() => convexMocks.restore())

const { hydrateStores } = await import('../../__tests__/hydrateStores')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { StarterSheetView } = await import('../StarterSheetView')

beforeAll(hydrateStores)

describe('a Starter Set sheet', () => {
  test('is the template’s own sheet, read-only, its band naming Leyline Press', () => {
    render(
      <ConnectionProvider>
        <StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />
      </ConnectionProvider>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Bonesaw' })).toBeTruthy()
    expect(screen.getByText('Starter Set · Leyline Press · read-only')).toBeTruthy()
    // Read-only: no edit affordance at all, so nothing can reach a template.
    // Read | Edit prints beside "Make a copy" (board 10), with Edit off.
    expect(screen.queryByLabelText(/Share this pilot/i)).toBeNull()
    expect(screen.getByRole('group', { name: /Read or edit/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Read' }).getAttribute('aria-pressed')).toBe('true')
    expect((screen.getByRole('button', { name: 'Edit' }) as HTMLButtonElement).disabled).toBe(true)
    // Signed out, "Make a copy" signs in first.
    expect(screen.getByRole('button', { name: 'Sign in to make a copy' })).toBeTruthy()
  })

  test('its crewmates open as Starter Set sheets too', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />)

    const mech = screen.getByRole('link', { name: /^View Scrapper/ })
    expect(mech.getAttribute('href')).toBe('/starter/mech/starter-mech-scrapper')
  })

  test('anything not in the Starter Set says so', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-nobody" />)
    expect(screen.getByRole('heading', { name: /isn.t in the Starter Set/ })).toBeTruthy()

    render(<StarterSheetView kind="softLink" id="starter-pilot-bonesaw" />)
    expect(screen.getAllByRole('heading', { name: /isn.t in the Starter Set/ })).toHaveLength(2)
  })
})
