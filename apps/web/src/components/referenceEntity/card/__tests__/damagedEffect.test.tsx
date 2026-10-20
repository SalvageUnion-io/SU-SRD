/**
 * A crawler bay's WHEN DAMAGED is one block in every context (hard rule R18,
 * ruleset N5): a Slab over the effect, on the bay's own Page as in a card (a
 * sheet's bay, a Peek), never a box.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
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
    const notch = Array.from(container.querySelectorAll('.su-box .su-entity-compact__notch')).find(
      (n) => n.textContent === 'When Damaged'
    )
    expect(notch).toBeUndefined()
    // On a Page it is a page section: the Slab, then its body.
    const slab = Array.from(container.querySelectorAll('[data-slab]')).find(
      (el) => el.textContent === 'When Damaged'
    )
    if (!slab) throw new Error('no When Damaged Slab')
    expect(slab.nextElementSibling?.textContent).toContain(effect)
  })

  test('a bay reads Bay Info, then its crew, then When Damaged, open on the reference', () => {
    const { bay } = cantina()
    for (const presentation of ['page', undefined] as const) {
      const { unmount } = render(<ReferenceEntityCard data={bay} presentation={presentation} />)
      const info = screen.getByRole('button', { name: 'Collapse Cantina Bay Info' })
      const damaged = screen.getByRole('button', { name: 'Collapse Cantina When Damaged' })
      const crew = screen.getByText(bay.npc?.position ?? '')
      expect(info.compareDocumentPosition(crew) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(crew.compareDocumentPosition(damaged) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      unmount()
    }
  })
})
