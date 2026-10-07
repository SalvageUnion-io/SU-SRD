/**
 * How long an invite has left, as the Organizer's invite list and the
 * invitee's hub card both say it — one phrasing, so the two never disagree
 * about the same deadline.
 */
export function humanExpiry(expiresAt: number | null): string {
  if (expiresAt === null) return 'no expiry'
  const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'expired'
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}
