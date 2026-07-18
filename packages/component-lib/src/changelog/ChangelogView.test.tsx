import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import { ChangelogView } from './ChangelogView'
import type { ChangelogEntry } from './parseChangelog'

afterEach(cleanup)

describe('ChangelogView', () => {
  test('renders an empty state when there are no entries', () => {
    render(<ChangelogView entries={[]} />)
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
    render(<ChangelogView entries={entries} />)
    expect(screen.getByText('v1.2.3')).toBeTruthy()
    expect(screen.getByText('2026-07-20')).toBeTruthy()
    expect(screen.getByText('Data')).toBeTruthy()
    expect(screen.getByText('Added a chassis')).toBeTruthy()
    expect(screen.getByText('Fixed a typo')).toBeTruthy()
  })

  test('uses the title as the headline for historical (unversioned) entries', () => {
    const entries: ChangelogEntry[] = [
      { date: '2026-07-14', title: 'Support on Ko-fi', area: 'Site', items: ['Added a link'] },
    ]
    render(<ChangelogView entries={entries} />)
    expect(screen.getByText('Support on Ko-fi')).toBeTruthy()
    expect(screen.getByText('Site')).toBeTruthy()
  })

  test('falls back to the date as headline when neither version nor title is present', () => {
    const entries: ChangelogEntry[] = [{ date: '2026-07-01', area: 'Site', items: [] }]
    render(<ChangelogView entries={entries} />)
    // The date is both the headline and the <time> element — expect at least one.
    expect(screen.getAllByText('2026-07-01').length).toBeGreaterThan(0)
  })
})
