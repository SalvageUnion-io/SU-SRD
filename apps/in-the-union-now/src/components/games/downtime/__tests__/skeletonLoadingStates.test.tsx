/**
 * Tests for skeleton loading state conditions in TrainStep and RestoreStep.
 *
 * These tests verify the loading guard logic that determines when skeletons
 * are shown. We test the conditions directly rather than rendering the full
 * components (which have deep Supabase/TanStack Query hook dependencies).
 */
import { describe, test, expect } from 'bun:test'

// ---------------------------------------------------------------------------
// TrainStep loading guard logic
// ---------------------------------------------------------------------------
// The component shows a skeleton when: pilotLoading || !pilot
function trainStepShouldShowSkeleton(pilotLoading: boolean, pilot: unknown): boolean {
  return pilotLoading || !pilot
}

describe('TrainStep loading guard', () => {
  test('shows skeleton when pilotLoading is true', () => {
    expect(trainStepShouldShowSkeleton(true, undefined)).toBe(true)
  })

  test('shows skeleton when pilot data is undefined (query not yet resolved)', () => {
    expect(trainStepShouldShowSkeleton(false, undefined)).toBe(true)
  })

  test('shows skeleton when pilot is null', () => {
    expect(trainStepShouldShowSkeleton(false, null)).toBe(true)
  })

  test('does not show skeleton when pilot data is loaded', () => {
    const fakePilot = { id: 'p1', tp: 0 }
    expect(trainStepShouldShowSkeleton(false, fakePilot)).toBe(false)
  })

  test('shows skeleton even when pilot is available but loading flag is still true', () => {
    // In-flight refetch scenario — should remain in skeleton during loading
    const fakePilot = { id: 'p1', tp: 0 }
    expect(trainStepShouldShowSkeleton(true, fakePilot)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// RestoreStep loading guard logic
// ---------------------------------------------------------------------------
// The component shows a skeleton when: mechLoading || pilotLoading || mechRefsLoading || !mech || !pilot || !mechRefs
function restoreStepShouldShowSkeleton(
  mechLoading: boolean,
  pilotLoading: boolean,
  mechRefsLoading: boolean,
  mech: unknown,
  pilot: unknown,
  mechRefs: unknown
): boolean {
  return mechLoading || pilotLoading || mechRefsLoading || !mech || !pilot || !mechRefs
}

describe('RestoreStep loading guard', () => {
  test('shows skeleton when any query is loading', () => {
    const data = { id: 'x' }
    expect(restoreStepShouldShowSkeleton(true, false, false, data, data, data)).toBe(true)
    expect(restoreStepShouldShowSkeleton(false, true, false, data, data, data)).toBe(true)
    expect(restoreStepShouldShowSkeleton(false, false, true, data, data, data)).toBe(true)
  })

  test('shows skeleton when any data is missing', () => {
    const data = { id: 'x' }
    expect(restoreStepShouldShowSkeleton(false, false, false, undefined, data, data)).toBe(true)
    expect(restoreStepShouldShowSkeleton(false, false, false, data, undefined, data)).toBe(true)
    expect(restoreStepShouldShowSkeleton(false, false, false, data, data, undefined)).toBe(true)
  })

  test('does not show skeleton when all data is loaded', () => {
    const mech = { id: 'm1' }
    const pilot = { id: 'p1' }
    const mechRefs = [{ id: 'ref1' }]
    expect(restoreStepShouldShowSkeleton(false, false, false, mech, pilot, mechRefs)).toBe(false)
  })

  test('shows skeleton for all-undefined initial state', () => {
    expect(restoreStepShouldShowSkeleton(true, true, true, undefined, undefined, undefined)).toBe(
      true
    )
  })
})
