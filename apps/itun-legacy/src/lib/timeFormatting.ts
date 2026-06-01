const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto', style: 'narrow' })

const dtf = new Intl.DateTimeFormat('en', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 60 * 60 * 24 * 365],
  ['month', 60 * 60 * 24 * 30],
  ['week', 60 * 60 * 24 * 7],
  ['day', 60 * 60 * 24],
  ['hour', 60 * 60],
  ['minute', 60],
  ['second', 1],
]

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const diffSec = Math.round((date.getTime() - now.getTime()) / 1000)

  for (const [unit, seconds] of UNITS) {
    if (Math.abs(diffSec) >= seconds) {
      const value = Math.round(diffSec / seconds)
      return rtf.format(value, unit)
    }
  }

  return rtf.format(0, 'second')
}

export function formatAbsoluteTime(date: Date): string {
  return dtf.format(date)
}
