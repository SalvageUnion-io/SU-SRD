/**
 * `/s/$id` — an old snapshot share link (ADR-036). A static page: no loader,
 * nothing read, the same answer for every id.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { ComponentType } from 'react'
import { Route } from '../s/$id'

describe('an old snapshot link', () => {
  test('reads nothing', () => {
    expect(Route.options.loader).toBeUndefined()
  })

  test('shows the retired page, says what to do instead, and offers a way out', () => {
    const Page = Route.options.component as ComponentType
    render(<Page />)

    expect(screen.getByRole('heading', { name: /this share link has been retired/i })).toBeTruthy()
    expect(screen.getByText(/live public sheet/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /back to roster/i })).toBeTruthy()
  })
})
