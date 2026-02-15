import { describe, test, expect } from 'bun:test'
import type { PatternAccess } from './patternAccess'
import { getPatternAccess } from './patternAccess'

describe('getPatternAccess', () => {
  const ownerUserId = 'user-owner-123'
  const otherUserId = 'user-other-456'

  test('owner of private pattern can view and edit', () => {
    const access = getPatternAccess({ user_id: ownerUserId, visible: false }, ownerUserId)
    expect(access).toEqual({ canView: true, canEdit: true })
  })

  test('owner of public pattern can view and edit', () => {
    const access = getPatternAccess({ user_id: ownerUserId, visible: true }, ownerUserId)
    expect(access).toEqual({ canView: true, canEdit: true })
  })

  test('non-owner can view public pattern but not edit', () => {
    const access = getPatternAccess({ user_id: ownerUserId, visible: true }, otherUserId)
    expect(access).toEqual({ canView: true, canEdit: false })
  })

  test('non-owner cannot view private pattern', () => {
    const access = getPatternAccess({ user_id: ownerUserId, visible: false }, otherUserId)
    expect(access).toEqual({ canView: false })
  })

  test('undefined userId cannot view private pattern', () => {
    const access = getPatternAccess({ user_id: ownerUserId, visible: false }, undefined)
    expect(access).toEqual({ canView: false })
  })

  test('undefined userId can view public pattern but not edit', () => {
    const access = getPatternAccess({ user_id: ownerUserId, visible: true }, undefined)
    expect(access).toEqual({ canView: true, canEdit: false })
  })
})

describe('getPatternAccess — readOnly rendering decisions', () => {
  const owner = 'user-abc'
  const viewer = 'user-xyz'

  function isReadOnly(access: PatternAccess): boolean {
    return access.canView && !access.canEdit
  }

  function isEditable(access: PatternAccess): boolean {
    return access.canView && access.canEdit
  }

  function isHidden(access: PatternAccess): boolean {
    return !access.canView
  }

  test('owner always gets editable, never readOnly', () => {
    const privateAccess = getPatternAccess({ user_id: owner, visible: false }, owner)
    const publicAccess = getPatternAccess({ user_id: owner, visible: true }, owner)

    expect(isEditable(privateAccess)).toBe(true)
    expect(isReadOnly(privateAccess)).toBe(false)
    expect(isEditable(publicAccess)).toBe(true)
    expect(isReadOnly(publicAccess)).toBe(false)
  })

  test('non-owner of public pattern gets readOnly, not editable', () => {
    const access = getPatternAccess({ user_id: owner, visible: true }, viewer)

    expect(isReadOnly(access)).toBe(true)
    expect(isEditable(access)).toBe(false)
    expect(isHidden(access)).toBe(false)
  })

  test('non-owner of private pattern is hidden (not readOnly)', () => {
    const access = getPatternAccess({ user_id: owner, visible: false }, viewer)

    expect(isHidden(access)).toBe(true)
    expect(isReadOnly(access)).toBe(false)
    expect(isEditable(access)).toBe(false)
  })

  test('anonymous viewer of public pattern gets readOnly', () => {
    const access = getPatternAccess({ user_id: owner, visible: true }, undefined)

    expect(isReadOnly(access)).toBe(true)
    expect(isEditable(access)).toBe(false)
  })

  test('anonymous viewer of private pattern is hidden', () => {
    const access = getPatternAccess({ user_id: owner, visible: false }, undefined)

    expect(isHidden(access)).toBe(true)
  })

  test('canEdit is never true for canView: false', () => {
    // Exhaustive: no combination should produce canView: false + canEdit: true
    const scenarios: Array<{ user_id: string; visible: boolean }> = [
      { user_id: owner, visible: false },
      { user_id: owner, visible: true },
    ]
    const viewers = [owner, viewer, undefined]

    for (const pattern of scenarios) {
      for (const userId of viewers) {
        const access = getPatternAccess(pattern, userId)
        if (!access.canView) {
          // canEdit should not exist on the non-viewable access type
          expect('canEdit' in access).toBe(false)
        }
      }
    }
  })
})
