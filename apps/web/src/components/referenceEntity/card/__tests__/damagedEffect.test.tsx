/**
 * A crawler bay's WHEN DAMAGED (ruleset N5): on the bay's own Page a titled
 * box at level 1; inside a card (a sheet's bay, a Peek) a Slab over the
 * effect, never a box inside the entity.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const cantina = () => {
  const bay = SalvageUnionReference.CrawlerBays.getByName('Cantina')
  if (!bay?.damagedEffect) throw new Error('fixture missing: cantina')
  return { bay, effect: bay.damagedEffect }
}

describe('When Damaged', () => {
  test('in a card it is a Slab over the effect, with no box', () => {
    const { bay, effect } = cantina()
    const { container } = render(<ReferenceEntityCard data={bay} size="compact" />)
    expect(container.querySelector('.su-box')).toBeNull()
    const label = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'When Damaged'
    )
    if (!label) throw new Error('no When Damaged label')
    expect(label.closest('.su-ec-block')?.textContent).toContain(effect)
  })

  test('on the bay’s Page it stays a titled box', () => {
    const { bay } = cantina()
    const { container } = render(<ReferenceEntityCard data={bay} presentation="page" />)
    const notch = Array.from(container.querySelectorAll('.su-box .su-entity-row__notch')).find(
      (n) => n.textContent === 'When Damaged'
    )
    expect(notch).toBeTruthy()
  })
})
