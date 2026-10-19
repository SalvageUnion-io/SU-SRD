/**
 * `/p/$kind/$appId`: what the page shows before, and instead of, a public sheet.
 */

import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../components/__tests__/convexMock'
import { npcFixture } from '../../components/__tests__/fixtures'

// Module scope, before the import below — see `convexMock.ts`.
const convexMocks = await installConvexMocks()
afterAll(() => convexMocks.restore())

const { PublicSheetView } = await import('../../build/sheet/PublicSheetView')

describe('the public sheet route', () => {
  test('a sheet that is not public says so', () => {
    setQueryAnswers({ 'publicSheet:get': null })
    render(<PublicSheetView kind="pilot" appId="anything" />)
    // `getByText` throws when absent, so this asserts presence twice over.
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
  })

  test('a built NPC shared by link is its own read-only page, credited to its maker', () => {
    setQueryAnswers({
      'publicSheet:get': {
        kind: 'npc',
        body: npcFixture({ id: 'npc-1', name: 'Old Mags' }),
        madeBy: 'Rosa',
        links: [],
        linked: [],
        withheld: [],
      },
    })
    render(<PublicSheetView kind="npc" appId="npc-1" />)
    expect(screen.getAllByText('Old Mags').length).toBeGreaterThan(0)
    expect(screen.getByText('Rosa')).toBeTruthy() // MADE BY | Rosa, on the band
    expect(screen.getByText(/a shared NPC, read-only/i)).toBeTruthy()
    // Read-only: no Share, no Delete.
    expect(screen.queryByRole('button', { name: /share old mags/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete old mags/i })).toBeNull()
  })

  test('a private NPC is not available, as any private thing is', () => {
    setQueryAnswers({ 'publicSheet:get': null })
    render(<PublicSheetView kind="npc" appId="npc-1" />)
    expect(screen.getByText(/this NPC isn['’]t available/i)).toBeTruthy()
  })

  test('an unknown kind gets the same page, not a server round trip', () => {
    setQueryAnswers({})
    render(<PublicSheetView kind="dropship" appId="anything" />)
    expect(screen.getByText(/isn['’]t available/i)).toBeTruthy()
    expect(queryCalls()).toEqual([])
  })
})
