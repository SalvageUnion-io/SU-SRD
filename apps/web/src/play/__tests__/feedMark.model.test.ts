import { describe, expect, test } from 'bun:test'
import type { FeedEntry } from '../feed.model'
import { feedOutOfSight, newestFromOthers, raisesMark } from '../feedMark.model'

const line = (key: string, ts: number, over: Partial<FeedEntry> = {}): FeedEntry =>
  ({ kind: 'event', key, ts, text: key, ...over }) as FeedEntry

describe('"New in the Feed" (r4 B7)', () => {
  test('the newest line is somebody else’s: never my own roll, nor the table’s line for my own act', () => {
    expect(newestFromOthers([])).toBeNull()
    expect(
      newestFromOthers([
        line('mine', 900, { kind: 'mine' }),
        line('own', 800, { own: true }),
        line('theirs', 500),
        line('older', 100),
      ])
    ).toBe('theirs')
  })

  test('the Feed is out of sight below the fold, scrolled away, or on another tab', () => {
    expect(feedOutOfSight(null, 900)).toBe(true)
    expect(feedOutOfSight({ top: 1049, bottom: 1300 }, 900)).toBe(true)
    expect(feedOutOfSight({ top: -400, bottom: -10 }, 900)).toBe(true)
    expect(feedOutOfSight({ top: 700, bottom: 1300 }, 900)).toBe(false)
  })

  test('the mark goes up for a new line while the Feed is out of sight, never at first sight', () => {
    expect(raisesMark(undefined, 'a', true)).toBe(false)
    expect(raisesMark('a', 'b', true)).toBe(true)
    expect(raisesMark(null, 'b', true)).toBe(true)
    expect(raisesMark('a', 'b', false)).toBe(false)
    expect(raisesMark('a', 'a', true)).toBe(false)
    expect(raisesMark('a', null, true)).toBe(false)
  })
})
