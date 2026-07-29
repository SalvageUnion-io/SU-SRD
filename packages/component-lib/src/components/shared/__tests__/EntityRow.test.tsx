import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'

import { EntityRow } from '../EntityRow'

// Not automatic under bun:test — without it, rows accumulate in the document and
// `screen` queries match the previous test's markup.
afterEach(cleanup)

/**
 * EntityRow gained a fourth ontology (`game`, ADR-030) and `meta` gained array
 * arity to carry a Game's three badges. Both are widenings of shared surfaces,
 * so the load-bearing assertion here is the one about NOT regressing: a caller
 * passing a single `meta` node must still get exactly one badge.
 */
describe('EntityRow — meta arity', () => {
  test('a single meta node renders exactly one badge', () => {
    render(<EntityRow entityType="pilot" name="Ace" meta="Salvager" sheetHref="#/pilot/ace" />)
    expect(screen.getByText('Salvager')).toBeDefined()
  })

  test('an array renders one badge per entry, in order', () => {
    const { container } = render(
      <EntityRow
        entityType="game"
        name="Union Crawler #430"
        meta={['Hamlet', '4 Pilots', '3 Mechs']}
        sheetHref="#/games/430"
      />
    )
    for (const label of ['Hamlet', '4 Pilots', '3 Mechs']) {
      expect(screen.getByText(label)).toBeDefined()
    }
    // Order matters — the crawler names the table before the counts describe it.
    const text = container.textContent ?? ''
    expect(text.indexOf('Hamlet')).toBeLessThan(text.indexOf('4 Pilots'))
    expect(text.indexOf('4 Pilots')).toBeLessThan(text.indexOf('3 Mechs'))
  })

  test('omitted meta renders no badge, and a nullish entry is dropped', () => {
    // A caller building the array conditionally (no crawler yet) must not get an
    // empty badge for the hole.
    const { container } = render(
      <EntityRow
        entityType="game"
        name="Thursday Night Salvage"
        meta={[null, '0 Pilots', undefined]}
        sheetHref="#/games/thursday"
      />
    )
    expect(screen.getByText('0 Pilots')).toBeDefined()
    expect(container.textContent).not.toContain('null')
    expect(container.textContent).not.toContain('undefined')
  })
})

describe('EntityRow — the game ontology', () => {
  test('a game row paints the game rail, not the crawler rail', () => {
    const { container } = render(
      <EntityRow entityType="game" name="Union Crawler #430" sheetHref="#/games/430" />
    )
    const html = container.innerHTML
    expect(html).toContain('--color-sheet-game-deep')
    expect(html).not.toContain('--color-sheet-crawler')
  })

  test('the empty variant renders a game placeholder', () => {
    render(
      <EntityRow empty entityType="game" roleLabel="Game" message="You are not in any games yet." />
    )
    expect(screen.getByText('Game')).toBeDefined()
    expect(screen.getByText('You are not in any games yet.')).toBeDefined()
  })

  test('the View link points at the game', () => {
    render(<EntityRow entityType="game" name="Union Crawler #430" sheetHref="/games/430" />)
    expect(screen.getByText('View').getAttribute('href')).toBe('/games/430')
  })
})
