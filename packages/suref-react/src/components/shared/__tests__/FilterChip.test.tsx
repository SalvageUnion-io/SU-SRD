import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { FilterChip } from '../FilterChip'

describe('FilterChip', () => {
  afterEach(cleanup)

  test('inactive chip is ink-on-paper (chrome token system, high AA contrast)', () => {
    render(<FilterChip label="Weapons" active={false} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Weapons' })
    // text-ink on bg-paper is very high contrast (passes AA for normal text)
    expect(button.className).toContain('text-ink')
    expect(button.className).toContain('bg-paper')
    expect(button.className).not.toContain('text-ink/70')
  })

  test('inactive chip with colorClass uses fully opaque ink text', () => {
    render(<FilterChip label="Armor" active={false} onClick={() => {}} colorClass="bg-su-green" />)
    const button = screen.getByRole('button', { name: 'Armor' })
    expect(button.className).toContain('text-ink')
    expect(button.className).not.toContain('text-ink/70')
  })

  test('active chip is paper text on the ink fill', () => {
    render(<FilterChip label="All" active={true} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'All' })
    expect(button.className).toContain('text-paper')
    expect(button.className).toContain('bg-ink')
  })

  test('inactive chip exposes the shared rust focus ring for keyboard users', () => {
    render(<FilterChip label="Weapons" active={false} onClick={() => {}} />)
    const button = screen.getByRole('button', { name: 'Weapons' })
    expect(button.className).toContain('focus-visible:ring-rust/25')
  })
})
