import type { CampaignMemberRow } from '../types/common'

/** Check if a user is the mediator of a campaign */
export function isMediator(members: CampaignMemberRow[], userId: string): boolean {
  return members.some((m) => m.user_id === userId && m.role === 'mediator')
}

/** Get a user's role in a campaign */
export function getMemberRole(
  members: CampaignMemberRow[],
  userId: string
): 'mediator' | 'player' | null {
  const member = members.find((m) => m.user_id === userId)
  if (!member) return null
  return member.role as 'mediator' | 'player'
}

/** Generate a random 6-character invite code (uppercase alphanumeric) */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}
