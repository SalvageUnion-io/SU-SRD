import { describe, expect, test } from 'bun:test'
import { gameRowModel, hangarRowModel } from '../containerRow.model'

/** A container as a Compact: a Game (ruleset §1.9) and the Training Bay a unit moves back to. */

describe('a Game’s Compact', () => {
  test('is titled by the Game, in the crawler’s tone, and links nowhere by itself', () => {
    const model = gameRowModel('The Rust Belt Run')
    expect(model.title).toBe('The Rust Belt Run')
    expect(model.tone).toBe('crawler')
    expect(model.ref.synthetic).toBe(true)
    expect(model.facts).toEqual([])
  })
})

describe('the Training Bay’s Compact', () => {
  test('is titled as its list names it, in Shelves ink', () => {
    const model = hangarRowModel('Not in a Game')
    expect(model.title).toBe('Not in a Game')
    expect(model.tone).toBe('ink')
    expect(model.kind.stamp).toBe('Training Bay')
    expect(model.ref.synthetic).toBe(true)
  })
})
