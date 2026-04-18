import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { FilterChip } from '../FilterChip'

describe('FilterChip', () => {
  afterEach(cleanup)

  test('inactive chip uses fully opaque text-su-black for WCAG AA contrast', () => {
    render(<FilterChip label="Weapons" active={false} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Weapons' })
    // text-su-black on bg-su-grey-light ≈ 9.1:1 (passes AA for normal text)
    expect(button.className).toContain('text-su-black')
    expect(button.className).toContain('bg-su-grey-light')
    expect(button.className).not.toContain('text-su-black/70')
    expect(button.className).not.toContain('bg-su-grey-light/30')
  })

  test('inactive chip with colorClass uses fully opaque text-su-black', () => {
    render(<FilterChip label="Armor" active={false} onClick={() => {}} colorClass="bg-su-green" />)
    const button = screen.getByRole('button', { name: 'Armor' })
    expect(button.className).toContain('text-su-black')
    expect(button.className).not.toContain('text-su-black/70')
  })

  test('active chip uses contrasting text on dark background', () => {
    render(<FilterChip label="All" active={true} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'All' })
    expect(button.className).toContain('text-su-white')
    expect(button.className).not.toContain('text-su-black/70')
  })

  test('inactive chip exposes a focus-visible outline for keyboard users', () => {
    render(<FilterChip label="Weapons" active={false} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Weapons' })
    expect(button.className).toContain('focus-visible:outline')
  })
})
