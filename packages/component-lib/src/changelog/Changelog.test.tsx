import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { Changelog } from './Changelog'
import type { ChangelogEntry } from './parseChangelog'

afterEach(cleanup)

describe('Changelog', () => {
  test('renders an empty state when there are no entries', () => {
    render(<Changelog entries={[]} />)
    expect(screen.getByText('No changelog entries yet.')).toBeTruthy()
  })

  test('renders a version headline, date, area badge, and bullet items', () => {
    const entries: ChangelogEntry[] = [
      {
        date: '2026-07-20',
        version: '1.2.3',
        area: 'Data',
        items: ['Added a chassis', 'Fixed a typo'],
      },
    ]
    render(<Changelog entries={entries} />)
    expect(screen.getByText('v1.2.3')).toBeTruthy()
    expect(screen.getByText('2026-07-20')).toBeTruthy()
    expect(screen.getByText('Data')).toBeTruthy()
    expect(screen.getByText('Added a chassis')).toBeTruthy()
    expect(screen.getByText('Fixed a typo')).toBeTruthy()
  })

  test('each entry is a Card, not a bespoke panel', () => {
    // The listing composes the shared card shell, so it inherits the card
    // language (seam stamp, frame weight, header band) instead of restating it.
    const entries: ChangelogEntry[] = [
      { date: '2026-07-20', version: '1.2.3', area: 'Data', items: ['Added a chassis'] },
    ]
    const { container } = render(<Changelog entries={entries} />)
    const frame = container.querySelector('li > div')
    expect(frame?.className).toContain('rounded-card')
    // Card draws its frame as longhand inline style off the border glossary;
    // `chrome` is the sub-panel weight this listing asks for.
    expect(frame?.getAttribute('style')).toContain('var(--bw-chrome)')
  })

  test('renders inline markdown links in a bullet item as anchors', () => {
    // release-please items carry issue/commit refs as `[label](href)` links;
    // they must render as clickable anchors, not literal markdown punctuation.
    const entries: ChangelogEntry[] = [
      {
        date: '2026-07-23',
        version: '2.5.0',
        area: 'Data',
        items: ['chassis patterns get their own pages ([#518](https://example.com/issues/518))'],
      },
    ]
    render(<Changelog entries={entries} />)
    const link = screen.getByRole('link', { name: '#518' })
    expect(link.getAttribute('href')).toBe('https://example.com/issues/518')
    // The non-link prose around it is still present.
    expect(screen.getByText(/chassis patterns get their own pages/)).toBeTruthy()
  })

  test('uses the title as the headline for historical (unversioned) entries', () => {
    const entries: ChangelogEntry[] = [
      { date: '2026-07-14', title: 'Support on Ko-fi', area: 'Site', items: ['Added a link'] },
    ]
    render(<Changelog entries={entries} />)
    expect(screen.getByText('Support on Ko-fi')).toBeTruthy()
    expect(screen.getByText('Site')).toBeTruthy()
  })

  test('falls back to the date as headline when neither version nor title is present', () => {
    const entries: ChangelogEntry[] = [{ date: '2026-07-01', area: 'Site', items: [] }]
    render(<Changelog entries={entries} />)
    // The date is both the headline and the <time> element — expect at least one.
    expect(screen.getAllByText('2026-07-01').length).toBeGreaterThan(0)
  })
})
