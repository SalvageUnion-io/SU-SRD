/**
 * The assignment model's pure rules (ADR-037) — the copy both the store and
 * the Convex backend import, so these pin the rule rather than either caller.
 */

import { describe, expect, test } from 'bun:test'
import type { Container } from '../../container'
import { SHELF } from '../../container'
import type { LinkShape } from '../linkRules'
import {
  conflictingLinks,
  endsMatchType,
  linksBrokenByMove,
  linkTypeFor,
  resolveLinkType,
} from '../linkRules'

function l(type: LinkShape['type'], from: string, to: string): LinkShape {
  const ends = {
    'mech-to-pilot': ['mech', 'pilot'],
    'pilot-to-crawler': ['pilot', 'crawler'],
    'mech-to-crawler': ['mech', 'crawler'],
  } as const
  const [fromType, toType] = ends[type]
  return { type, from: { type: fromType, id: from }, to: { type: toType, id: to } }
}

const game = (gameId: string): Container => ({ kind: 'game', gameId })

describe('link types', () => {
  test('each pair of ends has at most one link type', () => {
    expect(linkTypeFor('mech', 'pilot')).toBe('mech-to-pilot')
    expect(linkTypeFor('pilot', 'crawler')).toBe('pilot-to-crawler')
    expect(linkTypeFor('mech', 'crawler')).toBe('mech-to-crawler')
    expect(linkTypeFor('pilot', 'mech')).toBeNull()
    expect(linkTypeFor('crawler', 'pilot')).toBeNull()
  })

  test('resolveLinkType throws for a pairing nothing joins', () => {
    expect(() => resolveLinkType('crawler', 'mech')).toThrow(/mech→crawler/)
  })

  test('endsMatchType rejects a type drawn between the wrong kinds', () => {
    expect(endsMatchType(l('mech-to-crawler', 'm', 'c'))).toBe(true)
    expect(
      endsMatchType({
        type: 'mech-to-crawler',
        from: { type: 'pilot', id: 'p' },
        to: { type: 'crawler', id: 'c' },
      })
    ).toBe(false)
  })
})

describe('conflictingLinks — what a new link replaces', () => {
  const existing = [
    l('pilot-to-crawler', 'p1', 'c1'),
    l('pilot-to-crawler', 'p2', 'c1'),
    l('mech-to-crawler', 'm1', 'c1'),
    l('mech-to-pilot', 'm1', 'p1'),
    l('mech-to-pilot', 'm2', 'p2'),
  ]

  test("a pilot's second crawler replaces the first", () => {
    expect(conflictingLinks(existing, l('pilot-to-crawler', 'p1', 'c2'))).toEqual([
      l('pilot-to-crawler', 'p1', 'c1'),
    ])
  })

  test("a mech's second crawler replaces the first", () => {
    expect(conflictingLinks(existing, l('mech-to-crawler', 'm1', 'c2'))).toEqual([
      l('mech-to-crawler', 'm1', 'c1'),
    ])
  })

  test('a crawler is never exclusive: a new crew member displaces nobody', () => {
    expect(conflictingLinks(existing, l('pilot-to-crawler', 'p3', 'c1'))).toEqual([])
    expect(conflictingLinks(existing, l('mech-to-crawler', 'm3', 'c1'))).toEqual([])
  })

  test('mech-to-pilot is exclusive on both ends', () => {
    // m1 now flies p2: m1's old pilot link AND p2's old mech link both go.
    expect(conflictingLinks(existing, l('mech-to-pilot', 'm1', 'p2'))).toEqual([
      l('mech-to-pilot', 'm1', 'p1'),
      l('mech-to-pilot', 'm2', 'p2'),
    ])
  })

  test('the same link drawn again replaces nothing', () => {
    expect(conflictingLinks(existing, l('pilot-to-crawler', 'p1', 'c1'))).toEqual([])
  })

  test('different link types never conflict', () => {
    expect(conflictingLinks(existing, l('mech-to-crawler', 'm2', 'c9'))).toEqual([])
  })
})

describe('linksBrokenByMove — the links a move cannot take along', () => {
  const where: Record<string, Container> = {
    p1: SHELF,
    c1: SHELF,
    cg: game('g1'),
    m1: game('g1'),
  }
  const lookup = (ref: { id: string }) => where[ref.id] ?? null

  test('keeps only links whose other end is already at the destination', () => {
    const links = [
      l('pilot-to-crawler', 'p1', 'c1'),
      l('mech-to-pilot', 'm1', 'p1'),
      l('mech-to-crawler', 'm1', 'cg'),
    ]
    // p1 moves into g1: its shelf crawler stays behind, its g1 mech is already there.
    expect(linksBrokenByMove(links, { type: 'pilot', id: 'p1' }, game('g1'), lookup)).toEqual([
      l('pilot-to-crawler', 'p1', 'c1'),
    ])
  })

  test('drops a link whose other end is unknown here', () => {
    const links = [l('pilot-to-crawler', 'p1', 'nowhere')]
    expect(linksBrokenByMove(links, { type: 'pilot', id: 'p1' }, SHELF, lookup)).toHaveLength(1)
  })

  test('ignores links that do not touch the moved entity', () => {
    const links = [l('mech-to-crawler', 'm1', 'cg')]
    expect(linksBrokenByMove(links, { type: 'pilot', id: 'p1' }, game('g2'), lookup)).toEqual([])
  })
})
