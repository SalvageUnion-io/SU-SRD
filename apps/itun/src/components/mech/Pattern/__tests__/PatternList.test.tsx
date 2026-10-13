/**
 * The patterns shelf (issue 1276): each saved pattern is a user-made reference
 * card — dashed, stamped, credited (ruleset §3.9) — not a plain solid Card.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { ConnectionState } from '../../../../lib/connection/connectionContext'
import { withSignedInBackend } from '../../../../stores/__tests__/signedInBackend'
import { installConvexMocks, setQueryAnswers } from '../../../__tests__/convexMock'
import { FIXTURE_NOW } from '../../../__tests__/fixtures'

const convexMocks = await installConvexMocks({
  convexClient: { mutation: async () => ({ updatedAt: 1 }) },
  router: true,
})
afterAll(() => convexMocks.restore())

const { ConnectionContext } = await import('../../../../lib/connection/connectionContext')
const { usePatternStore } = await import('../../../../stores/patternStore')
const { PatternList } = await import('../PatternList')

withSignedInBackend()

const CONNECTED: ConnectionState = {
  mode: 'connected',
  canWrite: true,
  showDisconnectedWarning: false,
  settling: false,
}

beforeEach(() => {
  usePatternStore.setState({
    mechPatterns: [
      {
        id: 'pat-tow-rig',
        schemaVersion: 1,
        name: 'Tow Rig',
        chassisRef: 'scrapper',
        systems: ['rigging-arm'],
        modules: ['comms-module'],
        cargoLots: [],
        createdAt: FIXTURE_NOW,
      },
    ],
    hydrated: true,
  })
})

describe('PatternList', () => {
  test('a pattern row is a dashed, User-made, credited reference card', () => {
    setQueryAnswers({ 'account:me': { displayName: 'alxjrvs' } })
    const { container } = render(
      <ConnectionContext.Provider value={CONNECTED}>
        <PatternList onInstantiated={() => undefined} />
      </ConnectionContext.Provider>
    )

    expect(screen.getByText('User-made')).toBeTruthy()
    // Titled in typographic quotes, as on the Save preview and the public page.
    expect(screen.getByText('“Tow Rig”')).toBeTruthy()
    expect(screen.queryByText('"Tow Rig"')).toBeNull()
    // The frame's dashes ride `data-user-made` (`.su-entity-row__frame[data-user-made]`).
    expect(container.querySelector('.su-entity-row__frame[data-user-made]')).not.toBeNull()
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(screen.queryByText(/Chassis: scrapper/)).toBeNull()
    expect(screen.getByRole('button', { name: /Build this mech/ })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Instantiate/ })).toBeNull()
  })
})
