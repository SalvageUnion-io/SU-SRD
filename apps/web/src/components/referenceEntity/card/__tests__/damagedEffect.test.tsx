/**
 * A crawler bay's WHEN DAMAGED is one block in every context (hard rule R18,
 * ruleset N5): a Slab over the effect, on the bay's own Page as in a card (a
 * sheet's bay, a Peek), never a box.
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

  test('on the bay’s Page it is the same block: a Slab over the effect, no box', () => {
    const { bay, effect } = cantina()
    const { container } = render(<ReferenceEntityCard data={bay} presentation="page" />)
    const notch = Array.from(container.querySelectorAll('.su-box .su-entity-row__notch')).find(
      (n) => n.textContent === 'When Damaged'
    )
    expect(notch).toBeUndefined()
    // On a Page the Slab and its effect are two blocks of the prose column.
    const slab = Array.from(container.querySelectorAll('[data-slab]')).find(
      (el) => el.textContent === 'When Damaged'
    )
    if (!slab) throw new Error('no When Damaged Slab')
    expect(slab.nextElementSibling?.textContent).toContain(effect)
  })
})
