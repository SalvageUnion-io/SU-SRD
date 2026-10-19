/**
 * A Starter Set sheet, signed out: the real sheet over the template, read-only,
 * its band naming its owner, its rail inside `/starter`, and "Make a copy"
 * asking the visitor to sign in first. The copy itself is
 * `StarterSet.connected.test.tsx`.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { installConvexMocks } from '../../../components/__tests__/convexMock'

// The signed-out "Make a copy" is the sign-in button, whose provider wants a
// live Convex client. Module scope, before the imports below.
const convexMocks = await installConvexMocks({
  authReact: true,
  convexReact: { useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }) },
})
afterAll(() => convexMocks.restore())

const { hydrateStores } = await import('../../../components/__tests__/hydrateStores')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')
const { StarterSheetView } = await import('../StarterSheetView')

beforeAll(hydrateStores)

describe('a Starter Set sheet', () => {
  test('is the template’s own sheet, read-only, with "Make a copy" in its band’s corner', () => {
    render(
      <ConnectionProvider>
        <StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />
      </ConnectionProvider>
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Bonesaw (Pilot)' })).toBeTruthy()
    // No back link, and no provenance line: the band says only the name.
    expect(screen.queryByRole('link', { name: /back to/i })).toBeNull()
    expect(screen.queryByText(/Leyline Press/)).toBeNull()
    // Read-only: no edit affordance at all, so nothing can reach a template —
    // not even a disabled Read | Edit, which could only say no.
    expect(screen.queryByLabelText(/Share this pilot/i)).toBeNull()
    expect(screen.queryByRole('group', { name: /Read or edit/ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    // Signed out, "Make a copy" signs in first, at the full rung (a 44px
    // target, not the 30px compact one).
    const copy = screen.getByRole('button', { name: 'Sign in to make a copy' })
    expect(copy.className).toContain('su-btn--full')
    expect(copy.closest('.su-chapter-band__corner')).not.toBeNull()
    // The band names the class and Bonesaw's callsign is the title, so the
    // identity card repeats neither under it.
    expect(screen.getAllByText('Engineer')).toHaveLength(1)
    expect(screen.queryByText('Callsign')).toBeNull()
  })

  test('its crewmates open as Starter Set sheets too', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-bonesaw" />)

    const mech = screen.getByRole('link', { name: /Scrapper/ })
    expect(mech.getAttribute('href')).toBe('/starter/mech/starter-mech-scrapper')
  })

  test('anything not in the Starter Set says so', () => {
    render(<StarterSheetView kind="pilot" id="starter-pilot-nobody" />)
    expect(screen.getByRole('heading', { name: /isn.t in the Starter Set/ })).toBeTruthy()

    render(<StarterSheetView kind="softLink" id="starter-pilot-bonesaw" />)
    expect(screen.getAllByRole('heading', { name: /isn.t in the Starter Set/ })).toHaveLength(2)
  })
})
