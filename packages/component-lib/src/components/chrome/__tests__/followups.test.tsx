import { describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
import { Badge } from '../Badge'
import { EmptyState } from '../EmptyState'
import { InlineRef } from '../InlineRef'

describe('Badge (unified) + presets', () => {
  test('solid is ink-on-paper; tone fills the surface', () => {
    render(<Badge>Ballistic</Badge>)
    expect(screen.getByText('Ballistic').className).toContain('su-badge--solid')
    cleanup()
    render(
      <Badge surface="tone" tone="bad">
        Destroyed
      </Badge>
    )
    const bad = screen.getByText('Destroyed')
    expect(bad.className).toContain('su-badge--tone')
    expect(bad.className).toContain('su-badge--tone-bad')
  })

  test('every badge shares the 22px height + 2px radius', () => {
    render(<Badge surface="quiet">Uses</Badge>)
    const chip = screen.getByText('Uses')
    // `.su-badge` carries the 22px height and the badge radius (styles/index.css).
    expect(chip.className).toContain('su-badge')
  })

  test('Badge / tone / quiet presets still render their signature fills', () => {
    render(<Badge>Armour</Badge>)
    expect(screen.getByText('Armour').className).toContain('su-badge--solid')
    cleanup()
    render(
      <Badge surface="tone" tone="mech">
        Mule
      </Badge>
    )
    expect(screen.getByText('Mule').className).toContain('su-badge--tone-mech')
    cleanup()
    render(<Badge surface="quiet">Uses</Badge>)
    expect(screen.getByText('Uses').style.backgroundColor).toBe(color.wkBg)
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
  test('href renders a rust-bordered link', () => {
    render(<InlineRef href="/systems/autocannon">Autocannon</InlineRef>)
    const link = screen.getByRole('link', { name: 'Autocannon' })
    expect(link.getAttribute('href')).toBe('/systems/autocannon')
    expect(link.className).toContain('su-inline-ref--link')
  })

  test('no href is an inert ink-dashed span, not a link', () => {
    render(<InlineRef>Widget</InlineRef>)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('Widget').className).toContain('su-inline-ref--inert')
  })
})
