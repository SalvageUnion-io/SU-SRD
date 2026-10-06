import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { EntityRow } from '../EntityRow'

// Not automatic under bun:test — without it, rows accumulate in the document and
// `screen` queries match the previous test's markup.

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
  test('a game row paints the game band, not the crawler band', () => {
    const { container } = render(
      <EntityRow entityType="game" name="Union Crawler #430" sheetHref="#/games/430" />
    )
    const html = container.innerHTML
    // A Game named after a crawler is exactly where the two tones could be
    // confused, which is why this asserts the token rather than the look.
    expect(html).toContain('--color-sheet-game')
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

/**
 * Unassign and Delete are different verbs — one ends an assignment, the other
 * destroys the entity — so they must not share a control or a name.
 */
describe('EntityRow — unassign is not delete', () => {
  test('Unassign is a labelled button named for the row, and fires its own handler', () => {
    const onUnassign = mock(() => {})
    const onDelete = mock(() => {})
    render(
      <EntityRow
        entityType="mech"
        name="Iron Fist"
        onUnassignClick={onUnassign}
        onDeleteClick={onDelete}
      />
    )
    const unassign = screen.getByRole('button', { name: 'Unassign Iron Fist' })
    expect(unassign.textContent).toContain('Unassign')

    fireEvent.click(unassign)
    expect(onUnassign).toHaveBeenCalledTimes(1)
    expect(onDelete).not.toHaveBeenCalled()
  })

  test('a row with only Unassign shows no Delete, and one with neither shows no Unassign', () => {
    const { unmount } = render(
      <EntityRow entityType="pilot" name="Yara Voss" onUnassignClick={() => {}} />
    )
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull()
    unmount()

    render(<EntityRow entityType="pilot" name="Yara Voss" onDeleteClick={() => {}} />)
    expect(screen.queryByRole('button', { name: /^Unassign/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Delete Yara Voss' })).toBeDefined()
  })
})
