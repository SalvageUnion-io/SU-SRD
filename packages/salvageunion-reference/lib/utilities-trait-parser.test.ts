import { describe, expect, test } from 'bun:test'
import { findEntityBySlug, getDataMaps, nameToSlug } from './index.js'
import { parseTraitReferences, replaceTraitReferences } from './utilities.js'

/** Narrow away null/undefined; throws (failing the test) when the value is missing. */
function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('Expected value to be defined')
  }
  return value
}

describe('parseTraitReferences', () => {
  test('should parse simple trait references', () => {
    const text = 'This has the [[Shield]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = defined(refs[0])
    expect(ref.traitName).toBe('Shield')
    expect(ref.parameter).toBeUndefined()
    expect(ref.fullMatch).toBe('[[Shield]]')
  })

  test('should parse parameterized trait references', () => {
    const text = 'This has the [[[Hot] (3)]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = defined(refs[0])
    expect(ref.traitName).toBe('Hot')
    expect(ref.parameter).toBe('3')
    expect(ref.fullMatch).toBe('[[[Hot] (3)]]')
  })

  test('should parse parameterized trait with variable', () => {
    const text = 'This has the [[[Burn] (X)]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = defined(refs[0])
    expect(ref.traitName).toBe('Burn')
    expect(ref.parameter).toBe('X')
    expect(ref.fullMatch).toBe('[[[Burn] (X)]]')
  })

  test('should parse multiple trait references', () => {
    const text = 'This has the [[Shield]] Trait and [[[Hot] (3)]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(2)
    expect(defined(refs[0]).traitName).toBe('Shield')
    expect(defined(refs[0]).parameter).toBeUndefined()
    expect(defined(refs[1]).traitName).toBe('Hot')
    expect(defined(refs[1]).parameter).toBe('3')
  })

  test('should parse hyphenated trait names', () => {
    const text = 'This has the [[Multi-Attack]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    expect(defined(refs[0]).traitName).toBe('Multi-Attack')
  })

  test('should parse multi-word trait names', () => {
    const text = 'This has the [[The Communicator]] Trait'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    expect(defined(refs[0]).traitName).toBe('The Communicator')
  })

  test('should handle real-world example from Vorpal chassis', () => {
    const text =
      'Everytime the Vorpal gains Heat, reduce the amount gained to 1. Treat each source of Heat separately when using this Ability. For example if the Vorpal fires a Blue Mining Laser with the [[[Hot] (3)]] Trait it gains 1 Heat instead of 3. If the Vorpal then chooses to Push it would gain an additional 1 Heat instead of 2 for the Push.'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(1)
    const ref = defined(refs[0])
    expect(ref.traitName).toBe('Hot')
    expect(ref.parameter).toBe('3')
    expect(ref.fullMatch).toBe('[[[Hot] (3)]]')
  })

  test('should handle real-world example with multiple traits', () => {
    const text =
      'A superheated lump of scrap is fired at the target. The target is hit for SP damage equal to 2× the Tech Level of the Scrap and this attack has the [[[Explosive] (X)]] and [[[Burn] (X)]] Trait where X is the Tech Level of the Scrap.'
    const refs = parseTraitReferences(text)

    expect(refs).toHaveLength(2)
    expect(defined(refs[0]).traitName).toBe('Explosive')
    expect(defined(refs[0]).parameter).toBe('X')
    expect(defined(refs[1]).traitName).toBe('Burn')
    expect(defined(refs[1]).parameter).toBe('X')
  })

  test('should return correct start and end indices', () => {
    const text = 'This has the [[Shield]] Trait'
    const refs = parseTraitReferences(text)

    const ref = defined(refs[0])
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
    expect(defined(refs[0]).traitName).toBe('Shield')
    expect(defined(refs[1]).traitName).toBe('Hot')
    expect(defined(refs[2]).traitName).toBe('Vulnerable')
    expect(defined(refs[0]).startIndex).toBeLessThan(defined(refs[1]).startIndex)
    expect(defined(refs[1]).startIndex).toBeLessThan(defined(refs[2]).startIndex)
  })
})

/**
 * The two bracket patterns were rewritten so each character class excludes its
 * own OPENING delimiter as well as the closing one (`[^\][]` / `[^)(]`). The
 * old classes (`[^\]]` / `[^)]`) let a scan run to end-of-string from every one
 * of many `[[` starts, which is quadratic (CodeQL js/redos).
 *
 * These tests pin (a) that the rewrite still finds exactly what the real
 * dataset contains and (b) that pathological input now terminates promptly.
 */
