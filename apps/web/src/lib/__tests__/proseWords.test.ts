import { describe, expect, test } from 'bun:test'
import { plainTraitText } from 'salvageunion-reference'
import { proseWords } from '../proseWords'

describe('trait markup read as words (r8 B2)', () => {
  test('a roll line reads the trait by its word', () => {
    expect(proseWords('Scylla gains the [[Vulnerable]] Trait')).toBe(
      'Scylla gains the Vulnerable Trait'
    )
  })

  test('a trait with its parameter, as the package reads it', () => {
    const text = 'It has [[Shield]] and [[[Hot] (3)]].'
    expect(proseWords(text)).toBe(plainTraitText(text))
  })

  test('words with no markup are kept as they are', () => {
    expect(proseWords('Raider 2 rolled 14')).toBe('Raider 2 rolled 14')
  })
})
