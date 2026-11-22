import { prefersReducedMotion } from '../lib/revealRolled'

/**
 * The rolled row is never left under the sticky Apply bar (r4 A4): the bar
 * holds the pane's foot over the table, so a row the pane shows can still be
 * covered. Where it is, the row is brought to the pane's centre, clear of it.
 */
export function clearOfBar(host: Element | null): void {
  const row = host?.querySelector('.su-roll')?.querySelector('[aria-current="true"]')
  const bar = host?.querySelector('.su-play-resolve__forward')
  if (!row || !bar || typeof row.scrollIntoView !== 'function') return
  if (row.getBoundingClientRect().bottom <= bar.getBoundingClientRect().top) return
  row.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' })
}
