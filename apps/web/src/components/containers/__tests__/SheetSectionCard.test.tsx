/**
 * SheetSectionCard — a sheet's opening panel: paper in one light hairline all
 * round, no unit-colour rule on top (owner, round 8).
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SheetSectionCard } from '../SheetSectionCard'

describe('SheetSectionCard', () => {
  test('its frame is one hairline, never the unit colour on top', () => {
    const { container } = render(
      <SheetSectionCard title="Identity">
        <p>Tenacity</p>
      </SheetSectionCard>
    )
    const panel = container.firstElementChild as HTMLElement
    // The top edge is the same hairline as the other three.
    expect(panel.style.borderTopColor).toBe(panel.style.borderLeftColor)
    expect(panel.getAttribute('style') ?? '').not.toContain('--tone')
  })
})
