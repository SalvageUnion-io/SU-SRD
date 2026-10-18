/**
 * Play's three routes name themselves in the browser tab and stay put.
 *
 * The titles are static: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`), so a route cannot know the pilot's or
 * the Game's name when its `head` runs. `HeadContent` in `__root.tsx` renders
 * them.
 *
 * `router.load()` runs every `beforeLoad` without rendering, so it proves no
 * route redirects away, and that `/play/game/<id>` is the Mediator's screen,
 * not a pilot called "game".
 */

import { describe, expect, test } from 'bun:test'
import { createMemoryHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../../routeTree.gen'
import { Route as PlayPilot } from '../play/$pilotId'
import { Route as PlayGame } from '../play/game/$gameId'
import { Route as PlayLanding } from '../play/index'

async function land(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return {
    pathname: router.state.location.pathname,
    leaf: router.state.matches.at(-1)?.routeId,
  }
}

describe('the Play routes', () => {
  test('each has a page title', async () => {
    expect((await PlayLanding.options.head?.({} as never))?.meta).toEqual([
      { title: 'Play · SalvageUnion.io' },
    ])
    expect((await PlayPilot.options.head?.({} as never))?.meta).toEqual([
      { title: 'Play · SalvageUnion.io' },
    ])
    expect((await PlayGame.options.head?.({} as never))?.meta).toEqual([
      { title: 'Mediate · SalvageUnion.io' },
    ])
  })

  test('the landing, a pilot’s screen and a Game’s each stay put', async () => {
    expect(await land('/play/')).toEqual({ pathname: '/play/', leaf: '/play/' })
    expect(await land('/play/p1')).toEqual({ pathname: '/play/p1', leaf: '/play/$pilotId' })
    expect(await land('/play/game/g1')).toEqual({
      pathname: '/play/game/g1',
      leaf: '/play/game/$gameId',
    })
  })
})
