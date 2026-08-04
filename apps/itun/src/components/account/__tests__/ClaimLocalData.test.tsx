import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { ClaimLocalData } from '../ClaimLocalData'

/**
 * The claim prompt must not appear where it cannot work.
 *
 * Solo has no account to claim into and Disconnected cannot write, so offering
 * the button there would fail on click — and this component reads four stores
 * plus a Convex mutation, so a leak past the build-time branch would crash the
 * account page for every user who never signs in.
 */

describe('ClaimLocalData in a Solo build', () => {
  test('the test build really is Solo', () => {
    expect(isConvexConfigured).toBe(false)
  })

  test('renders nothing at all', () => {
    const { container } = render(
      <ConnectionProvider>
        <ClaimLocalData />
      </ConnectionProvider>
    )
    // Not a disabled prompt — silence. There is nothing to claim into.
    expect(container.innerHTML).toBe('')
    expect(screen.queryByText(/copy to my account/i)).toBeNull()
  })
})
