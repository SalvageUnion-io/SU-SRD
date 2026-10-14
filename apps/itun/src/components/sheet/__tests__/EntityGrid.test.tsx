/**
 * EntityGridRow — the live sheets' entity-card cell: it renders the card it
 * wraps inside a `min-width: 0` cell.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { EntityGridRow } from '../EntityGrid'

describe('EntityGridRow', () => {
  test('renders the card inside a min-width: 0 cell', () => {
    render(
      <EntityGridRow>
        <span>Card body</span>
      </EntityGridRow>
    )
    const body = screen.getByText('Card body')
    expect(body.parentElement?.style.minWidth).toBe('0')
  })
})
