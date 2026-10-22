/**
 * A live sheet launches nothing. Play opens from Play's landing and the Game
 * hub, so no sheet — shelf or Game, pilot or mech — offers a way in, or a hint
 * pointing at one.
 *
 * Rendered without a RouterProvider — AppLink degrades to plain anchors.
 */

import { beforeAll, describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { mechFixture, pilotFixture } from '../../../components/__tests__/fixtures'
import { hydrateStores } from '../../../components/__tests__/hydrateStores'
import {
  makeEntityLookupMock,
  makeSoftLinkStoreMock,
} from '../../../components/__tests__/mockEntityStore'
import { Sheet } from '../Sheet'

beforeAll(hydrateStores)

/** No button or link into Play, and no "Play in a Game" signpost. */
function expectNoLauncher(): void {
  expect(screen.queryByRole('button', { name: /dashboard|^play\b/i })).toBeNull()
  expect(screen.queryByRole('link', { name: /dashboard|^play\b/i })).toBeNull()
  expect(screen.queryByText(/play in a game/i)).toBeNull()
  for (const link of screen.queryAllByRole('link')) {
    expect(link.getAttribute('href') ?? '').not.toContain('/dashboard')
    expect(link.getAttribute('href') ?? '').not.toContain('/play/')
  }
}

const cases = [
  {
    label: 'a Training Bay pilot',
    kind: 'pilot',
    entity: pilotFixture({ id: 'p-shelf', name: 'Yara' }),
  },
  {
    label: 'a Game pilot',
    kind: 'pilot',
    entity: pilotFixture({ id: 'p-game', name: 'Yara', gameId: 'game-a' }),
  },
  {
    label: 'a Training Bay mech',
    kind: 'mech',
    entity: mechFixture({ id: 'm-shelf', name: 'Rig', chassisRef: 'iron-mongrel' }),
  },
  {
    label: 'a Game mech',
    kind: 'mech',
    entity: mechFixture({
      id: 'm-game',
      name: 'Rig',
      chassisRef: 'iron-mongrel',
      gameId: 'game-a',
    }),
  },
] as const

describe('Live Sheet — no Play launcher', () => {
  for (const { label, kind, entity } of cases) {
    test(`${label}'s editable sheet has none`, () => {
      render(
        <Sheet
          kind={kind}
          id={entity.id}
          entityStore={makeEntityLookupMock([entity])}
          softLinkStore={makeSoftLinkStoreMock([])}
        />
      )
      expect(screen.getAllByText(entity.name).length).toBeGreaterThan(0)
      expectNoLauncher()
    })
  }
})
