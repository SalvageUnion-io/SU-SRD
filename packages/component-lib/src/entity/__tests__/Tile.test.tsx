/**
 * A Tile carries the entity's lore line while browsing (`lead`): after the
 * value cells, clamped to three lines, the full text in its tooltip.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Entity } from '../Entity'

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
