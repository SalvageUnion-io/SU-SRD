import { describe, expect, test } from 'bun:test'
import { bringsAbilitiesIntoView } from '../wizPrompt.model'

/** r8 F3 (SB8-17): on a phone a picked class brings its abilities into view. */
describe('bringsAbilitiesIntoView', () => {
  test('below lg, when the list opens in the lower half of the screen or past it', () => {
    expect(bringsAbilitiesIntoView({ top: 900, viewportHeight: 800, wide: false })).toBe(true)
    expect(bringsAbilitiesIntoView({ top: 500, viewportHeight: 800, wide: false })).toBe(true)
  })

  test('not while it already opens high on the screen', () => {
    expect(bringsAbilitiesIntoView({ top: 120, viewportHeight: 800, wide: false })).toBe(false)
  })

  test('not from lg, where the picked class stands beside the list', () => {
    expect(bringsAbilitiesIntoView({ top: 900, viewportHeight: 800, wide: true })).toBe(false)
  })
})
