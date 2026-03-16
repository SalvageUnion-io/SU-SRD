import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { FilterChip } from '../FilterChip'

describe('FilterChip', () => {
  afterEach(cleanup)

  test('inactive chip uses accessible text color (text-su-black/70)', () => {
    render(<FilterChip label="Weapons" active={false} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Weapons' })
    expect(button.className).toContain('text-su-black/70')
    expect(button.className).not.toContain('text-su-grey-dark')
  })

  test('inactive chip with colorClass uses accessible text color', () => {
    render(<FilterChip label="Armor" active={false} onClick={() => {}} colorClass="bg-su-green" />)
    const button = screen.getByRole('button', { name: 'Armor' })
    expect(button.className).toContain('text-su-black/70')
  })

  test('active chip does not use the inactive text color', () => {
    render(<FilterChip label="All" active={true} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'All' })
    expect(button.className).toContain('text-su-white')
    expect(button.className).not.toContain('text-su-black/70')
  })
})
