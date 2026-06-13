/**
 * Unit tests for useSoftWarnings.
 *
 * Tests that:
 * - preview() invokes the evaluate function with before/after snapshots
 * - warnings array updates after preview()
 * - saveAnyway() calls store.update with the pending patch
 * - fixIt() clears warnings and pending patch without calling store.update
 *
 * Uses dep-injection exclusively — NO mock.module().
 */

import '@testing-library/jest-dom'
import { describe, expect, mock, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'

import { useSoftWarnings } from '../useSoftWarnings'
import type { SoftWarning } from '../../../lib/rules/types'
import type { Pilot } from '../../../lib/schemas/pilot'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PILOT_ID = 'pilot-abc-123'

/** Minimal Pilot shape that satisfies EntityForType<'pilot'> */
const fakePilot = {
  id: PILOT_ID,
  name: 'Test Pilot',
  level: 3,
  abilities: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
} as unknown as Pilot

const fakeWarning: SoftWarning = {
  code: 'ABILITY_LEVEL_PREREQUISITE',
  message: 'Ability requires level 5. Pilot is level 3.',
  severity: 'warn',
}

// ---------------------------------------------------------------------------
// Stub factory — builds minimal injectable store shapes
// ---------------------------------------------------------------------------

function makeStore(opts: { entity?: Pilot | null; updateResult?: Pilot }) {
  const entity = opts.entity ?? fakePilot
  const updateResult = opts.updateResult ?? { ...fakePilot, name: 'Updated' }
  const updateFn = mock(async () => updateResult)

  const storeState = {
    get: mock(() => entity),
    update: updateFn,
    // Unused by the hook but part of the store shape
    pilots: [],
    mechs: [],
    crawlers: [],
    softLinks: [],
    hydrated: { pilots: false, mechs: false, crawlers: false, softLinks: false },
    hydrate: mock(async () => {}),
    list: mock(() => []),
    create: mock(async () => ({})),
    delete: mock(async () => {}),
  }

  // The hook calls store() — return a hook-shaped function
  const storeHook = () =>
    storeState as unknown as ReturnType<typeof import('../../../stores/entityStore').useEntityStore>

  return { storeState, storeHook, updateFn }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSoftWarnings', () => {
  describe('preview()', () => {
    test('invokes evaluate with before and after snapshots', async () => {
      const evaluateFn = mock((): SoftWarning[] => [])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      const patch = { name: 'New Name' }

      await act(async () => {
        result.current.preview(patch)
      })

      expect(evaluateFn).toHaveBeenCalledTimes(1)
      const [calledBefore, calledAfter, calledCtx] = evaluateFn.mock.calls[0] as unknown as [
        unknown,
        unknown,
        unknown,
      ]
      // before should be the original entity
      expect((calledBefore as { id: string }).id).toBe(PILOT_ID)
      // after should have the patch applied
      expect((calledAfter as { name: string }).name).toBe('New Name')
      // context should carry entityType
      expect((calledCtx as { entityType: string }).entityType).toBe('pilot')
    })

    test('updates warnings array with evaluate return value', async () => {
      const evaluateFn = mock((): SoftWarning[] => [fakeWarning])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      expect(result.current.warnings).toEqual([])

      await act(async () => {
        result.current.preview({ name: 'Changed' })
      })

      expect(result.current.warnings).toEqual([fakeWarning])
    })

    test('sets warnings to empty array when evaluate returns none', async () => {
      const evaluateFn = mock((): SoftWarning[] => [])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'No warnings' })
      })

      expect(result.current.warnings).toEqual([])
    })

    test('passes context options through to evaluate', async () => {
      const evaluateFn = mock((): SoftWarning[] => [])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'mech',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'Mech' }, { techLevelDowngraded: true })
      })

      const [, , calledCtx] = evaluateFn.mock.calls[0] as unknown as [
        unknown,
        unknown,
        { techLevelDowngraded?: boolean },
      ]
      expect(calledCtx.techLevelDowngraded).toBe(true)
    })
  })

  describe('saveAnyway()', () => {
    test('calls store.update with the pending patch', async () => {
      const evaluateFn = mock((): SoftWarning[] => [fakeWarning])
      const { storeHook, updateFn } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'Save Me' })
      })

      await act(async () => {
        await result.current.saveAnyway()
      })

      expect(updateFn).toHaveBeenCalledTimes(1)
      const [calledType, calledId, calledPatch] = updateFn.mock.calls[0] as unknown as [
        string,
        string,
        unknown,
      ]
      expect(calledType).toBe('pilot')
      expect(calledId).toBe(PILOT_ID)
      expect((calledPatch as { name: string }).name).toBe('Save Me')
    })

    test('clears warnings after successful save', async () => {
      const evaluateFn = mock((): SoftWarning[] => [fakeWarning])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'Save Me' })
      })

      expect(result.current.warnings).toHaveLength(1)

      await act(async () => {
        await result.current.saveAnyway()
      })

      expect(result.current.warnings).toEqual([])
    })

    test('throws if called without a prior preview()', async () => {
      const { storeHook, updateFn } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          store: storeHook as never,
        })
      )

      // saveAnyway() itself rejects — test the Promise directly, no act() wrapper
      await expect(result.current.saveAnyway()).rejects.toThrow(/no pending patch/)

      expect(updateFn).not.toHaveBeenCalled()
    })
  })

  describe('fixIt()', () => {
    test('clears warnings without calling store.update', async () => {
      const evaluateFn = mock((): SoftWarning[] => [fakeWarning])
      const { storeHook, updateFn } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          evaluate: evaluateFn as Parameters<typeof useSoftWarnings>[0]['evaluate'],
          store: storeHook as never,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'Changed' })
      })

      expect(result.current.warnings).toHaveLength(1)

      await act(async () => {
        result.current.fixIt()
      })

      expect(result.current.warnings).toEqual([])
      expect(updateFn).not.toHaveBeenCalled()
    })

    test('fixIt with no prior preview is a no-op', async () => {
      const { storeHook, updateFn } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          store: storeHook as never,
        })
      )

      await act(async () => {
        result.current.fixIt()
      })

      expect(result.current.warnings).toEqual([])
      expect(updateFn).not.toHaveBeenCalled()
    })
  })
})
