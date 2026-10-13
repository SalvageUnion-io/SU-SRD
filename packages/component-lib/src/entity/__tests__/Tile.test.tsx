/**
 * A Tile carries the entity's lore line while browsing (`lead`): after the
 * value cells, clamped to three lines, the full text in its tooltip.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Entity } from '../Entity'
import { monogram } from '../parts/plate'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const mule = () => need(SalvageUnionReference.Chassis.getByName('Mule'), 'mule')
const muleLead = () => need(toEntityModel(mule()).lead, 'mule lead')

const cellsOf = (container: HTMLElement) => {
  const cells = container.querySelector('.su-entity-tile__cells')
  if (!(cells instanceof HTMLElement)) throw new Error('no cells')
  return cells
}

describe('Tile lead', () => {
  test('renders the lore line after the value cells', () => {
    const { container } = render(<Entity form="tile" entity={mule()} lead />)
    const cells = cellsOf(container)
    const lead = cells.lastElementChild
    expect(lead?.tagName).toBe('P')
    expect(lead?.textContent).toBe(muleLead())
    expect(cells.childElementCount).toBeGreaterThan(1)
  })

  // happy-dom drops `-webkit-box` and `-webkit-line-clamp` from a parsed
  // style, so the clamp is read from the markup React emits.
  test('clamps it to three lines, the full text in the tooltip', () => {
    const html = renderToStaticMarkup(<Entity form="tile" entity={mule()} lead />)
    const style = html.match(/<p style="([^"]*)"[^>]*title="/)?.[1]
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
    const req = [...cellsOf(container).querySelectorAll('.su-stat-cell')].find(
      (cell) => cell.firstElementChild?.textContent === 'REQ'
    )
    expect(req?.classList.contains('su-stat-cell--wrap')).toBe(true)
  })
})

describe('Tile plate', () => {
  test('a tech level with no art wears its numeral', () => {
    const tl = need(SalvageUnionReference.CrawlerTechLevels.all()[2], 'crawler tech level 3')
    const { container } = render(<Entity form="tile" entity={tl} />)
    expect(container.querySelector('.su-entity-tile__numeral')?.textContent).toBe('3')
  })

  test('any other entity with no art wears its monogram, even one with a tech level', () => {
    const vrTubes = need(SalvageUnionReference.CrawlerBays.getByName('VR Tubes'), 'vr tubes')
    const { container } = render(<Entity form="tile" entity={vrTubes} />)
    expect(container.querySelector('.su-entity-tile__numeral')?.textContent).toBe('VT')
  })

  test('the monogram is the initials of the first two words that open on a letter', () => {
    expect(monogram('Trade Caravan')).toBe('TC')
    expect(monogram('Close')).toBe('C')
    expect(monogram('Crawler #693 Salvagers')).toBe('CS')
    expect(monogram('SAKURA 78TH LANCE MSD')).toBe('SL')
  })
})
