import { describe, expect, test } from 'bun:test'
import { mentionRef } from '../../ui/index'
import { srdHrefFor } from '../entityHref'

describe('mentionRef', () => {
  test('resolves a trait name to its trait, and so to its page', () => {
    const ref = mentionRef('armour')
    expect(ref?.schemaName).toBe('traits')
    expect(ref && srdHrefFor(ref)).toBe('/traits/armour/')
  })
  test('resolves a capitalised mention through the lower-cased glossary name', () => {
    const ref = mentionRef('Armour')
    expect(ref?.schemaName).toBe('traits')
    expect(ref && srdHrefFor(ref)).toBe('/traits/armour/')
  })
  test('falls back to keywords for keyword-only names', () => {
    const ref = mentionRef('irradiated')
    expect(ref?.schemaName).toBe('keywords')
    expect(ref && srdHrefFor(ref)).toBe('/keywords/irradiated/')
  })
  test('returns undefined for unknown names', () => {
    expect(mentionRef('definitely-not-a-trait')).toBeUndefined()
  })
})
