/**
 * Test-only lookup for a section Slab's value count, the label-first chip
 * (`SLOTS | 3/6`): the chip after the slab stamped `title`, or `null` when
 * that slab carries none.
 */
import { screen } from '@testing-library/react'

export function slabChip(title: string): HTMLElement | null {
  const stamp = screen.getByText(title, { selector: '.su-poster-stamp' })
  return stamp.parentElement?.querySelector<HTMLElement>('.su-stat-cell') ?? null
}
