/**
 * How long an invite has left, as the Organizer's invite list and the
 * invitee's hub card both say it — one phrasing, so the two never disagree
 * about the same deadline.
 */
export function humanExpiry(expiresAt: number): string {
  const days = Math.ceil((expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'expired'
  return `${days} ${days === 1 ? 'day' : 'days'} left`
}

const DAY_MS = 1000 * 60 * 60 * 24

/** "expires in 6 days", "expires in 23 h", "expires in under an hour". */
export function expiresIn(expiresAt: number, now: number): string {
  const ms = expiresAt - now
  if (ms <= 0) return 'expired'
  const days = Math.floor(ms / DAY_MS)
  if (days >= 1) return `expires in ${days} ${days === 1 ? 'day' : 'days'}`
  const hours = Math.floor(ms / (60 * 60 * 1000))
  return hours >= 1 ? `expires in ${hours} h` : 'expires in under an hour'
}

/** "Not used yet", "Used once", "Used twice", "Used 3 times". */
export function usedLine(uses: number): string {
  if (uses === 0) return 'Not used yet'
  if (uses === 1) return 'Used once'
  if (uses === 2) return 'Used twice'
  return `Used ${uses} times`
}
