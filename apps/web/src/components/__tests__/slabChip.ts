/**
 * Test-only lookup for a section Slab's value count: on the rule head
 * (`data-look="rule"`) the tally after the label (`6/6 SLOTS`), on a stamp
 * head the label-first chip (`SLOTS | 3/6`); `null` when that slab carries none.
 */
import { screen } from '@testing-library/react'

export function slabChip(title: string): HTMLElement | null {
  const label = screen.getByText(title, { selector: '.su-rule-head__label, .su-poster-stamp' })
  const head = label.parentElement
  return (
    head?.querySelector<HTMLElement>('.su-rule-head__tally') ??
    head?.querySelector<HTMLElement>('.su-stat-cell') ??
    null
  )
}

/** Whether a slab's count reads over its cap (rule tally or stat chip). */
export function slabCountCritical(count: HTMLElement): boolean {
  return (
    count.dataset.state === 'critical' || count.classList.contains('su-stat-cell--critical')
  )
}
