import { describe, expect, test } from 'bun:test'
import { srdHrefFor } from '../entityHref'
import { resolveMentionRef } from '../staticLinks'

describe('resolveMentionRef', () => {
  test('resolves a trait name to its trait, and so to its page', () => {
    const ref = resolveMentionRef('armour')
    expect(ref?.schemaName).toBe('traits')
    expect(ref && srdHrefFor(ref)).toBe('/traits/armour/')
  })
  test('falls back to keywords for keyword-only names', () => {
    const ref = resolveMentionRef('irradiated')
    expect(ref?.schemaName).toBe('keywords')
    expect(ref && srdHrefFor(ref)).toBe('/keywords/irradiated/')
  })
  test('returns null for unknown names', () => {
    expect(resolveMentionRef('definitely-not-a-trait')).toBeNull()
  })
})
