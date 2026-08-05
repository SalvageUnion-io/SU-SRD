/**
 * activeContainerStore — serialization, persistence, and the tolerant parse.
 *
 * The encoding is the interesting part: it is the single string both this store
 * and the `<Select>` option values use, so a round-trip failure would show up
 * as a switcher that silently reverts to the Shelf rather than as an error.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { SHELF } from '../../lib/container'
import {
  getActiveContainer,
  parseContainer,
  serializeContainer,
  setActiveContainer,
  useActiveContainerStore,
} from '../activeContainerStore'

const STORAGE_KEY = 'itun.activeContainer'

beforeEach(() => {
  localStorage.clear()
  useActiveContainerStore.setState({ activeContainer: SHELF })
})

afterEach(() => {
  localStorage.clear()
})

describe('serializeContainer / parseContainer', () => {
  test('round-trips the shelf', () => {
    expect(serializeContainer(SHELF)).toBe('shelf')
    expect(parseContainer('shelf')).toEqual(SHELF)
  })

  test('round-trips a game', () => {
    const container = { kind: 'game', gameId: 'k17abc' } as const
    expect(serializeContainer(container)).toBe('game:k17abc')
    expect(parseContainer('game:k17abc')).toEqual(container)
  })

  test('a game id containing a colon survives — only the first is a separator', () => {
    expect(parseContainer('game:a:b')).toEqual({ kind: 'game', gameId: 'a:b' })
  })

  test.each([
    ['null (nothing persisted yet)', null],
    ['an unrecognised kind', 'campaign:1'],
    ['a game with no id', 'game:'],
    ['junk', '{}'],
  ])('falls back to the shelf for %s', (_label, raw) => {
    // Tolerant by design: this value comes from localStorage, which an older
    // build or the user could have written. A roster that refuses to render
    // because a string was malformed is worse than one showing the Shelf.
    expect(parseContainer(raw)).toEqual(SHELF)
  })
})

describe('persistence', () => {
  test('setActiveContainer writes through to localStorage', () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })

    expect(localStorage.getItem(STORAGE_KEY)).toBe('game:g1')
    expect(getActiveContainer()).toEqual({ kind: 'game', gameId: 'g1' })
  })

  test('moving back to the shelf overwrites the stored game', () => {
    setActiveContainer({ kind: 'game', gameId: 'g1' })
    setActiveContainer(SHELF)

    expect(localStorage.getItem(STORAGE_KEY)).toBe('shelf')
    expect(getActiveContainer()).toEqual(SHELF)
  })
})
