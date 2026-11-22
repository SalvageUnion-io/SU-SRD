import { describe, expect, test } from 'bun:test'
import { mediatorOnly, patternChoices, sheetChoices, sheetVisibility } from '../visibility'

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

// MD4-02: the dialog said the Game's crew can see a Mediator's NPC; the room serves them nothing of it.
describe('an NPC in a Game', () => {
  test('is withheld from the crew unless it crews the crawler; no other kind ever is', () => {
    expect(mediatorOnly('npc', true, false)).toBe(true)
    expect(mediatorOnly('npc', true, true)).toBe(false)
    expect(mediatorOnly('npc', false, false)).toBe(false)
    for (const kind of ['pilot', 'mech', 'crawler'] as const) {
      expect(mediatorOnly(kind, true, false)).toBe(false)
    }
  })

  test('says only the Mediator can see it, on the field too, and when the crew would (r5 B12)', () => {
    const choices = sheetChoices({ inGame: true, gameName: 'Rust Coast', mediatorOnly: true })
    expect(labels(choices)).toEqual(['Only the Mediator', 'My Game’s crew', 'Public'])
    expect(open(choices)).toEqual(['private', 'link'])
    expect(choices[0]?.description).toBe(
      'It is in Rust Coast. Only its Mediator can see it, on the field too: players never see the Opposition.'
    )
    expect(choices[1]?.description).toBe('The crew sees an NPC once it crews the Game’s crawler.')
    expect(choices.map((c) => c.description).join(' ')).not.toMatch(
      /crew can see it|Everyone in Rust Coast/
    )
    expect(sheetVisibility({ isPublic: false, inGame: true, mediatorOnly: true })).toBe('private')
    expect(sheetVisibility({ isPublic: true, inGame: true, mediatorOnly: true })).toBe('link')
  })
})

describe('a pattern', () => {
  test('takes all three answers, the crew one only with a Game to name', () => {
    expect(open(patternChoices({ gameName: 'Dustbowl Run' }))).toEqual(['private', 'game', 'link'])
    expect(open(patternChoices({ gameName: null }))).toEqual(['private', 'link'])
  })
})
