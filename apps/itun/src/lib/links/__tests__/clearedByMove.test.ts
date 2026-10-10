/**
 * What a move clears (ADR-037), as a confirm names it before the move and the
 * store's prune drops it after — one read, so the two cannot disagree.
 */

import { describe, expect, test } from 'bun:test'
import type { Container } from '../../container'
import { SHELF } from '../../container'
import type { HeldEntities } from '../clearedByMove'
import { assignmentsClearedByMove, linksClearedByMove } from '../clearedByMove'
import type { LinkShape } from '../linkRules'

function l(type: LinkShape['type'], from: string, to: string): LinkShape {
  const ends = {
    'mech-to-pilot': ['mech', 'pilot'],
    'pilot-to-crawler': ['pilot', 'crawler'],
    'mech-to-crawler': ['mech', 'crawler'],
    'npc-to-crawler': ['npc', 'crawler'],
  } as const
  const [fromType, toType] = ends[type]
  return { type, from: { type: fromType, id: from }, to: { type: toType, id: to } }
}

const G1: Container = { kind: 'game', gameId: 'g1' }

/** A shelf pilot, mech and crawler, plus a mech and a crawler already in g1. */
function held(softLinks: LinkShape[]): HeldEntities {
  return {
    pilots: [{ id: 'p1', name: 'Mira Cole', gameId: null }],
    mechs: [
      { id: 'm1', name: 'Thresher', gameId: null },
      { id: 'mg', name: 'Iron Mongrel', gameId: 'g1' },
    ],
    crawlers: [
      { id: 'c1', name: 'Big Sal', gameId: null },
      { id: 'cg', name: '#430 Tenacity', gameId: 'g1' },
    ],
    npcs: [
      { id: 'n1', name: 'Doc Ambrose', gameId: null },
      { id: 'ng', name: 'Ilsa Varn', gameId: 'g1' },
    ],
    softLinks,
  }
}

const PILOT = { type: 'pilot', id: 'p1' } as const

describe('assignmentsClearedByMove', () => {
  test('a pilot moving into a game loses its pairing with a mech left in My Stuff', () => {
    expect(assignmentsClearedByMove(held([l('mech-to-pilot', 'm1', 'p1')]), PILOT, G1)).toEqual([
      { type: 'mech-to-pilot', other: { kind: 'mech', name: 'Thresher' } },
    ])
  })

  test('and the crew of a crawler left in My Stuff', () => {
    expect(
      assignmentsClearedByMove(
        held([l('mech-to-pilot', 'm1', 'p1'), l('pilot-to-crawler', 'p1', 'c1')]),
        PILOT,
        G1
      )
    ).toEqual([
      { type: 'mech-to-pilot', other: { kind: 'mech', name: 'Thresher' } },
      { type: 'pilot-to-crawler', other: { kind: 'crawler', name: 'Big Sal' } },
    ])
  })

  test('a crawler moving in loses every crew member left behind', () => {
    const links = [
      l('pilot-to-crawler', 'p1', 'c1'),
      l('mech-to-crawler', 'm1', 'c1'),
      // Somebody else's link entirely: not the crawler's to lose.
      l('mech-to-crawler', 'mg', 'cg'),
    ]
    expect(assignmentsClearedByMove(held(links), { type: 'crawler', id: 'c1' }, G1)).toEqual([
      { type: 'pilot-to-crawler', other: { kind: 'pilot', name: 'Mira Cole' } },
      { type: 'mech-to-crawler', other: { kind: 'mech', name: 'Thresher' } },
    ])
  })

  test('nothing to clear: no links, or none touching the build', () => {
    expect(assignmentsClearedByMove(held([]), PILOT, G1)).toEqual([])
    expect(assignmentsClearedByMove(held([l('mech-to-crawler', 'm1', 'c1')]), PILOT, G1)).toEqual(
      []
    )
  })

  test('a link whose other end is already at the destination is kept', () => {
    expect(assignmentsClearedByMove(held([l('mech-to-pilot', 'mg', 'p1')]), PILOT, G1)).toEqual([])
  })

  test('a moving build loses nothing by staying where its links are', () => {
    expect(assignmentsClearedByMove(held([l('mech-to-pilot', 'm1', 'p1')]), PILOT, SHELF)).toEqual(
      []
    )
  })

  test('an other end this browser does not hold is cleared, and named by kind alone', () => {
    expect(assignmentsClearedByMove(held([l('mech-to-pilot', 'gone', 'p1')]), PILOT, G1)).toEqual([
      { type: 'mech-to-pilot', other: { kind: 'mech', name: null } },
    ])
  })
})

describe('linksClearedByMove — the records the store prunes', () => {
  test('returns the held link records themselves, the same set the confirm names', () => {
    const pairing = { ...l('mech-to-pilot', 'm1', 'p1'), id: 'link-1' }
    const kept = { ...l('mech-to-crawler', 'm1', 'c1'), id: 'link-2' }
    const state = { ...held([]), softLinks: [pairing, kept] }
    expect(linksClearedByMove(state, PILOT, G1)).toEqual([pairing])
    expect(assignmentsClearedByMove(state, PILOT, G1)).toHaveLength(1)
  })
})
