import { describe, expect, test } from 'bun:test'
import { EVENTS_POST_MAX_LINES } from 'game-domain/botWire'
import { tableEventsContainer } from '../tableEventsContainer'

/** The table's events as the bound channel prints them (`/relay/post-events`). */
const text = (lines: string[]) => {
  const block = tableEventsContainer(lines).blocks[0]
  return block?.kind === 'text' ? block.content : ''
}

describe('tableEventsContainer', () => {
  test('one quiet line per event, in order, with no heading', () => {
    expect(text(['Rosa · HP 8 → 5', 'Session started'])).toBe(
      '-# Rosa · HP 8 → 5\n-# Session started'
    )
  })

  test('a line a player named is one line of plain words', () => {
    expect(text(['**Rosa**\n# boards `Mule`'])).toBe('-# \\*\\*Rosa\\*\\* \\# boards \\`Mule\\`')
  })

  test('a long burst is cut, and says how much more there was', () => {
    const lines = Array.from({ length: EVENTS_POST_MAX_LINES + 3 }, (_, i) => `Line ${i}`)
    const printed = text(lines).split('\n')
    expect(printed).toHaveLength(EVENTS_POST_MAX_LINES + 1)
    expect(printed.at(-1)).toBe('-# and 3 more')
  })
})
