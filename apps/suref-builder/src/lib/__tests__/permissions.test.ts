import { describe, test, expect } from 'bun:test'
import { PermissionError, isOwner, isGameMediator } from '../permissions'

describe('permissions', () => {
  describe('PermissionError', () => {
    test('has correct name and default message', () => {
      const error = new PermissionError()
      expect(error.name).toBe('PermissionError')
      expect(error.message).toBe('You do not have permission to view this resource')
    })

    test('accepts custom message', () => {
      const error = new PermissionError('Custom message')
      expect(error.name).toBe('PermissionError')
      expect(error.message).toBe('Custom message')
    })

    test('is instance of Error', () => {
      const error = new PermissionError()
      expect(error).toBeInstanceOf(Error)
    })
  })

  describe('isOwner', () => {
    test('returns true when user IDs match', () => {
      expect(isOwner('user-123', 'user-123')).toBe(true)
    })

    test('returns false when user IDs do not match', () => {
      expect(isOwner('user-123', 'user-456')).toBe(false)
    })

    test('returns false when currentUserId is null', () => {
      expect(isOwner('user-123', null)).toBe(false)
    })

    test('returns false for empty string user ID', () => {
      expect(isOwner('user-123', '')).toBe(false)
    })
  })

  describe('isGameMediator', () => {
    const members = [
      { user_id: 'mediator-1', role: 'mediator' },
      { user_id: 'player-1', role: 'player' },
      { user_id: 'player-2', role: 'player' },
    ]

    test('returns true when user is a mediator', () => {
      expect(isGameMediator(members, 'mediator-1')).toBe(true)
    })

    test('returns false when user is a player (not mediator)', () => {
      expect(isGameMediator(members, 'player-1')).toBe(false)
    })

    test('returns false when user is not in the game', () => {
      expect(isGameMediator(members, 'unknown-user')).toBe(false)
    })

    test('returns false when currentUserId is null', () => {
      expect(isGameMediator(members, null)).toBe(false)
    })

    test('returns false for empty members array', () => {
      expect(isGameMediator([], 'mediator-1')).toBe(false)
    })

    test('handles multiple mediators', () => {
      const multiMediators = [
        { user_id: 'mediator-1', role: 'mediator' },
        { user_id: 'mediator-2', role: 'mediator' },
        { user_id: 'player-1', role: 'player' },
      ]
      expect(isGameMediator(multiMediators, 'mediator-1')).toBe(true)
      expect(isGameMediator(multiMediators, 'mediator-2')).toBe(true)
      expect(isGameMediator(multiMediators, 'player-1')).toBe(false)
    })
  })
})
