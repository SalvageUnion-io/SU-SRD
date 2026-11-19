/**
 * Play's three routes name themselves in the browser tab and stay put.
 *
 * The titles are static: loaders never read player entities
 * (`.claude/rules/tanstack-router.md`), so a route cannot know the pilot's or
 * the Game's name when its `head` runs. `HeadContent` in `__root.tsx` renders
 * them.
 *
 * `router.load()` runs every `beforeLoad` without rendering, so it proves no
 * route redirects away, that `/games/<id>/mediate` is the Mediator's screen
 * and not nested in the Game's page, that a pilot's Play is its own page's
 * mode, and that the Games are at their own root on the site, `/games/…`.
 */

import { describe, expect, test } from 'bun:test'
import { Route as PlayGame } from '../games/$gameId_/mediate'
import { Route as PlayLanding } from '../games/index'
import { Route as PlayPilot } from '../pilots/$id_/play'
import { land } from './landOn'

describe('the Games and Play routes', () => {
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
    expect(await land('/games/')).toEqual({ pathname: '/games/', leaf: '/games/' })
    expect(await land('/pilots/p1/play')).toEqual({
      pathname: '/pilots/p1/play',
      leaf: '/pilots/$id_/play',
    })
    expect(await land('/games/g1/mediate')).toEqual({
      pathname: '/games/g1/mediate',
      leaf: '/games/$gameId_/mediate',
    })
    expect(await land('/games/g1')).toEqual({
      pathname: '/games/g1',
      leaf: '/games/$gameId',
    })
  })

  test('on the site, the Games are at their own root and Build under the base', async () => {
    expect(await land('/games/g1', true)).toEqual({
      pathname: '/games/g1',
      address: '/games/g1',
      leaf: '/games/$gameId',
    })
    expect(await land('/build/pilots/p1/play', true)).toEqual({
      pathname: '/pilots/p1/play',
      address: '/build/pilots/p1/play',
      leaf: '/pilots/$id_/play',
    })
    expect(await land('/build/pilots/p1', true)).toEqual({
      pathname: '/pilots/p1',
      address: '/build/pilots/p1',
      leaf: '/pilots/$id',
    })
  })
})
