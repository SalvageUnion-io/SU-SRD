/**
 * Pure embed-shaping tests — no discord.js interaction objects needed.
 */
import { describe, expect, test } from 'bun:test'
import { ROLL_ATTRIBUTION, stripDanglingLink, truncate } from '../format.js'

describe('truncate', () => {
  test('passes short text through and caps long text', () => {
    expect(truncate('short', 100)).toBe('short')
    const long = 'word '.repeat(100)
    expect(truncate(long, 50).length).toBeLessThanOrEqual(50)
    expect(truncate(long, 50).endsWith('…')).toBe(true)
  })
})

describe('stripDanglingLink', () => {
  test('leaves a complete trailing link alone', () => {
    const text = 'before [Armour Plating](https://salvageunion.io/x)'
    expect(stripDanglingLink(text)).toBe(text)
  })

  test('drops a link cut before its closing bracket', () => {
    expect(stripDanglingLink('kept [Armour Pla')).toBe('kept')
  })

  test('drops a link cut inside the URL', () => {
    expect(stripDanglingLink('kept [Armour Plating](https://salvage')).toBe('kept')
  })

  test('leaves text with no bracket at all alone', () => {
    expect(stripDanglingLink('no links here')).toBe('no links here')
  })

  test('handles an empty string', () => {
    expect(stripDanglingLink('')).toBe('')
  })
})

describe('roll attribution', () => {
  test('credits Randsum.dev, since rolls are powered by @randsum/roller', () => {
    expect(ROLL_ATTRIBUTION).toContain('Powered by Randsum.dev')
    expect(ROLL_ATTRIBUTION).toContain('Salvage Union Reference')
  })
})
