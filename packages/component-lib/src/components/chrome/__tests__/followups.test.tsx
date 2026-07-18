import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { Badge } from '../Badge'
import { Chip } from '../Chip'
import { EmptyState } from '../EmptyState'
import { InlineRef } from '../InlineRef'

afterEach(cleanup)

describe('Badge (unified) + presets', () => {
  test('solid is ink-on-paper; tone fills the surface', () => {
    render(<Badge>Ballistic</Badge>)
    expect(screen.getByText('Ballistic').className).toContain('bg-ink')
    cleanup()
    render(
      <Badge surface="tone" tone="bad">
        Destroyed
      </Badge>
    )
    const bad = screen.getByText('Destroyed')
    expect(bad.className).toContain('bg-status-bad')
    expect(bad.className).toContain('border-status-bad')
  })

  test('every badge shares the 22px height + 2px radius', () => {
    render(<Badge surface="quiet">Uses</Badge>)
    const chip = screen.getByText('Uses')
    expect(chip.className).toContain('h-[22px]')
    expect(chip.className).toContain('rounded-badge')
  })

  test('Badge / tone / Chip presets still render their signature fills', () => {
    render(<Badge>Armour</Badge>)
    expect(screen.getByText('Armour').className).toContain('bg-ink')
    cleanup()
    render(
      <Badge surface="tone" tone="mech">
        Mule
      </Badge>
    )
    expect(screen.getByText('Mule').className).toContain('bg-su-green')
    cleanup()
    render(<Chip>Uses</Chip>)
    expect(screen.getByText('Uses').className).toContain('bg-wk-bg-2')
  })
})

describe('EmptyState', () => {
  test('renders a stamp headline, body, and a single action', () => {
    render(
      <EmptyState
        headline="No mechs yet"
        body="Build your first chassis."
        action={<button type="button">New mech</button>}
      />
    )
    expect(screen.getByText('No mechs yet')).toBeTruthy()
    expect(screen.getByText('Build your first chassis.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'New mech' })).toBeTruthy()
  })

  test('the frame is dashed (fillable)', () => {
    const { container } = render(<EmptyState headline="Empty" />)
    expect(container.firstElementChild?.className).toContain('border-dashed')
  })
})

describe('InlineRef', () => {
  test('resolved renders a rust-bordered link', () => {
    render(
      <InlineRef resolved href="/systems/autocannon">
        Autocannon
      </InlineRef>
    )
    const link = screen.getByRole('link', { name: 'Autocannon' })
    expect(link.getAttribute('href')).toBe('/systems/autocannon')
    expect(link.className).toContain('border-rust')
  })

  test('unresolved is an inert ink-dashed span, not a link', () => {
    render(<InlineRef>Widget</InlineRef>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Widget').className).toContain('border-dashed')
  })
})
