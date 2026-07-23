import { describe, test, expect } from 'bun:test'
import { parseChangelog, mergeChangelogs } from './parseChangelog'
import type { ChangelogEntry } from './parseChangelog'

const RELEASE_PLEASE = `# Changelog

All notable changes are recorded here.

## [1.0.1](https://github.com/x/y/compare/v1.0.0...v1.0.1) (2026-07-20)

### Features

* **wizard:** add crawler bay selection ([abc123](https://x))
* support offline snapshots

### Bug Fixes

* **sheet:** fix heat gauge overflow ([def456](https://x))

## 0.9.0 (2026-07-10)

### Features

* initial dashboard
`

const HISTORICAL = `# Historical Changelog

> Curated by hand before release-please.

## 2026-07-14 — Ko-fi

- Added a Ko-fi support link
- New ITUN About page

## 2026-07-01

- Bootstrapped the reference site
`

function at(entries: ChangelogEntry[], index: number): ChangelogEntry {
  const entry = entries[index]
  if (!entry) throw new Error(`no entry at index ${index}`)
  return entry
}

describe('parseChangelog — release-please shape', () => {
  const entries = parseChangelog(RELEASE_PLEASE, 'itun')

  test('parses two versioned sections', () => {
    expect(entries).toHaveLength(2)
  })

  test('extracts version and date, no title', () => {
    const first = at(entries, 0)
    expect(first.version).toBe('1.0.1')
    expect(first.date).toBe('2026-07-20')
    expect(first.title).toBeUndefined()
    expect(first.area).toBe('itun')
  })

  test('collects bullets across ### subheadings, stripping leading bold', () => {
    const first = at(entries, 0)
    expect(first.items).toEqual([
      'add crawler bay selection ([abc123](https://x))',
      'support offline snapshots',
      'fix heat gauge overflow ([def456](https://x))',
    ])
  })

  test('second versioned section', () => {
    const second = at(entries, 1)
    expect(second.version).toBe('0.9.0')
    expect(second.date).toBe('2026-07-10')
    expect(second.items).toEqual(['initial dashboard'])
  })
})

describe('parseChangelog — historical shape', () => {
  const entries = parseChangelog(HISTORICAL, 'web')

  test('parses date + title, no version', () => {
    const first = at(entries, 0)
    expect(first.date).toBe('2026-07-14')
    expect(first.title).toBe('Ko-fi')
    expect(first.version).toBeUndefined()
    expect(first.area).toBe('web')
    expect(first.items).toEqual(['Added a Ko-fi support link', 'New ITUN About page'])
  })

  test('date-only heading has no title', () => {
    const second = at(entries, 1)
    expect(second.date).toBe('2026-07-01')
    expect(second.title).toBeUndefined()
    expect(second.items).toEqual(['Bootstrapped the reference site'])
  })

  test('ignores the H1 and leading blockquote', () => {
    expect(entries).toHaveLength(2)
  })
})

describe('parseChangelog — skips', () => {
  test('skips a section with no date and no items', () => {
    expect(parseChangelog('## Unreleased\n\nnothing here yet', 'x')).toHaveLength(0)
  })
})

describe('mergeChangelogs', () => {
  test('merges and sorts by date descending, stable within a date', () => {
    const itun = parseChangelog(RELEASE_PLEASE, 'itun')
    const web = parseChangelog(HISTORICAL, 'web')
    const merged = mergeChangelogs(itun, web)

    expect(merged.map((e) => e.date)).toEqual([
      '2026-07-20',
      '2026-07-14',
      '2026-07-10',
      '2026-07-01',
    ])
    expect(at(merged, 0).area).toBe('itun')
    expect(at(merged, 1).area).toBe('web')
  })

  test('equal dates keep input order (list order, then within-list order)', () => {
    const a = parseChangelog('## 2026-05-05 — A\n- one', 'a')
    const b = parseChangelog('## 2026-05-05 — B\n- two', 'b')
    const merged = mergeChangelogs(a, b)
    expect(merged.map((e) => e.title)).toEqual(['A', 'B'])
  })
})
