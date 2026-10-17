import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { Pending } from '../Pending'

describe('Pending', () => {
  test('names the subject in a polite status', () => {
    render(<Pending label="the crew" />)
    const status = screen.getByRole('status')
    expect(status.textContent).toBe('Loading the crew…')
    expect(status.getAttribute('aria-live')).toBe('polite')
  })

  test('without a label it reads the bare "Loading…"', () => {
    render(<Pending />)
    expect(screen.getByRole('status').textContent).toBe('Loading…')
  })

  test('wears the muted hint treatment', () => {
    render(<Pending />)
    expect(screen.getByRole('status').className).toContain('su-text--hint')
  })
})
