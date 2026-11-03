/**
 * R58 Intact is quiet: a condition chip draws its tone only for a state that
 * is news (Damaged, Destroyed); Intact, the default, is the quiet paper chip.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

const chip = (status: 'intact' | 'damaged' | 'destroyed') => {
  const { container } = render(<StatusBadge status={status} />)
  const badge = container.querySelector<HTMLElement>('.su-badge')
  if (!badge) throw new Error('no badge')
  return badge
}

describe('StatusBadge — R58 Intact is quiet', () => {
  test('Intact wears no tone', () => {
    expect(chip('intact').className).not.toMatch(/su-badge--tone-/)
  })

  test('Damaged and Destroyed keep theirs', () => {
    expect(chip('damaged').className).toMatch(/su-badge--tone-warn/)
    expect(chip('destroyed').className).toMatch(/su-badge--tone-bad/)
  })
})
