/**
 * MISSING ART: where a schema keeps an art place (`artSlot`), an entity with no
 * artwork wears one of the manual's three censor marks, and always the same
 * one — on its listing card and on its page.
 *
 * Rendered through the real card with real SRD data.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { getAssetUrl, SalvageUnionReference } from 'salvageunion-reference'
import { missingArtVariant, tornEdge } from '../missingArtMark'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const chassis = () => SalvageUnionReference.Chassis.all()
const artless = () => chassis().filter((item) => !getAssetUrl(item))
const withArt = () => chassis().filter((item) => !!getAssetUrl(item))

const mark = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-missing-art]')?.dataset.missingArt

describe('missing art', () => {
  test('a schema’s art-less entities take the three marks in turn, in listing order', () => {
    // The listing groups chassis by tech level, book order within each.
    const tier = (item: ReturnType<typeof chassis>[number]) =>
      typeof item.techLevel === 'number' ? item.techLevel : 0
    const variants = [...artless()]
      .sort((a, b) => tier(a) - tier(b))
      .slice(0, 6)
      .map((item) => missingArtVariant(item))
    expect(variants).toEqual(['file', 'row', 'removed', 'file', 'row', 'removed'])
  })

  test('the listing card and the page wear the same mark', () => {
    for (const item of artless().slice(0, 3)) {
      const row = render(<ReferenceEntityCard data={item} size="medium" extent="head" artSlot />)
      const listed = mark(row.container)
      row.unmount()
      const page = render(
        <ReferenceEntityCard data={item} size="large" presentation="page" artSlot />
      )
      expect(listed).toBe(missingArtVariant(item))
      expect(mark(page.container)).toBe(listed)
      page.unmount()
    }
  })

  test('an entity with art, or a card without artSlot, wears no mark', () => {
    const art = render(
      <ReferenceEntityCard
        data={need(withArt()[0], 'chassis with art')}
        size="medium"
        extent="head"
        artSlot
      />
    )
    expect(mark(art.container)).toBeUndefined()
    art.unmount()
    const bare = render(
      <ReferenceEntityCard
        data={need(artless()[0], 'art-less chassis')}
        size="large"
        presentation="page"
      />
    )
    expect(mark(bare.container)).toBeUndefined()
  })

  test('an entity tears the same way every time, and differently from the next', () => {
    const a = need(artless()[0], 'art-less chassis')
    const b = need(artless()[1], 'second art-less chassis')
    const shape = { depth: 7, steps: 18, sides: 'all' } as const
    expect(tornEdge(a, shape)).toBe(tornEdge(a, shape))
    expect(tornEdge(a, shape)).not.toBe(tornEdge(b, shape))
  })
})
