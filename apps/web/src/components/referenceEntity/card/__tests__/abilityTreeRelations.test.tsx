/**
 * An ability's place in its tree (owner's calls, 2026-10-19): `TREE | <tree>`
 * opening its class, then `PRECEDING` and `NEXT`, the book's words (p.23),
 * on the Page band and on every card head with a relation budget (C3).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { srdHrefFor } from '../../../../lib/entityHref'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { PeekCard } from '../../../entity/PeekCard'
import { abilityTreeRelations } from '../abilityTreeRelations'
import { EntityPageStamps } from '../EntityPageStamps'
import { resolveEntityPageMeta } from '../entityPage'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const ability = (name: string) => {
  const found = SalvageUnionReference.Abilities.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

const read = (name: string) =>
  abilityTreeRelations(ability(name)).map(({ label, value, ref }) => [
    label,
    value,
    ref?.schemaName,
  ])

/** A strip's relation chips, as `LABEL | value`. */
const relationLane = (root: ParentNode) =>
  [...root.querySelectorAll("[data-chip-class='relation'] .su-stat-cell")].map((cell) =>
    [...cell.querySelectorAll('.su-stat-plate')].map((p) => p.textContent).join(' | ')
  )

describe('abilityTreeRelations', () => {
  test('the first ability has its tree and the next, no preceding', () => {
    expect(read('Folk Song')).toEqual([
      ['Tree', 'Leadership', 'classes'],
      ['Next', 'Behemoth', 'abilities'],
    ])
  })

  test('a middle ability has both neighbours, the preceding first', () => {
    expect(read('Behemoth')).toEqual([
      ['Tree', 'Leadership', 'classes'],
      ['Preceding', 'Folk Song', 'abilities'],
      ['Next', 'Valiant Speech', 'abilities'],
    ])
  })

  test('the last ability has its tree and the preceding, no next', () => {
    expect(read('Valiant Speech')).toEqual([
      ['Tree', 'Leadership', 'classes'],
      ['Preceding', 'Behemoth', 'abilities'],
    ])
  })

  test("the tree opens the class whose page draws it, under the tree's name", () => {
    const [tree] = abilityTreeRelations(ability('Folk Song'))
    const hauler = SalvageUnionReference.Classes.getByName('Hauler')
    expect(tree?.ref).toMatchObject({ schemaName: 'classes', id: hauler?.id, name: 'Leadership' })
    // An Advanced, a Hybrid and a Legendary tree open their own class too.
    expect(abilityTreeRelations(ability('Trojan Horse'))[0]?.ref?.id).toBe(
      SalvageUnionReference.Classes.getByName('Hacker')?.id
    )
    expect(abilityTreeRelations(ability('Field Fabrication'))[0]?.ref?.id).toBe(
      SalvageUnionReference.Classes.getByName('Fabricator')?.id
    )
  })

  test('a tree with no order (Legendary, Generic) has no neighbours; Generic has no class', () => {
    expect(read('Network Takeover')).toEqual([['Tree', 'Legendary Hacker', 'classes']])
    expect(read('Scrap')).toEqual([['Tree', 'Generic', undefined]])
  })

  test('anything not an ability has none', () => {
    const system = SalvageUnionReference.Systems.all()[0]
    if (!system) throw new Error('fixture missing')
    expect(abilityTreeRelations(system)).toEqual([])
  })
})

describe('the tree chips on each form', () => {
  test('the Page band carries them in the relation lane, before the cost, each a link', () => {
    // The SRD's surface, which routes every ref to its page.
    const { container } = render(
      <EntitySurfaceProvider value={{ hrefFor: srdHrefFor }}>
        <EntityPageStamps meta={resolveEntityPageMeta(ability('Behemoth'))} />
      </EntitySurfaceProvider>
    )
    expect(relationLane(container)).toEqual([
      'Tree | Leadership',
      'Preceding | Folk Song',
      'Next | Valiant Speech',
    ])
    const lanes = [...container.querySelectorAll('[data-chip-class]')].map((lane) =>
      lane.getAttribute('data-chip-class')
    )
    expect(lanes.indexOf('relation')).toBeLessThan(lanes.indexOf('cost'))
    const links = [...container.querySelectorAll("[data-chip-class='relation'] a")]
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/classes/hauler/',
      '/abilities/folk-song/',
      '/abilities/valiant-speech/',
    ])
  })

  test('a Card head carries them too', () => {
    const { container } = render(<ReferenceEntityCard data={ability('Folk Song')} />)
    expect(relationLane(container)).toEqual(['Tree | Leadership', 'Next | Behemoth'])
  })

  test('a Peek shows them inert: no link and no nested Peek (ruleset §1.6)', () => {
    const { container } = render(<PeekCard entity={ability('Behemoth')} />)
    expect(relationLane(container)).toEqual([
      'Tree | Leadership',
      'Preceding | Folk Song',
      'Next | Valiant Speech',
    ])
    const lane = container.querySelector("[data-chip-class='relation']")
    expect(lane?.querySelector('a[href], [data-peek]')).toBeNull()
  })
})
