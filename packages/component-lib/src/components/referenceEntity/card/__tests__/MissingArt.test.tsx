/**
 * MISSING ART: where a schema keeps an art place (`artSlot`), an entity with no
 * artwork wears one of the manual's three censor marks, and always the same
 * one — on its listing card and on its page.
 *
 * Rendered through the real card with real SRD data: the NPCs, a schema with
 * art where most entries still have none (every chassis now has its art).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { getAssetUrl, missingArt, SalvageUnionReference } from 'salvageunion-reference'
import { tornEdge } from '../missingArtMark'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const npcs = () => SalvageUnionReference.NPCs.all()
const artless = () => npcs().filter((item) => !getAssetUrl(item))
const withArt = () => npcs().filter((item) => !!getAssetUrl(item))

const mark = (container: HTMLElement) =>
  container.querySelector<HTMLElement>('[data-missing-art]')?.dataset.missingArt
const backdrop = (container: HTMLElement) =>
  container.querySelector<HTMLImageElement>('.su-missing-art__backdrop')?.getAttribute('src')
/** Rainmaker's chassis blueprints, as `getAssetUrl` addresses them. */
const blueprints = () =>
  SalvageUnionReference.Chassis.all()
    .filter((item) => item.source === 'Rainmaker')
    .map((item) => getAssetUrl(item))

describe('missing art', () => {
  test('a schema’s art-less entities take the three marks in turn, in listing order', () => {
    // NPCs carry no tech level, so the listing is book order.
    const variants = artless()
      .slice(0, 6)
      .map((item) => missingArt(item).variant)
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
      expect(listed).toBe(missingArt(item).variant)
      expect(mark(page.container)).toBe(listed)
      page.unmount()
    }
  })

  test('behind each mark, a Rainmaker blueprint, and a different one for each neighbour', () => {
    const run = artless()
      .slice(0, 7)
      .map((item) => missingArt(item).backdrop)
    expect(new Set(run).size).toBe(7)
    for (const url of run) expect(blueprints()).toContain(url)
  })

  test('the listing card and the page draw the same blueprint', () => {
    const item = need(artless()[0], 'art-less NPC')
    const row = render(<ReferenceEntityCard data={item} size="medium" extent="head" artSlot />)
    const listed = backdrop(row.container)
    row.unmount()
    const page = render(
      <ReferenceEntityCard data={item} size="large" presentation="page" artSlot />
    )
    const master = missingArt(item).backdrop.replace(/\.webp$/, '')
    expect(listed).toBe(`${master}-440.webp`)
    expect(backdrop(page.container)).toBe(`${master}-880.webp`)
    page.unmount()
  })

  test('an entity with art, or a card without artSlot, wears no mark', () => {
    const art = render(
      <ReferenceEntityCard
        data={need(withArt()[0], 'NPC with art')}
        size="medium"
        extent="head"
        artSlot
      />
    )
    expect(mark(art.container)).toBeUndefined()
    art.unmount()
    const bare = render(
      <ReferenceEntityCard
        data={need(artless()[0], 'art-less NPC')}
        size="large"
        presentation="page"
      />
    )
    expect(mark(bare.container)).toBeUndefined()
  })

  test('an entity tears the same way every time, and differently from the next', () => {
    const a = need(artless()[0], 'art-less NPC')
    const b = need(artless()[1], 'second art-less NPC')
    const shape = { depth: 7, steps: 18, sides: 'all' } as const
    const edge = (item: typeof a) => tornEdge(missingArt(item).seed, shape)
    expect(edge(a)).toBe(edge(a))
    expect(edge(a)).not.toBe(edge(b))
  })
})
