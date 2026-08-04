import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ConnectionProvider } from '../../../lib/connection/ConnectionProvider'
import { isConvexConfigured } from '../../../lib/connection/convexClient'
import { MediatorScreen } from '../MediatorScreen'

/**
 * The Mediator surface in a Solo build.
 *
 * Same structural guard as every other Convex-touching screen: `useQuery` and
 * `useMutation` throw without a provider above them, and a Solo build
 * deliberately has none. This screen has more hooks than any other in the app,
 * so it is the one most likely to leak one past the build-time branch.
 *
 * The assertion is that it renders at all — and that it says something true
 * rather than showing an empty mediator console nobody can use.
 */

describe('MediatorScreen in a Solo build', () => {
  test('the test build really is Solo', () => {
    expect(isConvexConfigured).toBe(false)
  })

  test('renders without a Convex provider present', () => {
    render(
      <ConnectionProvider>
        <MediatorScreen gameId="whatever" />
      </ConnectionProvider>
    )
    expect(screen.getByText('Mediator')).toBeTruthy()
  })

  test('explains that there is no table to run rather than showing empty controls', () => {
    render(
      <ConnectionProvider>
        <MediatorScreen gameId="whatever" />
      </ConnectionProvider>
    )
    expect(screen.getByText(/playing solo/i)).toBeTruthy()
    // None of the mediator affordances should be reachable — an inert console
    // is worse than an honest explanation.
    expect(screen.queryByLabelText('NPC name')).toBeNull()
    expect(screen.queryByLabelText('Alert message')).toBeNull()
    expect(screen.queryByLabelText('Proposal target')).toBeNull()
  })
})
