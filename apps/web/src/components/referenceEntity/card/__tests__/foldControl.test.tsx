/**
 * A folded card is its Token (EDL N2: header-only is a Token), and a Token
 * draws no rail: the Token itself is the ONE control, a disclosure button
 * named for the card with its state. Opened, the Card's chevron folds it back.
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

const disclosure = () => screen.getByRole('button', { name: 'Salvaging Drill details' })

describe('a folded card', () => {
  const renderFolded = () =>
    render(<ReferenceEntityCard data={drill()} size="compact" collapsible />)

  test('is a Token, and the Token is the one control: a disclosure, named, with its state', () => {
    const { container } = renderFolded()
    expect(container.querySelector('.su-entity-token')).toBeTruthy()
    expect(container.querySelector('.su-entity-row')).toBeNull()
    expect(screen.getAllByRole('button')).toHaveLength(1)
    const token = disclosure()
    expect(token.classList.contains('su-card-fold')).toBe(false)
    expect(token.getAttribute('aria-expanded')).toBe('false')
    expect(token.getAttribute('tabindex')).toBe('0')
  })

  test('opened, the Card keeps the id its chevron names, and the chevron folds it back', () => {
    const { container } = renderFolded()
    fireEvent.click(disclosure())
    const chevron = disclosure()
    expect(chevron.classList.contains('su-card-fold')).toBe(true)
    expect(chevron.getAttribute('aria-expanded')).toBe('true')
    const target = chevron.getAttribute('aria-controls')
    expect(target).toBeTruthy()
    expect(container.firstElementChild?.id).toBe(target ?? '')
    // The chevron's own click stops at the button: one click, one toggle.
    fireEvent.click(chevron)
    expect(disclosure().getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('.su-entity-token')).toBeTruthy()
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
