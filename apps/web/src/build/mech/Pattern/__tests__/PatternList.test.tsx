/**
 * The patterns shelf: each saved pattern is a user-made reference
 * card — dashed, stamped, credited (ruleset §3.9) — not a plain solid Card.
 */

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { FIXTURE_NOW } from '../../../../components/__tests__/fixtures'
import { installServerMocks, setQueryAnswers } from '../../../../components/__tests__/serverMock'
import {
  accountAnswers,
  accountApiStub,
  resetAccountApi,
} from '../../../../lib/account/__tests__/accountApiStub'
import { withSignedInBackend } from '../../../../replica/__tests__/signedInBackend'
import type { SyncState } from '../../../../replica/syncContext'

const serverMocks = await installServerMocks({
  router: true,
  also: { '../../lib/account/accountApi': accountApiStub },
})
afterAll(() => serverMocks.restore())

const { SyncContext } = await import('../../../../replica/syncContext')
const { usePatterns } = await import('../../../../replica/collections')
const { PatternList } = await import('../PatternList')

withSignedInBackend()

const CONNECTED: SyncState = {
  status: 'live',
  canWrite: true,
  outdated: false,
}

beforeEach(() => {
  resetAccountApi()
  usePatterns.setState({
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
  test('a pattern row is a dashed, Homebrew, credited reference card', () => {
    setQueryAnswers({})
    accountAnswers.me = { displayName: 'alxjrvs' }
    const { container } = render(
      <SyncContext.Provider value={CONNECTED}>
        <PatternList onInstantiated={() => undefined} />
      </SyncContext.Provider>
    )

    expect(screen.getByText('Homebrew')).toBeTruthy()
    // Titled in typographic quotes, as on the Save preview and the public page.
    expect(screen.getByText('“Tow Rig”')).toBeTruthy()
    expect(screen.queryByText('"Tow Rig"')).toBeNull()
    // The frame's dashes ride `data-user-made` (`.su-entity-compact__frame[data-user-made]`).
    expect(container.querySelector('.su-entity-compact__frame[data-user-made]')).not.toBeNull()
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    expect(screen.queryByText(/Chassis: scrapper/)).toBeNull()
    expect(screen.getByRole('button', { name: /^Build With This: a mech from / })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Instantiate/ })).toBeNull()
  })
})
