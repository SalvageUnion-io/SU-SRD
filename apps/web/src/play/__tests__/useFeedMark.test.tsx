/**
 * `useFeedMark` (r4 B7): Play's bar wears "New in the Feed" once somebody
 * else's line lands while the Feed is out of sight, and takes it down again.
 */

import { describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import type { FeedEntry } from '../feed.model'
import { useFeedMark } from '../useFeedMark'

const line = (key: string, ts: number, over: Partial<FeedEntry> = {}): FeedEntry =>
  ({ kind: 'event', key, ts, text: key, ...over }) as FeedEntry

describe('useFeedMark', () => {
  test('a crewmate’s new line raises the mark while no pane shows the Feed; my own never does', () => {
    // No element wears the id: the Feed is on another phone tab.
    const view = renderHook(({ entries }) => useFeedMark(entries, 'no-feed-here'), {
      initialProps: { entries: [line('a', 1)] },
    })
    // What was there at first sight is history.
    expect(view.result.current.shown).toBe(false)
    view.rerender({ entries: [line('mine', 3, { kind: 'mine' }), line('a', 1)] })
    expect(view.result.current.shown).toBe(false)
    view.rerender({ entries: [line('b', 4), line('a', 1)] })
    expect(view.result.current.shown).toBe(true)
    act(() => view.result.current.clear())
    expect(view.result.current.shown).toBe(false)
  })
})
