import { describe, expect, test } from 'bun:test'
import { containerOf, moveTo, sameContainer } from '../container'

/** The container resolver (ADR-030 §2). */

describe('containerOf', () => {
  test('a gameId names its Game', () => {
    expect(containerOf({ gameId: 'g1' })).toEqual({ kind: 'game', gameId: 'g1' })
  })

  test('gameId: null is the shelf', () => {
    expect(containerOf({ gameId: null }).kind).toBe('shelf')
  })

  test('a body with no gameId reads as the shelf', () => {
    expect(containerOf({}).kind).toBe('shelf')
  })
})

describe('helpers', () => {
  test('moveTo produces a patch that round-trips', () => {
    expect(moveTo({ kind: 'shelf' })).toEqual({ gameId: null })
    expect(moveTo({ kind: 'game', gameId: 'g1' })).toEqual({ gameId: 'g1' })
    // The round trip is the property that matters: applying the patch and
    // re-resolving must land in the same container.
    expect(containerOf(moveTo({ kind: 'shelf' })).kind).toBe('shelf')
    expect(containerOf(moveTo({ kind: 'game', gameId: 'g1' }))).toEqual({
      kind: 'game',
      gameId: 'g1',
    })
  })

  test('sameContainer compares structurally, not by reference', () => {
    // This is the whole reason the helper exists: containerOf mints a fresh
    // object every call, so `===` is false for two reads of the SAME entity
    // and every filter written against it would quietly return nothing.
    const entity = { gameId: 'g1' }
    expect(containerOf(entity)).not.toBe(containerOf(entity))
    expect(sameContainer(containerOf(entity), containerOf(entity))).toBe(true)
  })

  test('sameContainer distinguishes the shelf from a game, and games from each other', () => {
    expect(sameContainer({ kind: 'shelf' }, { kind: 'shelf' })).toBe(true)
    expect(sameContainer({ kind: 'shelf' }, { kind: 'game', gameId: 'g1' })).toBe(false)
    expect(sameContainer({ kind: 'game', gameId: 'g1' }, { kind: 'game', gameId: 'g2' })).toBe(
      false
    )
  })
})
