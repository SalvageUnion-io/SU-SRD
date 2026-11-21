/**
 * A band's fact chips name rules (L1): TL its tech level, RNG its distance,
 * Salvage Value and the action type their keywords. Anything else only reads.
 */
import { describe, expect, test } from 'bun:test'
import { actionTypeRef, factRef } from '../parts/factRefs'

describe('factRef', () => {
  test('a Tech Level names its tech level', () => {
    expect(factRef({ key: 'tech-level', value: '4' })?.slug).toBe('tech-4')
  })

  test('a range names its distance', () => {
    expect(factRef({ key: 'range', value: 'Long' })).toMatchObject({
      schemaName: 'distances',
      slug: 'long',
    })
  })

  test('Salvage Value names its keyword', () => {
    expect(factRef({ key: 'book-Salvage Value', value: '8' })).toMatchObject({
      schemaName: 'keywords',
      slug: 'salvage-value',
    })
  })

  test('a stat the glossary defines names its keyword, so its abbreviation explains itself', () => {
    const slugs = (
      [
        'Structure Points',
        'Energy Points',
        'Hit Points',
        'System Slots',
        'Module Slots',
        'Heat Capacity',
      ] as const
    ).map((name) => factRef({ key: `book-${name}`, value: '4' })?.slug)
    expect(slugs).toEqual([
      'structure-points',
      'energy-points',
      'hit-points',
      'system-slots',
      'module-slots',
      'heat',
    ])
    // No entry: it only reads.
    expect(factRef({ key: 'book-Cargo Capacity', value: '6' })).toBeUndefined()
  })

  test('any other fact only reads', () => {
    expect(factRef({ key: 'damage', value: '9 SP' })).toBeUndefined()
    expect(factRef({ key: 'range', value: 'Medium-ish' })).toBeUndefined()
  })

  test('an action type names its keyword', () => {
    expect(actionTypeRef('Turn Action')?.slug).toBe('turn-action')
  })
})
