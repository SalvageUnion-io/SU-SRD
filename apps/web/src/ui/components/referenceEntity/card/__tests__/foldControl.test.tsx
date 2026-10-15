/**
 * A folded card has ONE control: its chevron. The card around it is a pointer
 * convenience only — no role, tab stop or name — so the card is a single tab
 * stop, nothing interactive nests inside another control, and a screen reader
 * reads the card's stats and traits instead of a button label.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { foldControl } from '../../foldControl'
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

describe('a folded card with no chevron (foldChevron={false})', () => {
  const renderRow = () =>
    render(<ReferenceEntityCard data={drill()} size="medium" collapsible foldChevron={false} />)

  test('the card itself is the disclosure: one button, named, with its state', () => {
    renderRow()
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(1)
    const card = chevron()
    expect(card.classList.contains('su-card-fold')).toBe(false)
    expect(card.getAttribute('aria-expanded')).toBe('false')
    expect(card.getAttribute('tabindex')).toBe('0')
  })

  test('opened, the chevron returns to fold it back', () => {
    renderRow()
    fireEvent.click(chevron())
    const fold = chevron()
    expect(fold.classList.contains('su-card-fold')).toBe(true)
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(fold)
    expect(chevron().classList.contains('su-card-fold')).toBe(false)
  })
})

describe('foldControl', () => {
  const disclosure = (open: boolean) => ({ open, panelId: 'bay', toggle: () => {} })

  test('folded, it makes the card a pointer target only when asked', () => {
    const base = { subject: 'Pilot Bay' }
    expect(foldControl({ ...base, disclosure: disclosure(false), cardClick: true }).cardClick).toBe(
      true
    )
    expect(foldControl({ ...base, disclosure: disclosure(false) }).cardClick).toBeUndefined()
    // Open, the chevron is only a chevron.
    expect(
      foldControl({ ...base, disclosure: disclosure(true), cardClick: true }).cardClick
    ).toBeUndefined()
  })

  test('names its subject and the surface it controls', () => {
    const control = foldControl({ subject: 'Pilot Bay', disclosure: disclosure(false) })
    expect(control.ariaLabel).toBe('Pilot Bay details')
    expect(control.ariaExpanded).toBe(false)
    expect(control.ariaControls).toBe('bay')
  })
})
