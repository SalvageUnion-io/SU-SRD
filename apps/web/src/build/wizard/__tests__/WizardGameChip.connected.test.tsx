import { afterAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'

/**
 * A wizard started for a Game (`?game=<id>`, ADR-052 §3) names it on its
 * head: the relation chip `GAME | <name>` (C11), its value the way to the
 * Game's page in Play. Queries are answered by name (`convexMock.ts`).
 */

import {
  installConvexMocks,
  queryCalls,
  setQueryAnswers,
} from '../../../components/__tests__/convexMock'

const convexMocks = await installConvexMocks({ router: true })

const { WizardGameChip } = await import('../WizardGameChip')
const { ConnectionProvider } = await import('../../../lib/connection/ConnectionProvider')

const wrap = () =>
  render(
    <ConnectionProvider>
      <WizardGameChip gameId="g1" />
    </ConnectionProvider>
  )

describe("a wizard's Game chip", () => {
  test('reads GAME | the name, and links to the Game’s page in Play', () => {
    setQueryAnswers({ 'games:get': { _id: 'g1', name: 'Rust Run' } })
    wrap()
    expect(screen.getByText('Game')).toBeTruthy()
    const link = screen.getByText('Rust Run').closest('a')
    expect(link?.getAttribute('href')).toMatch(/\/play\/games\/g1$/)
    expect(queryCalls()).toEqual([{ name: 'games:get', args: { gameId: 'g1' } }])
  })

  test('shows nothing while the Game loads, or for a Game the player cannot see', () => {
    setQueryAnswers({ 'games:get': undefined })
    const loading = wrap().container
    expect(loading.textContent).toBe('')
    setQueryAnswers({ 'games:get': null })
    const hidden = wrap().container
    expect(hidden.textContent).toBe('')
  })
})

afterAll(convexMocks.restore)
