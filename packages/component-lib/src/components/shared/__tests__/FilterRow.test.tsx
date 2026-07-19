import { describe, test, expect, afterEach } from 'bun:test'
import { render, screen, cleanup } from '@testing-library/react'
import { FilterRow } from '../FilterRow'

describe('FilterRow', () => {
  afterEach(cleanup)

  test('renders the label text', () => {
    render(
      <FilterRow label="Type">
        <span>child</span>
      </FilterRow>
    )
    expect(screen.getByText('Type')).toBeTruthy()
  })

  test('renders children', () => {
    render(
      <FilterRow label="Source">
        <span>Core</span>
        <span>Expansion</span>
      </FilterRow>
    )
    expect(screen.getByText('Core')).toBeTruthy()
    expect(screen.getByText('Expansion')).toBeTruthy()
  })

  test('applies default gap class', () => {
    const { container } = render(
      <FilterRow label="TL">
        <span>child</span>
      </FilterRow>
    )
    const inner = container.querySelector('.gap-1')
    expect(inner).toBeTruthy()
  })

  test('applies custom gap class when provided', () => {
    const { container } = render(
      <FilterRow label="TL" gap="gap-3">
        <span>child</span>
      </FilterRow>
    )
    const inner = container.querySelector('.gap-3')
    expect(inner).toBeTruthy()
  })

  test('label has uppercase mono styling', () => {
    const { container } = render(
      <FilterRow label="Category">
        <span>chip</span>
      </FilterRow>
    )
    const label = container.querySelector('span')
    expect(label).toBeTruthy()
    // An uppercase caps label rides the CONDENSED face (font-cond), not the
    // body face — it used to sit on the retired `font-mono` alias.
    expect(label?.className).toContain('font-cond')
    expect(label?.className).toContain('uppercase')
  })
})
