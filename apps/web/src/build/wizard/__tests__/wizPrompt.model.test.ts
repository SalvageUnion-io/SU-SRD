/** The action bar's prompt (r2 H1): where a press lands, and when the line is said. */
import { describe, expect, test } from 'bun:test'
import { promptShows, scrollBlockFor } from '../wizPrompt.model'

describe('scrollBlockFor', () => {
  test('a target too tall to centre opens on its top, not its middle', () => {
    expect(scrollBlockFor(1200, 844)).toBe('start')
    expect(scrollBlockFor(600, 844)).toBe('start')
  })

  test('a short one is centred', () => {
    expect(scrollBlockFor(250, 844)).toBe('center')
  })
})

describe('promptShows', () => {
  test('said until pressed, and not while its target is on screen', () => {
    expect(promptShows({ key: '0:a', used: null, inView: false })).toBe(true)
    expect(promptShows({ key: '0:a', used: '0:a', inView: false })).toBe(false)
    expect(promptShows({ key: '0:a', used: null, inView: true })).toBe(false)
  })

  test('another step’s prompt, or another ask, is said afresh', () => {
    expect(promptShows({ key: '1:a', used: '0:a', inView: false })).toBe(true)
    expect(promptShows({ key: '0:b', used: '0:a', inView: false })).toBe(true)
  })
})