describe('parseTraitReferences ReDoS hardening', () => {
  /** Every string in the shipped dataset that carries a trait reference. */
  function realTraitStrings(): string[] {
    const { dataMap } = getDataMaps()
    const found: string[] = []
    const walk = (value: unknown): void => {
      if (typeof value === 'string') {
        if (value.includes('[[')) found.push(value)
      } else if (Array.isArray(value)) {
        for (const item of value) walk(item)
      } else if (value && typeof value === 'object') {
        for (const item of Object.values(value)) walk(item)
      }
    }
    walk(dataMap)
    return found
  }

  test('every trait reference in the real dataset parses to a resolvable trait', async () => {
    const strings = realTraitStrings()
    // Guard against the corpus silently emptying and the test passing vacuously.
    expect(strings.length).toBeGreaterThan(50)

    let refCount = 0
    const unresolved = new Set<string>()
    for (const text of strings) {
      const refs = parseTraitReferences(text)
      expect(refs.length, `no refs parsed from: ${text}`).toBeGreaterThan(0)
      for (const ref of refs) {
        refCount++
        // The parsed span must be exactly the text it claims to cover.
        expect(text.slice(ref.startIndex, ref.endIndex)).toBe(ref.fullMatch)
        if (!findEntityBySlug('traits', nameToSlug(ref.traitName))) {
          unresolved.add(ref.traitName)
        }
      }
    }
    expect(refCount).toBeGreaterThan(50)
    // Nearly every reference names a real trait. The two exceptions are
    // authored placeholders, not parser failures: `[[CHASSIS]]` is a chassis-name
    // token and "Personality" is prose. Pinning the exact set means a parser
    // change that starts dropping or mangling real trait names fails here.
    expect([...unresolved].sort()).toEqual(['CHASSIS', 'Personality'])
  })

  test('a parameterized reference is not double-reported as a simple one', () => {
    // The two passes overlap by construction; the dedupe is what keeps
    // `[[[Hot] (3)]]` from also matching the simple pattern.
    const refs = parseTraitReferences('[[[Hot] (3)]]')
    expect(refs).toHaveLength(1)
    expect(defined(refs[0]).parameter).toBe('3')
  })

  test('completes on a long run of opening brackets', () => {
    // 50k `[` with no closer: under the old `[^\]]+` class each `[[` start
    // scanned to end-of-string before failing — quadratic. Bounded scans now.
    const pathological = '['.repeat(50_000)
    const start = performance.now()
    expect(parseTraitReferences(pathological)).toHaveLength(0)
    expect(performance.now() - start).toBeLessThan(1000)
  })

  test('completes on a long unterminated parameterized reference', () => {
    // Exercises the `[^)(]+` param class: an unclosed `(` used to scan to the
    // end from every candidate start.
    const pathological = `${'[[['.repeat(10_000)}Hot] (${'3'.repeat(20_000)}`
    const start = performance.now()
    expect(parseTraitReferences(pathological)).toHaveLength(0)
    expect(performance.now() - start).toBeLessThan(1000)
  })

  test('completes on a long word-shaped name run', () => {
    // The old inline word-shape `[A-Z][A-Za-z-]+(?:\s+[A-Z][A-Za-z-]+)*` nested
    // a quantifier in a quantifier; `isTraitName` replaced it with a linear scan.
    const pathological = `[[[${'Aa '.repeat(20_000)}`
    const start = performance.now()
    expect(parseTraitReferences(pathological)).toHaveLength(0)
    expect(performance.now() - start).toBeLessThan(1000)
  })
})

/**
 * The `[[Trait]]` grammar had THREE implementations — this parser,
 * component-lib's `parseTraitReferences`, and the Discord bot's inline
 * `TRAIT_REF` — and this one was the strictest: it alone required whitespace
 * between `]` and `(`. Nothing in the authoring pipeline enforces that space,
 * so `[[[Melee](2)]]` yielded ZERO references here while both renderers
 * resolved the trait. No shipped record uses the space-less form, which is
 * exactly why it went unnoticed.
 */
describe('parseTraitReferences separator tolerance', () => {
  test('parses a parameterized reference with no space before the parameter', () => {
    const refs = parseTraitReferences('Deals [[[Melee](2)]] damage')

    expect(refs).toHaveLength(1)
    const ref = defined(refs[0])
    expect(ref.traitName).toBe('Melee')
    expect(ref.parameter).toBe('2')
    expect(ref.fullMatch).toBe('[[[Melee](2)]]')
  })

  test('still parses the spaced form the dataset actually uses', () => {
    const refs = parseTraitReferences('Deals [[[Melee] (2)]] damage')

    expect(refs).toHaveLength(1)
    expect(defined(refs[0]).parameter).toBe('2')
  })
})

describe('replaceTraitReferences', () => {
  test('rewrites both bracket forms and leaves surrounding prose intact', () => {
    const out = replaceTraitReferences('Has [[Shield]] and deals [[[Hot] (3)]] damage.', (ref) =>
      ref.parameter ? `<${ref.traitName}:${ref.parameter}>` : `<${ref.traitName}>`
    )

    expect(out).toBe('Has <Shield> and deals <Hot:3> damage.')
  })

  test('returns the input unchanged when there is nothing to replace', () => {
    expect(replaceTraitReferences('plain rules text', () => 'X')).toBe('plain rules text')
  })

  test('covers exactly the spans parseTraitReferences reports', () => {
    // The substitution and the position-aware parse must agree — they are the
    // two shapes of one grammar, not two grammars.
    const text = 'A [[One]] B [[[Two] (2)]] C [[Three]]'
    const spans = parseTraitReferences(text).map((ref) => ref.fullMatch)
    const collected: string[] = []
    replaceTraitReferences(text, (ref) => {
      collected.push(ref.fullMatch)
      return ''
    })

    expect(collected).toEqual(spans)
    expect(replaceTraitReferences(text, () => '')).toBe('A  B  C ')
  })
})
