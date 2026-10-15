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
