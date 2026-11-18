/**
 * A Page's lore is titled Description (hard rule R43, ruleset §1.7): the
 * entity's own words sit under a Description Slab, never under a book's name.
 * With art they fill the side column beneath it (hard rule R61).
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

test('the entity’s own words sit under a Description Slab', () => {
  const container = page()
  const lore = container.querySelector('.su-manual__lore')
  expect(lore?.querySelector('h2, h3')?.textContent).toBe('Description')
  expect(lore?.querySelector('.su-entity-page__prose')?.textContent).toContain('Gopher')
})

test('the Description fills the side column under the art', () => {
  const side = page().querySelector('.su-manual__side')
  expect([...(side?.children ?? [])].map((el) => el.classList.contains('su-manual__lore'))).toEqual(
    [false, true]
  )
  expect(side?.firstElementChild?.classList.contains('su-manual__art')).toBe(true)
})
