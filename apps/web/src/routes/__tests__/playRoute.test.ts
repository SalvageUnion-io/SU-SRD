/**
 * Play's three routes name themselves in the browser tab and stay put.
 *
 * The titles are static: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`), so a route cannot know the pilot's or
 * the Game's name when its `head` runs. `HeadContent` in `__root.tsx` renders
 * them.
 *
 * `router.load()` runs every `beforeLoad` without rendering, so it proves no
 * route redirects away, that `/play/games/<id>/mediate` is the Mediator's
 * screen and not nested in the Game's page, and that Play is at its own root
 * on the site, `/play/…`, outside the base.
 */

import { describe, expect, test } from 'bun:test'
import { Route as PlayGame } from '../play/games/$gameId_/mediate'
import { Route as PlayLanding } from '../play/index'
import { Route as PlayPilot } from '../play/pilots/$pilotId'
import { land } from './landOn'

describe('the Play routes', () => {
  test('each has a page title', async () => {
    expect((await PlayLanding.options.head?.({} as never))?.meta).toEqual([
      { title: 'The Cantina · SalvageUnion.io' },
    ])
    expect((await PlayPilot.options.head?.({} as never))?.meta).toEqual([
      { title: 'Play · The Cantina · SalvageUnion.io' },
    ])
    expect((await PlayGame.options.head?.({} as never))?.meta).toEqual([
      { title: 'Mediate · The Cantina · SalvageUnion.io' },
    ])
  })

  test('the landing, a pilot’s screen and a Game’s each stay put', async () => {
    expect(await land('/play/')).toEqual({ pathname: '/play/', leaf: '/play/' })
    expect(await land('/play/pilots/p1')).toEqual({
      pathname: '/play/pilots/p1',
      leaf: '/play/pilots/$pilotId',
    })
    expect(await land('/play/games/g1/mediate')).toEqual({
      pathname: '/play/games/g1/mediate',
      leaf: '/play/games/$gameId_/mediate',
    })
    expect(await land('/play/games/g1')).toEqual({
      pathname: '/play/games/g1',
      leaf: '/play/games/$gameId',
    })
  })

  test('on the site, Play is at its own root and Build under the base', async () => {
    expect(await land('/play/games/g1', true)).toEqual({
      pathname: '/play/games/g1',
      address: '/play/games/g1',
      leaf: '/play/games/$gameId',
    })
    expect(await land('/build/pilots/p1', true)).toEqual({
      pathname: '/pilots/p1',
      address: '/build/pilots/p1',
      leaf: '/pilots/$id',
    })
  })
})
