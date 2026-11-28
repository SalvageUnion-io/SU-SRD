import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { StarterAside } from '../StarterAside'

describe('StarterAside', () => {
  test('signed out: the way to the table starts with signing in, and links Your Games', () => {
    render(<StarterAside signedIn={false} />)
    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(steps).toHaveLength(5)
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Your Games' }).getAttribute('href')).toContain(
      '/games/'
    )
  })

  test('signed in: no sign-in step; the book box links its Page', () => {
    render(<StarterAside signedIn />)
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(4)
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Read about the book' }).getAttribute('href')).toBe(
      '/sources/reclamation-of-the-wastes/'
    )
  })
})
