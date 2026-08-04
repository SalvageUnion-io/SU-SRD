import { describe, expect, test } from 'bun:test'
import { containerOf, gameIdOf, isOnShelf, moveTo, sameContainer } from '../container'

/** Inlined from the deleted lib/defaultWorkspace.ts (Workspaces are retired). */
const DEFAULT_WORKSPACE_ID = 'default-workspace'

/**
 * The container resolver (ADR-030 §2).
 *
 * The case worth the most attention is the difference between `gameId: null`
 * and `gameId: undefined`. They look alike in JavaScript and mean opposite
 * things here — "deliberately shelved" versus "not yet decided" — and getting
 * them backwards would send every shelved entity back through the legacy
 * fallback on every read.
 */

describe('null is a decision; undefined is not', () => {
  test('gameId: null means the shelf, and does NOT consult workspaceId', () => {
    // Even with a workspace still attached, an explicit null wins. Otherwise a
    // deliberate "move to shelf" would silently bounce back to the old game.
    const c = containerOf({ gameId: null, workspaceId: 'some-old-workspace' })
    expect(c.kind).toBe('shelf')
  })

  test('gameId: undefined falls back to workspaceId', () => {
    const c = containerOf({ workspaceId: 'campaign-a' })
    expect(c).toEqual({ kind: 'game', gameId: 'campaign-a' })
  })

  test('a set gameId wins over a stale workspaceId', () => {
    const c = containerOf({ gameId: 'campaign-b', workspaceId: 'campaign-a' })
    expect(c).toEqual({ kind: 'game', gameId: 'campaign-b' })
  })
})

describe('the Default workspace is the shelf, not a game', () => {
  test('DEFAULT_WORKSPACE_ID resolves to the shelf', () => {
    // It was never a campaign — it was where builds went when they belonged to
    // no campaign, which is what a shelf is.
    expect(containerOf({ workspaceId: DEFAULT_WORKSPACE_ID }).kind).toBe('shelf')
  })

  test('an entity with no container at all is on the shelf', () => {
    expect(containerOf({}).kind).toBe('shelf')
  })
})

describe('helpers', () => {
  test('isOnShelf agrees with containerOf', () => {
    expect(isOnShelf({ gameId: null })).toBe(true)
    expect(isOnShelf({ gameId: 'g1' })).toBe(false)
    expect(isOnShelf({ workspaceId: DEFAULT_WORKSPACE_ID })).toBe(true)
  })

  test('gameIdOf returns null for a shelved entity rather than undefined', () => {
    // Callers write this straight into a nullable column, so the distinction
    // between null and undefined has to survive the helper.
    expect(gameIdOf({ gameId: null })).toBeNull()
    expect(gameIdOf({})).toBeNull()
    expect(gameIdOf({ gameId: 'g1' })).toBe('g1')
  })

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
