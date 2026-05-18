import { describe, test, expect } from 'bun:test'
import type { EntityAccess } from './entityAccess'
import { getEntityAccess } from './entityAccess'

describe('getEntityAccess', () => {
  const ownerUserId = 'user-owner-123'
  const otherUserId = 'user-other-456'

  test('owner of private entity can view and edit', () => {
    const access = getEntityAccess({ user_id: ownerUserId, visible: false }, ownerUserId)
    expect(access).toEqual({ canView: true, canEdit: true })
  })

  test('owner of public entity can view and edit', () => {
    const access = getEntityAccess({ user_id: ownerUserId, visible: true }, ownerUserId)
    expect(access).toEqual({ canView: true, canEdit: true })
  })

  test('non-owner can view public entity but not edit', () => {
    const access = getEntityAccess({ user_id: ownerUserId, visible: true }, otherUserId)
    expect(access).toEqual({ canView: true, canEdit: false })
  })

  test('non-owner cannot view private entity', () => {
    const access = getEntityAccess({ user_id: ownerUserId, visible: false }, otherUserId)
    expect(access).toEqual({ canView: false })
  })

  test('undefined userId cannot view private entity', () => {
    const access = getEntityAccess({ user_id: ownerUserId, visible: false }, undefined)
    expect(access).toEqual({ canView: false })
  })

  test('undefined userId can view public entity but not edit', () => {
    const access = getEntityAccess({ user_id: ownerUserId, visible: true }, undefined)
    expect(access).toEqual({ canView: true, canEdit: false })
  })
})

describe('getEntityAccess — readOnly rendering decisions', () => {
  const owner = 'user-abc'
  const viewer = 'user-xyz'

  function isReadOnly(access: EntityAccess): boolean {
    return access.canView && !access.canEdit
  }

  function isEditable(access: EntityAccess): boolean {
    return access.canView && access.canEdit
  }

  function isHidden(access: EntityAccess): boolean {
    return !access.canView
  }

  test('owner always gets editable, never readOnly', () => {
    const privateAccess = getEntityAccess({ user_id: owner, visible: false }, owner)
    const publicAccess = getEntityAccess({ user_id: owner, visible: true }, owner)

    expect(isEditable(privateAccess)).toBe(true)
    expect(isReadOnly(privateAccess)).toBe(false)
    expect(isEditable(publicAccess)).toBe(true)
    expect(isReadOnly(publicAccess)).toBe(false)
  })

  test('non-owner of public entity gets readOnly, not editable', () => {
    const access = getEntityAccess({ user_id: owner, visible: true }, viewer)

    expect(isReadOnly(access)).toBe(true)
    expect(isEditable(access)).toBe(false)
    expect(isHidden(access)).toBe(false)
  })

  test('non-owner of private entity is hidden (not readOnly)', () => {
    const access = getEntityAccess({ user_id: owner, visible: false }, viewer)

    expect(isHidden(access)).toBe(true)
    expect(isReadOnly(access)).toBe(false)
    expect(isEditable(access)).toBe(false)
  })

  test('anonymous viewer of public entity gets readOnly', () => {
    const access = getEntityAccess({ user_id: owner, visible: true }, undefined)

    expect(isReadOnly(access)).toBe(true)
    expect(isEditable(access)).toBe(false)
  })

  test('anonymous viewer of private entity is hidden', () => {
    const access = getEntityAccess({ user_id: owner, visible: false }, undefined)

    expect(isHidden(access)).toBe(true)
  })

  test('canEdit is never true for canView: false', () => {
    const scenarios: Array<{ user_id: string; visible: boolean }> = [
      { user_id: owner, visible: false },
      { user_id: owner, visible: true },
    ]
    const viewers = [owner, viewer, undefined]

    for (const entity of scenarios) {
      for (const userId of viewers) {
        const access = getEntityAccess(entity, userId)
        if (!access.canView) {
          expect('canEdit' in access).toBe(false)
        }
      }
    }
  })
})
