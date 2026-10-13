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

  test('label has uppercase mono styling', () => {
    const { container } = render(
      <FilterRow label="Category">
        <span>chip</span>
      </FilterRow>
    )
    const label = container.querySelector('span')
    expect(label).toBeTruthy()
    // An uppercase caps label rides the CONDENSED face, not the body face.
    expect(label?.style.fontFamily).toContain('Barlow Semi Condensed')
    expect(label?.style.textTransform).toBe('uppercase')
  })
})
