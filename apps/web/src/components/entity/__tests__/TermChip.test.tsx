/**
 * A stat the glossary has no entry for defines itself on a press (RR-12, EDL
 * E27): Cargo Capacity, Slots Required, DMG and TP open the app's own words
 * for them over the book's page, where a hover `title` says nothing on a phone.
 */
import { describe, expect, test } from 'bun:test'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PeekHost } from '../Peek'
import { Facts } from '../parts/Facts'
import { factRef } from '../parts/factRefs'
import { statTerm, TRAINING_POINTS } from '../parts/statTerms'
import { TermChip } from '../parts/TermChip'
import { InsidePeekContext } from '../peekContext'

function press(target: HTMLElement) {
  act(() => {
    fireEvent.pointerDown(target, { pointerType: 'touch', clientX: 5, clientY: 5 })
    fireEvent.pointerUp(target, { pointerType: 'touch' })
    fireEvent.click(target)
  })
}

describe('statTerm', () => {
  test('names the four stats with no glossary entry, each with its page', () => {
    const cited = ['book-Cargo Capacity', 'book-Slots Required', 'damage'].map(
      (key) => statTerm({ key })?.cite
    )
    expect(cited).toEqual([
      'Workshop Manual · p.97',
      'Workshop Manual · p.97',
      'Workshop Manual · p.241',
    ])
    expect(TRAINING_POINTS.cite).toBe('Workshop Manual · p.23')
  })

  test('a stat the glossary defines is its entry’s, never a term', () => {
    for (const key of ['book-Salvage Value', 'book-System Slots', 'book-Heat Capacity']) {
      expect(factRef({ key, value: '4' })).toBeDefined()
      expect(statTerm({ key })).toBeUndefined()
    }
    expect(statTerm({ key: 'range' })).toBeUndefined()
  })
})

describe('a chip that names a term', () => {
  test('a press opens what it means, with the book’s page', async () => {
    render(
      <>
        <Facts linkable cells={[{ key: 'damage', label: 'DMG', value: '6 SP' }]} />
        <PeekHost />
      </>
    )
    const chip = screen.getByRole('button', { name: 'Damage: 6 SP, what it means' })
    press(chip)
    const peek = await screen.findByRole('tooltip')
    expect(peek.textContent).toContain('Damage')
    expect(peek.textContent).toContain('a Pilot takes double')
    expect(peek.textContent).toContain('Workshop Manual · p.241')
    // The chip is described by its meaning while it is open.
    expect(chip.getAttribute('aria-describedby')).toBe(peek.id)
  })

  test('a chip that does not link only reads, as inside a Peek', () => {
    render(<Facts cells={[{ key: 'damage', label: 'DMG', value: '6 SP' }]} />)
    expect(screen.queryByRole('button')).toBeNull()
    cleanup()
    render(
      <InsidePeekContext.Provider value={true}>
        <TermChip term={TRAINING_POINTS} value="1">
          1 TP
        </TermChip>
      </InsidePeekContext.Provider>
    )
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('1 TP')).toBeTruthy()
  })

  test('Training Points: the cost box says what a TP is', async () => {
    render(
      <>
        <TermChip term={TRAINING_POINTS} value="2">
          2 TP
        </TermChip>
        <PeekHost />
      </>
    )
    press(screen.getByRole('button', { name: 'Training Points: 2, what it means' }))
    const peek = await screen.findByRole('tooltip')
    expect(peek.textContent).toContain('2 for an Advanced or Hybrid Class Ability')
  })
})
