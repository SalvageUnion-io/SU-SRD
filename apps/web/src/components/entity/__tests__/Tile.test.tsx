/**
 * A Tile carries its value cells beside the name on the band, and the
 * entity's lore line while browsing (`lead`): under the band, clamped to
 * three lines, the full text in its tooltip.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'
import { Entity } from '../Entity'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const mule = () => need(SalvageUnionReference.Chassis.getByName('Mule'), 'mule')
const muleLead = () => need(toEntityModel(mule()).lead, 'mule lead')

const chipsOf = (container: HTMLElement) => {
  const chips = container.querySelector('.su-entity-tile__band > .su-entity-tile__chips')
  if (!(chips instanceof HTMLElement)) throw new Error('no chips')
  return chips
}

const cellsOf = (container: HTMLElement) => {
  const cells = container.querySelector('.su-entity-tile__cells')
  if (!(cells instanceof HTMLElement)) throw new Error('no cells')
  return cells
}

describe('Tile lead', () => {
  test('renders the lore line under the band, the value cells beside the name', () => {
    const { container } = render(<Entity form="tile" entity={mule()} lead />)
    const cells = cellsOf(container)
    expect(cells.childElementCount).toBe(1)
    expect(cells.firstElementChild?.tagName).toBe('P')
    expect(cells.firstElementChild?.textContent).toBe(muleLead())
    expect(chipsOf(container).querySelectorAll('.su-stat-cell').length).toBeGreaterThan(1)
  })

  // happy-dom drops `-webkit-box` and `-webkit-line-clamp` from a parsed
  // style, so the clamp is read from the markup React emits.
  test('clamps it to three lines, the full text in the tooltip', () => {
    const html = renderToStaticMarkup(<Entity form="tile" entity={mule()} lead />)
    const style = html.match(/<p [^>]*style="([^"]*)"[^>]*title="/)?.[1]
    expect(style).toContain('display:-webkit-box')
    expect(style).toContain('-webkit-box-orient:vertical')
    expect(style).toContain('-webkit-line-clamp:3')
    expect(style).toContain('overflow:hidden')

    const { container } = render(<Entity form="tile" entity={mule()} lead />)
    expect(cellsOf(container).querySelector('p')?.title).toBe(muleLead())
  })

  test('without `lead`, the tile carries no lore line', () => {
    const { container } = render(<Entity form="tile" entity={mule()} />)
    expect(container.querySelector('.su-entity-tile__cells p')).toBeNull()
    expect(container.textContent).not.toContain(muleLead())
  })
})

describe('Tile cells', () => {
  test("a hybrid's requirements wrap in the tile rather than being clipped", () => {
    const cyborg = need(SalvageUnionReference.Classes.getByName('Cyborg'), 'cyborg')
    const { container } = render(<Entity form="tile" entity={cyborg} lead />)
    const req = [...chipsOf(container).querySelectorAll('.su-stat-cell')].find(
      (cell) => cell.firstElementChild?.textContent === 'REQ'
    )
    expect(req?.classList.contains('su-stat-cell--wrap')).toBe(true)
  })
})

describe('Tile art', () => {
  test('an entity with art opens on its art, then the band', () => {
    const { container } = render(<Entity form="tile" entity={mule()} />)
    const frame = container.querySelector('.su-entity-tile__frame')
    expect(frame?.firstElementChild?.classList).toContain('su-entity-tile__art')
    expect(container.querySelector('.su-entity-tile__art img')).not.toBeNull()
    expect(container.querySelector('.su-entity-tile--bare')).toBeNull()
  })

  test('an entity without art has no art place: the tile opens on its band', () => {
    const tl = need(SalvageUnionReference.CrawlerTechLevels.all()[2], 'crawler tech level 3')
    const vrTubes = need(SalvageUnionReference.CrawlerBays.getByName('VR Tubes'), 'vr tubes')
    for (const entity of [tl, vrTubes]) {
      const { container } = render(<Entity form="tile" entity={entity} />)
      expect(container.querySelector('.su-entity-tile__art')).toBeNull()
      const frame = container.querySelector('.su-entity-tile__frame')
      expect(frame?.firstElementChild?.classList).toContain('su-entity-tile__band')
      expect(container.querySelector('.su-entity-tile--bare')).not.toBeNull()
    }
  })

  test('in a catalog with art, an art-less tile keeps the art place and wears a censor mark', () => {
    const tl = need(SalvageUnionReference.CrawlerTechLevels.all()[2], 'crawler tech level 3')
    const { container } = render(<Entity form="tile" entity={tl} missingArt={0} />)
    const frame = container.querySelector('.su-entity-tile__frame')
    expect(frame?.firstElementChild?.classList).toContain('su-entity-tile__art')
    const mark = container.querySelector('.su-entity-tile__art .su-missing-art')
    expect(mark?.getAttribute('aria-hidden')).toBe('true')
    expect(mark?.querySelector('.su-missing-art__backdrop')?.getAttribute('src')).toMatch(
      /-440q\d+\.webp$/
    )
    expect(container.querySelector('.su-entity-tile--bare')).toBeNull()
  })

  test('the marks turn with the art-less ordinal, so neighbours differ', () => {
    const tl = need(SalvageUnionReference.CrawlerTechLevels.all()[2], 'crawler tech level 3')
    const variants = [0, 1, 2].map((ordinal) => {
      const { container } = render(<Entity form="tile" entity={tl} missingArt={ordinal} />)
      return container.querySelector('[data-missing-art]')?.getAttribute('data-missing-art')
    })
    expect(variants).toEqual(['file', 'row', 'removed'])
  })

  test('an entity with art ignores the censor mark', () => {
    const { container } = render(<Entity form="tile" entity={mule()} missingArt={0} />)
    expect(container.querySelector('.su-missing-art')).toBeNull()
    expect(container.querySelector('.su-entity-tile__art img')).not.toBeNull()
  })

  test("measured art sits in a window carrying its ink box, for the phone's band", () => {
    const { container } = render(<Entity form="tile" entity={mule()} />)
    const window = container.querySelector('.su-entity-tile__art > .su-entity-tile__window')
    if (!(window instanceof HTMLElement)) throw new Error('no art window')
    expect(window.querySelector('img')).not.toBeNull()
    expect(window.style.getPropertyValue('--su-art-aspect')).toBe('0.9454')
    for (const side of ['left', 'top', 'width', 'height'])
      expect(window.style.getPropertyValue(`--su-tile-art-${side}`)).toMatch(/%$/)
  })

  test('on a phone the art place is a 2:1 band; wider, the window is no box', () => {
    const css = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).toMatch(/\.su-entity-tile__window\s*\{\s*display: contents;/)
    const phone = css.slice(css.indexOf('.su-entity-tile__window {'))
    expect(phone).toMatch(
      /@media not \(width >= 40rem\)\s*\{\s*\.su-entity-tile__art\s*\{\s*aspect-ratio: 2 \/ 1;/
    )
  })
})

describe('Tile chips for systems and modules', () => {
  const chips = (schema: string, name: string) => {
    const entity = need(SalvageUnionReference.getByNameIn(schema as never, name), name)
    const { container } = render(<Entity form="tile" entity={entity as never} />)
    return Array.from(chipsOf(container).children).map((chip) =>
      (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
    )
  }

  test("a system's chips are one strip in the stat order, without SV, its range as the book's code", () => {
    // One flat strip that fills from the band's bottom-right corner up (§4.7),
    // on one line wherever it fits: never split into fixed lines.
    expect(chips('systems', 'Red Laser')).toEqual(['TL1', 'Slots3', 'RNGC', 'DMG3 SP'])
  })

  test("a module's salvage value stays off its tile; its cost is its last chip", () => {
    const strip = chips('modules', 'Laser Guidance')
    expect(strip.some((chip) => chip.startsWith('SV'))).toBe(false)
    expect(strip.at(-1)).toBe('3 EP')
  })

  test('no tile splits its chips into lines', () => {
    for (const [schema, name] of [
      ['systems', 'Cargo Pod'],
      ['systems', 'Red Laser'],
    ] as const) {
      const entity = need(SalvageUnionReference.getByNameIn(schema as never, name), name)
      const { container } = render(<Entity form="tile" entity={entity as never} />)
      expect(chipsOf(container).querySelector('.su-entity-tile__line')).toBeNull()
    }
    const { container } = render(<Entity form="tile" entity={mule()} />)
    expect(chipsOf(container).querySelector('.su-entity-tile__line')).toBeNull()
  })
})
