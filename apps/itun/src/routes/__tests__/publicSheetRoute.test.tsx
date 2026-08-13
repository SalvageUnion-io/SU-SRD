/**
 * `/p/$kind/$appId` in a build with no Convex.
 *
 * This test exists because the route shipped without it and was wrong. A build
 * with no `VITE_CONVEX_URL` mounts no Convex provider at all, and `useQuery`
 * calls `useQueries` on every path — `'skip'` included — so an ungated hook
 * throws "Could not find Convex client!" and the route renders the root error
 * boundary instead of a page.
 *
 * That build is not a corner case: every Netlify deploy preview and branch
 * deploy is one, as is a fresh checkout, as is this test environment. Which is
 * precisely why rendering the route here is the check that catches it.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { isConvexConfigured } from '../../lib/connection/convexClient'
import { PublicSheetView } from '../p.$kind.$appId'

describe('the public sheet route in a Solo build', () => {
  test('the test environment really is Convex-free', () => {
    // If this ever flips, the assertions below stop testing what they claim
    // to, so it is asserted rather than assumed.
    expect(isConvexConfigured).toBe(false)
  })

  test('renders instead of throwing "Could not find Convex client!"', () => {
    // The regression: an ungated `useQuery` throws here, because no provider is
    // mounted at all. `'skip'` would not have helped — `useQuery` calls
    // `useQueries` on every path.
    expect(() => render(<PublicSheetView kind="pilot" appId="anything" />)).not.toThrow()
  })

  test('says the sheet is unavailable rather than showing an error boundary', () => {
    render(<PublicSheetView kind="pilot" appId="anything" />)
    // `getByText` throws when absent, so this asserts presence twice over.
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
  })

  test('an unknown kind gets the same page, not a server round trip', () => {
    render(<PublicSheetView kind="dropship" appId="anything" />)
    // `getByText` throws when absent, so this asserts presence twice over.
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
  })
})
