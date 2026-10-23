import { describe, expect, test } from 'bun:test'
import { patternChoices, sheetChoices, sheetVisibility } from '../visibility'

/**
 * Who can see it: one question, the same three answers and the same words for
 * every kind a player shares. Only which answers a kind can take differs.
 */

const labels = (choices: { label: string }[]) => choices.map((c) => c.label)
const open = (choices: { value: string; disabled: boolean }[]) =>
  choices.filter((c) => !c.disabled).map((c) => c.value)

describe('the same three answers for every kind', () => {
  test('a sheet (pilot, mech, crawler, NPC) and a pattern ask in the same words', () => {
    const words = ['Only me', 'My Game’s crew', 'Public']
    expect(labels(sheetChoices({ inGame: false, gameName: null }))).toEqual(words)
    expect(labels(patternChoices({ gameName: 'Dustbowl Run' }))).toEqual(words)
  })
})

describe('a sheet', () => {
  test('on the shelf: Only me or the link; the crew answer waits for a Game', () => {
    const choices = sheetChoices({ inGame: false, gameName: null })
    expect(open(choices)).toEqual(['private', 'link'])
    expect(choices[1]?.description).toMatch(/move it into a game/i)
  })

  test('in a Game: its crew or the link; Only me waits for the shelf', () => {
    const choices = sheetChoices({ inGame: true, gameName: 'Dustbowl Run' })
    expect(open(choices)).toEqual(['game', 'link'])
    expect(choices[1]?.description).toMatch(/everyone in Dustbowl Run/i)
    expect(choices[0]?.description).toMatch(/move it to your Training Bay/i)
  })

  test('its answer is the link when public, else where it is', () => {
    expect(sheetVisibility({ isPublic: true, inGame: true })).toBe('link')
    expect(sheetVisibility({ isPublic: false, inGame: true })).toBe('game')
    expect(sheetVisibility({ isPublic: false, inGame: false })).toBe('private')
  })
})

describe('a pattern', () => {
  test('takes all three answers, the crew one only with a Game to name', () => {
    expect(open(patternChoices({ gameName: 'Dustbowl Run' }))).toEqual(['private', 'game', 'link'])
    expect(open(patternChoices({ gameName: null }))).toEqual(['private', 'link'])
  })
})
