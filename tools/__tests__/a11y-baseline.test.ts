import { describe, expect, test } from 'bun:test'
import type { Baseline, ScanOutcome } from '../lib/a11yBaseline'
import { diffAgainstBaseline } from '../lib/a11yBaseline'

const ok = (page: string, device: string, ...ids: string[]): ScanOutcome => ({
  page,
  device,
  violations: ids.length,
  details: ids.map((id) => ({ id })),
})

const crash = (page: string, device: string): ScanOutcome => ({
  page,
  device,
  violations: -1,
  details: [],
})

const baseline: Baseline = {
  pages: { '/': ['color-contrast'], '/pilots/new': ['color-contrast'] },
}

describe('diffAgainstBaseline', () => {
  test('an accepted id seen on any device is live', () => {
    const { regressions, stale } = diffAgainstBaseline(
      [
        ok('/', 'desktop'),
        ok('/', 'Pixel 7', 'color-contrast'),
        ok('/pilots/new', 'desktop', 'color-contrast'),
      ],
      baseline
    )
    expect(regressions).toEqual([])
    expect(stale).toEqual([])
  })

  test('an id no device sees is stale and pruned', () => {
    const { stale, pruned } = diffAgainstBaseline(
      [ok('/', 'desktop'), ok('/pilots/new', 'desktop', 'color-contrast')],
      baseline
    )
    expect(stale).toEqual(['/: color-contrast no longer fires'])
    expect(pruned.pages['/']).toEqual([])
  })

  test('a page that crashed on every device keeps its entries and is not stale', () => {
    const { regressions, stale, pruned } = diffAgainstBaseline(
      [
        ok('/', 'desktop', 'color-contrast'),
        crash('/pilots/new', 'desktop'),
        crash('/pilots/new', 'Pixel 7'),
      ],
      baseline
    )
    expect(regressions).toEqual([
      '/pilots/new (desktop): the scan itself failed',
      '/pilots/new (Pixel 7): the scan itself failed',
    ])
    expect(stale).toEqual([])
    expect(pruned.pages['/pilots/new']).toEqual(['color-contrast'])
  })

  test('a page that crashed on one device keeps entries only that device might see', () => {
    const { stale, pruned } = diffAgainstBaseline(
      [
        ok('/', 'desktop', 'color-contrast'),
        ok('/pilots/new', 'desktop'),
        crash('/pilots/new', 'Pixel 7'),
      ],
      baseline
    )
    expect(stale).toEqual([])
    expect(pruned.pages['/pilots/new']).toEqual(['color-contrast'])
  })

  test('a baseline page that was not scanned is stale and pruned', () => {
    const { stale, pruned } = diffAgainstBaseline([ok('/', 'desktop', 'color-contrast')], baseline)
    expect(stale).toEqual(['/pilots/new is in the baseline but was not scanned'])
    expect(pruned.pages).toEqual({ '/': ['color-contrast'] })
  })

  test('an id the baseline does not accept is a regression', () => {
    const { regressions } = diffAgainstBaseline(
      [
        ok('/', 'Pixel 7', 'color-contrast', 'target-size'),
        ok('/pilots/new', 'desktop', 'color-contrast'),
      ],
      baseline
    )
    expect(regressions).toEqual(['/ (Pixel 7): target-size'])
  })
})
