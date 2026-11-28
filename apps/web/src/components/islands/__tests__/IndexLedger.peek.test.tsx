/**
 * A listing's names Peek where the row stands (r6 G2, G7): a chassis's
 * ability and a part's traits are each their entry's Peek trigger, never a
 * Tab stop of their own, the cell's words still its hover title.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { EntityRef, RefEntity, RefEnumSchemaName } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../entity/EntitySurface'
import { IndexLedger } from '../IndexLedger'

const hrefFor = (ref: EntityRef) =>
  ref.schemaName === 'actions' ? undefined : `/${ref.schemaName}/${ref.slug}/`

function rowOf(schema: RefEnumSchemaName, name: string) {
  const items = SalvageUnionReference.findAllIn(schema, () => true) as RefEntity[]
  const { container } = render(
    <EntitySurfaceProvider value={{ hrefFor }}>
      <IndexLedger schemaId={schema} noun={schema} items={items} />
    </EntitySurfaceProvider>
  )
  const row = [...container.querySelectorAll('tbody tr')].find(
    (tr) => tr.querySelector('th')?.textContent?.trim().startsWith(name) ?? false
  )
  if (!row) throw new Error(`row missing: ${name}`)
  const quiet = row.querySelector('td[data-kind="quiet"]')
  if (!quiet) throw new Error(`quiet line missing: ${name}`)
  return quiet
}

describe("a listing's names Peek", () => {
  test("a chassis's ability Peeks its rules (G7)", () => {
    const cell = rowOf('chassis', 'Mule')
    const trigger = cell.querySelector('[data-peek]')
    expect(trigger?.textContent).toBe('Integrated Cargo Bay')
    expect(trigger?.getAttribute('data-peek')).toMatch(/^actions:/)
    expect(trigger?.getAttribute('tabindex')).toBe('-1')
    expect(cell.querySelector('[title]')?.getAttribute('title')).toBe('Integrated Cargo Bay')
  })

  test("a part's traits each Peek, a tap's term like any (G2)", () => {
    const cell = rowOf('systems', '.50 Cal')
    const triggers = [...cell.querySelectorAll('a[data-peek]')]
    expect(triggers.map((a) => a.textContent)).toEqual(['Ballistic', 'Jamming', 'Pinning'])
    for (const a of triggers) {
      expect(a.getAttribute('data-peek')).toMatch(/^traits:/)
      expect(a.hasAttribute('data-peek-press')).toBe(true)
      expect(a.getAttribute('tabindex')).toBe('-1')
    }
    expect(cell.textContent).toBe('Ballistic, Jamming, Pinning')
  })
})
