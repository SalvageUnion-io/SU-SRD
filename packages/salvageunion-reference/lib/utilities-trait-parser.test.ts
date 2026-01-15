import { describe, expect, test } from 'bun:test'
import { parseTraitReferences } from './utilities.js'

describe('parseTraitReferences', () => {
  test('should parse simple trait references', () => {
    const text = 'This has the [[Shield]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = refs[0]!
    expect(ref.traitName).toBe('Shield')
    expect(ref.parameter).toBeUndefined()
    expect(ref.fullMatch).toBe('[[Shield]]')
  })

  test('should parse parameterized trait references', () => {
    const text = 'This has the [[[Hot] (3)]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = refs[0]!
    expect(ref.traitName).toBe('Hot')
    expect(ref.parameter).toBe('3')
    expect(ref.fullMatch).toBe('[[[Hot] (3)]]')
  })

  test('should parse parameterized trait with variable', () => {
    const text = 'This has the [[[Burn] (X)]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = refs[0]!
    expect(ref.traitName).toBe('Burn')
    expect(ref.parameter).toBe('X')
    expect(ref.fullMatch).toBe('[[[Burn] (X)]]')
  })

  test('should parse multiple trait references', () => {
    const text = 'This has the [[Shield]] Trait and [[[Hot] (3)]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(2)
    expect(refs[0]!.traitName).toBe('Shield')
    expect(refs[0]!.parameter).toBeUndefined()
    expect(refs[1]!.traitName).toBe('Hot')
    expect(refs[1]!.parameter).toBe('3')
  })

  test('should parse hyphenated trait names', () => {
    const text = 'This has the [[Multi-Attack]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    expect(refs[0]!.traitName).toBe('Multi-Attack')
  })

  test('should parse multi-word trait names', () => {
    const text = 'This has the [[The Communicator]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    expect(refs[0]!.traitName).toBe('The Communicator')
  })

  test('should handle real-world example from Vorpal chassis', () => {
    const text =
      'Everytime the Vorpal gains Heat, reduce the amount gained to 1. Treat each source of Heat separately when using this Ability. For example if the Vorpal fires a Blue Mining Laser with the [[[Hot] (3)]] Trait it gains 1 Heat instead of 3. If the Vorpal then chooses to Push it would gain an additional 1 Heat instead of 2 for the Push.'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = refs[0]!
    expect(ref.traitName).toBe('Hot')
    expect(ref.parameter).toBe('3')
    expect(ref.fullMatch).toBe('[[[Hot] (3)]]')
  })

  test('should handle real-world example with multiple traits', () => {
    const text =
      'A superheated lump of scrap is fired at the target. The target is hit for SP damage equal to 2× the Tech Level of the Scrap and this attack has the [[[Explosive] (X)]] and [[[Burn] (X)]] Trait where X is the Tech Level of the Scrap.'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(2)
    expect(refs[0]!.traitName).toBe('Explosive')
    expect(refs[0]!.parameter).toBe('X')
    expect(refs[1]!.traitName).toBe('Burn')
    expect(refs[1]!.parameter).toBe('X')
  })

  test('should return correct start and end indices', () => {
    const text = 'This has the [[Shield]] Trait'
    const refs = parseTraitReferences(text)

    const ref = refs[0]!
    expect(ref.startIndex).toBe(13)
    expect(ref.endIndex).toBe(23)
    expect(text.substring(ref.startIndex, ref.endIndex)).toBe('[[Shield]]')
  })

  test('should handle empty text', () => {
    const refs = parseTraitReferences('')
    expect(refs).toHaveLength(0)
  })

  test('should handle text with no trait references', () => {
    const text = 'This is just plain text with no traits'
    const refs = parseTraitReferences(text)
    expect(refs).toHaveLength(0)
  })

  test('should sort references by start index', () => {
    const text = 'First [[Shield]] then [[[Hot] (3)]] and finally [[Vulnerable]]'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(3)
    expect(refs[0]!.traitName).toBe('Shield')
    expect(refs[1]!.traitName).toBe('Hot')
    expect(refs[2]!.traitName).toBe('Vulnerable')
    expect(refs[0]!.startIndex).toBeLessThan(refs[1]!.startIndex)
    expect(refs[1]!.startIndex).toBeLessThan(refs[2]!.startIndex)
  })
})
