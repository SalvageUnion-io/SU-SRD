/**
 * A Page's lore leads its main column as plain prose (best, revision 8,
 * replacing R43's Description Slab and R61's side column): no heading, no
 * panel, before the rules; a chassis's stats and ability lead it (RR6-06).
 */
import { expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const page = () => {
  const gopher = SalvageUnionReference.Chassis.getByName('Gopher')
  if (!gopher) throw new Error('fixture missing: gopher')
  return render(<ReferenceEntityCard data={gopher} presentation="page" />).container
}

test('the entity’s own words are plain prose, under no Description heading', () => {
  const container = page()
  expect(container.querySelector('.su-manual__lore')).toBeNull()
  const prose = container.querySelector('.su-manual__main .su-entity-page__prose')
  expect(prose?.textContent).toContain('Gopher')
  expect(
    [...container.querySelectorAll('h2, h3')].some((h) => h.textContent === 'Description')
  ).toBe(false)
})

test('a chassis reads stats, its ability, then its words; the side column holds the art (RR6-06)', () => {
  const container = page()
  const main = container.querySelector('.su-manual__main')
  const kids = [...(main?.children ?? [])].map((kid) => kid.className)
  expect(kids[0]).toContain('su-manual__stats')
  expect(kids[1]).toContain('su-manual__ability')
  expect(kids[2]).toContain('su-entity-page__prose')
  const side = container.querySelector('.su-manual__side')
  expect(side?.querySelector('.su-entity-page__prose')).toBeNull()
  expect(side?.firstElementChild?.classList.contains('su-manual__art')).toBe(true)
  // The art follows the rules in the markup, so Tab reads what the eye does.
  expect(main?.compareDocumentPosition(side as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
})
