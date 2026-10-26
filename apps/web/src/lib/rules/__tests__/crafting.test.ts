/**
 * The Crafting Bay's Tech Level gate (Core Book p.222).
 */
import { describe, expect, it } from 'bun:test'
import { craftableAtTl } from '../crafting'

describe('craftableAtTl (p.222 — crawler TL or lower)', () => {
  it('allows items at or below the crawler tech level', () => {
    expect(craftableAtTl(1, 2)).toBe(true)
    expect(craftableAtTl(2, 2)).toBe(true)
  })

  it('refuses items above the crawler tech level', () => {
    expect(craftableAtTl(3, 2)).toBe(false)
  })

  it('refuses non-scrap tech levels', () => {
    expect(craftableAtTl(0, 6)).toBe(false)
    expect(craftableAtTl(7, 6)).toBe(false)
    expect(craftableAtTl(1.5, 6)).toBe(false)
  })
})
