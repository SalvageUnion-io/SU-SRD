import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { FilterRow } from '../FilterRow'

describe('FilterRow', () => {
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

  test('exposes group semantics named after the label', () => {
    render(
      <FilterRow label="TL">
        <span>child</span>
      </FilterRow>
    )
    expect(screen.getByRole('group', { name: 'Filter by TL' })).toBeTruthy()
  })

  test('label is the Eyebrow caps label', () => {
    const { container } = render(
      <FilterRow label="Category">
        <span>chip</span>
      </FilterRow>
    )
    const label = container.querySelector('span')
    expect(label).toBeTruthy()
    // An uppercase caps label rides the CONDENSED face (`.su-caps`), in ink on the Filters panel's paper.
    expect(label?.classList.contains('su-caps')).toBe(true)
    expect(label?.classList.contains('su-eyebrow--ink')).toBe(true)
  })
})
