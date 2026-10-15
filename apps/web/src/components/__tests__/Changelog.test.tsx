import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { ChangelogEntry } from '../Changelog'
import { Changelog } from '../Changelog'

describe('Changelog', () => {
  test('renders an empty state when there are no entries', () => {
    render(<Changelog entries={[]} />)
    expect(screen.getByText('No changelog entries yet.')).toBeTruthy()
  })

  test('renders the date as the headline and bullet items', () => {
    const entries: ChangelogEntry[] = [
      { date: '2026-07-20', items: ['Added a chassis', 'Fixed a typo'] },
    ]
    render(<Changelog entries={entries} />)
    const headline = screen.getByRole('heading', { level: 2 })
    expect(headline.querySelector('time')?.getAttribute('dateTime')).toBe('2026-07-20')
    expect(headline.textContent).toBe('2026-07-20')
    expect(screen.getByText('Added a chassis')).toBeTruthy()
    expect(screen.getByText('Fixed a typo')).toBeTruthy()
  })

  test('each entry wears the shared cut-out head, the date on the tab', () => {
    const entries: ChangelogEntry[] = [{ date: '2026-07-20', items: ['Added a chassis'] }]
    const { container } = render(<Changelog entries={entries} />)
    const head = container.querySelector('.su-changelog__entry > .su-entity-row__head')
    expect(head?.getAttribute('style')).toContain('background-color')
    expect(head?.hasAttribute('data-notch')).toBe(true)
    expect(head?.querySelector('.su-entity-row__notch h2 time')).not.toBeNull()
  })

  test('renders inline markdown links in a bullet item as anchors', () => {
    // Each item carries its PR as a `[label](href)` link; it must render as a
    // clickable anchor, not literal markdown punctuation.
    const entries: ChangelogEntry[] = [
      {
        date: '2026-07-23',
        items: ['chassis patterns get their own pages ([#518](https://example.com/pull/518))'],
      },
    ]
    render(<Changelog entries={entries} />)
    const link = screen.getByRole('link', { name: '#518' })
    expect(link.getAttribute('href')).toBe('https://example.com/pull/518')
    // The non-link prose around it is still present.
    expect(screen.getByText(/chassis patterns get their own pages/)).toBeTruthy()
  })
})
