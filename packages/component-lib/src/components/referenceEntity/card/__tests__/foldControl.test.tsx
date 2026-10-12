/**
 * A folded card has ONE control: its chevron. The card around it is a pointer
 * convenience only — no role, tab stop or name — so the card is a single tab
 * stop, nothing interactive nests inside another control, and a screen reader
 * reads the card's stats and traits instead of a button label.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const drill = () => {
  const found = SalvageUnionReference.Systems.getByName('Salvaging Drill')
  if (!found) throw new Error('fixture missing: Salvaging Drill')
  return found
}

const chevron = () => screen.getByRole('button', { name: 'Salvaging Drill details' })

describe('a folded card', () => {
  test('its chevron is the one control: a disclosure naming the card', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} size="medium" collapsible />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    const button = chevron()
    expect(button.getAttribute('aria-expanded')).toBe('false')
    const target = button.getAttribute('aria-controls')
    expect(target).toBeTruthy()
    // It names the card wrapper itself.
    const card = container.firstElementChild
    expect(card?.id).toBe(target ?? '')
    expect(button.classList.contains('su-card-fold')).toBe(true)
  })

  test('the card itself carries no role, tab stop or name', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} size="medium" collapsible />)
    const card = container.firstElementChild
    expect(card?.getAttribute('role')).toBeNull()
    expect(card?.getAttribute('tabindex')).toBeNull()
    expect(card?.getAttribute('aria-label')).toBeNull()
  })

  test('a pointer click on the card opens it; the chevron toggles it and names the state', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} size="medium" collapsible />)
    const card = container.firstElementChild
    if (!(card instanceof HTMLElement)) throw new Error('no card')
    fireEvent.click(card)
    expect(chevron().getAttribute('aria-expanded')).toBe('true')
    // The open card keeps the id the chevron names.
    expect(container.firstElementChild?.id).toBe(chevron().getAttribute('aria-controls') ?? '')
    fireEvent.click(chevron())
    expect(chevron().getAttribute('aria-expanded')).toBe('false')
    // The chevron's own click stops at the button: one click, one toggle.
    fireEvent.click(chevron())
    expect(chevron().getAttribute('aria-expanded')).toBe('true')
  })
})
