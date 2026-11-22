import { libCopy } from '../messages/lib'

/**
 * The app's one way to write a timestamp: always the viewer's own locale
 * and clock (`undefined`), so every surface reads the same.
 */
const LOCALE = undefined

/** "14:05" — a time of day, for a log line. */
export function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' })
}

/** A day and a time, for a change-history entry. */
export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'short' })
}

/** "21 Nov 2026" — a day, for when a thing was saved. */
export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(LOCALE, { dateStyle: 'medium' })
}

/** A day and a time to the second: a Change Log line, where quick edits read apart. */
export function formatDateTimeSeconds(ts: number): string {
  return new Date(ts).toLocaleString(LOCALE, { dateStyle: 'medium', timeStyle: 'medium' })
}

/** Today as a calendar day, `YYYY-MM-DD`, on the viewer's own clock. */
export function todayDay(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** "Sat 28 Nov" — a calendar day (`YYYY-MM-DD`), which is in nobody's time zone. */
export function formatDay(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

/** "just now", "2 min ago", "3 h ago", "2 days ago" — how long before `now`. */
export function formatAgo(ts: number, now: number): string {
  const minutes = Math.floor((now - ts) / 60_000)
  if (minutes < 1) return libCopy('justNow')
  if (minutes < 60) return libCopy('minAgo', { minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}
