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
import type { MechSnapshot, PilotSnapshot, SoftWarning } from '../../../lib/rules/types'
import type { Pilot } from '../../../lib/schemas/pilot'
import { pilotFixture } from '../../__tests__/fixtures'
import { makeEntityStoreMock } from '../../__tests__/mockEntityStore'
import { must } from '../../__tests__/must'
import { useSoftWarnings } from '../useSoftWarnings'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PILOT_ID = 'pilot-abc-123'

const fakePilot: Pilot = pilotFixture({ id: PILOT_ID, name: 'Test Pilot' })

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
  const updateFn = mock(async (_type: string, _id: string, _patch: Partial<Pilot>) => updateResult)

  const storeHook = makeEntityStoreMock({
    get: mock(() => entity),
    update: updateFn,
    hydrate: mock(async () => {}),
    list: mock(() => []),
    delete: mock(async () => {}),
  })

  return { storeHook, updateFn }
}

/**
 * The structural pass-through every call site below hands to `toSnapshot`.
 *
 * `toSnapshot` is REQUIRED on the hook — its optional form stood in for an
 * unsound cast inside the hook itself, whose failure mode was the warning
 * dialog silently never appearing. These tests all drive stub evaluators and
 * only ever read `id` / `name` off the snapshot, so the projection is
 * irrelevant to what they assert; the cast lives here, where nothing reads a
 * struct-shaped field, rather than in production.
 */
function passThrough<T>(entity: T): PilotSnapshot | MechSnapshot {
  return entity as unknown as PilotSnapshot | MechSnapshot
}

/** The argument view the tests assert on — snapshots overlap it structurally. */
type SnapshotView = { id?: string; name?: string; abilities?: unknown; systems?: unknown }
type CtxView = { entityType?: string; techLevelDowngraded?: boolean }

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSoftWarnings', () => {
  describe('preview()', () => {
    test('invokes evaluate with before and after snapshots', async () => {
      const evaluateFn = mock(
        (_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => []
      )
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
        })
      )

      const patch = { name: 'New Name' }

      await act(async () => {
        result.current.preview(patch)
      })

      expect(evaluateFn).toHaveBeenCalledTimes(1)
      const [calledBefore, calledAfter, calledCtx] = must(evaluateFn.mock.calls[0])
      // before should be the original entity
      expect(calledBefore.id).toBe(PILOT_ID)
      // after should have the patch applied
      expect(calledAfter.name).toBe('New Name')
      // context should carry entityType
      expect(calledCtx.entityType).toBe('pilot')
    })

    test('updates warnings array with evaluate return value', async () => {
      const evaluateFn = mock((_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => [
        fakeWarning,
      ])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
        })
      )

      expect(result.current.warnings).toEqual([])

      await act(async () => {
        result.current.preview({ name: 'Changed' })
      })

      expect(result.current.warnings).toEqual([fakeWarning])
    })

    test('sets warnings to empty array when evaluate returns none', async () => {
      const evaluateFn = mock(
        (_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => []
      )
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'No warnings' })
      })

      expect(result.current.warnings).toEqual([])
    })

    test('passes context options through to evaluate', async () => {
      const evaluateFn = mock(
        (_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => []
      )
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'mech',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'Mech' }, { techLevelDowngraded: true })
      })

      const [, , calledCtx] = must(evaluateFn.mock.calls[0])
      expect(calledCtx.techLevelDowngraded).toBe(true)
    })
  })

  describe('saveAnyway()', () => {
    test('calls store.update with the pending patch', async () => {
      const evaluateFn = mock((_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => [
        fakeWarning,
      ])
      const { storeHook, updateFn } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
        })
      )

      await act(async () => {
        result.current.preview({ name: 'Save Me' })
      })

      await act(async () => {
        await result.current.saveAnyway()
      })

      expect(updateFn).toHaveBeenCalledTimes(1)
      const [calledType, calledId, calledPatch] = must(updateFn.mock.calls[0])
      expect(calledType).toBe('pilot')
      expect(calledId).toBe(PILOT_ID)
      expect(calledPatch.name).toBe('Save Me')
    })

    test('clears warnings after successful save', async () => {
      const evaluateFn = mock((_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => [
        fakeWarning,
      ])
      const { storeHook } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
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
          toSnapshot: passThrough,
          store: storeHook,
        })
      )

      // saveAnyway() itself rejects — test the Promise directly, no act() wrapper
      await expect(result.current.saveAnyway()).rejects.toThrow(/no pending patch/)

      expect(updateFn).not.toHaveBeenCalled()
    })
  })

  describe('fixIt()', () => {
    test('clears warnings without calling store.update', async () => {
      const evaluateFn = mock((_b: SnapshotView, _a: SnapshotView, _c: CtxView): SoftWarning[] => [
        fakeWarning,
      ])
      const { storeHook, updateFn } = makeStore({})

      const { result } = renderHook(() =>
        useSoftWarnings({
          entityType: 'pilot',
          entityId: PILOT_ID,
          toSnapshot: passThrough,
          evaluate: evaluateFn,
          store: storeHook,
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
          toSnapshot: passThrough,
          store: storeHook,
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
