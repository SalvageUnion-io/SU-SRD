import { describe, expect, test } from 'bun:test'
import { isMediator, getMemberRole, generateInviteCode } from './gameUtils'
import type { CampaignMemberRow } from '../types/common'

const makeMember = (overrides: Partial<CampaignMemberRow> = {}): CampaignMemberRow => ({
  id: 'member-1',
  campaign_id: 'campaign-1',
  user_id: 'user-1',
  role: 'mediator',
  joined_at: '2024-01-01',
  ...overrides,
})

describe('isMediator', () => {
  test('returns true when user is mediator', () => {
    const members = [makeMember({ user_id: 'user-1', role: 'mediator' })]
    expect(isMediator(members, 'user-1')).toBe(true)
  })

  test('returns false when user is player', () => {
    const members = [makeMember({ user_id: 'user-1', role: 'player' })]
    expect(isMediator(members, 'user-1')).toBe(false)
  })

  test('returns false when user is not a member', () => {
    const members = [makeMember({ user_id: 'user-2', role: 'mediator' })]
    expect(isMediator(members, 'user-1')).toBe(false)
  })
})

describe('getMemberRole', () => {
  test('returns mediator for mediator', () => {
    const members = [makeMember({ user_id: 'user-1', role: 'mediator' })]
    expect(getMemberRole(members, 'user-1')).toBe('mediator')
  })

  test('returns player for player', () => {
    const members = [makeMember({ user_id: 'user-1', role: 'player' })]
    expect(getMemberRole(members, 'user-1')).toBe('player')
  })

  test('returns null for non-member', () => {
    const members = [makeMember({ user_id: 'user-2' })]
    expect(getMemberRole(members, 'user-1')).toBeNull()
  })
})

describe('generateInviteCode', () => {
  test('returns a 6-character string', () => {
    const code = generateInviteCode()
    expect(code).toHaveLength(6)
  })

  test('contains only valid characters', () => {
    const validChars = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/
    for (let i = 0; i < 20; i++) {
      expect(generateInviteCode()).toMatch(validChars)
    }
  })

  test('generates different codes', () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateInviteCode()))
    expect(codes.size).toBeGreaterThan(1)
  })
})
