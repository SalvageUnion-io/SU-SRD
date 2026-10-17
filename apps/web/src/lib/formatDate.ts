/**
 * The Cantina's one way to write a timestamp: always the viewer's own locale
 * and clock (`undefined`), so every surface reads the same.
 */
const LOCALE = undefined

/** "14:05" — a time of day, for a log line. */
export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** "14 Oct 2026" / "Oct 14, 2026" — a calendar day. */
export function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString(LOCALE, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** A day and a time, for a change-history entry. */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
}

/** "just now", "2 min ago", "3 h ago", "2 days ago" — how long before `now`. */
export function formatAgo(ts: number, now: number): string {
  const minutes = Math.floor((now - ts) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
