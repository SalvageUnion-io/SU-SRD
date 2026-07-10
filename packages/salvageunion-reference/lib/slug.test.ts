import { describe, expect, it } from 'bun:test'
import { nameToSlug } from './slug.js'

/**
 * Regression coverage for CodeQL alert js/polynomial-redos on `nameToSlug`.
 * The original trailing-hyphen trim (`/^-+|-+$/g`) had a quantifier directly
 * before an anchor with nothing after it to guarantee the match — the
 * classic O(n^2) backtracking shape. The fix collapses whitespace/hyphen runs
 * to a single hyphen first, guaranteeing at most one boundary hyphen remains,
 * then trims with a non-quantified `/^-|-$/g`. These tests pin the exact
 * output contract (so the fix can't silently change behavior) and exercise
 * the quadratic-trigger shape to confirm it now resolves in linear time.
 */
describe('nameToSlug', () => {
  it('lowercases and slugifies a normal name', () => {
    expect(nameToSlug('Iron Mongrel')).toBe('iron-mongrel')
  })

  it('strips special characters not in word/space/hyphen classes', () => {
    expect(nameToSlug("Rebar's Reckoning (Mk. II)!")).toBe('rebars-reckoning-mk-ii')
  })

  it('collapses multiple consecutive spaces into a single hyphen', () => {
    expect(nameToSlug('Multi   Space   Name')).toBe('multi-space-name')
  })

  it('collapses multiple consecutive hyphens into a single hyphen', () => {
    expect(nameToSlug('Already--Hyphenated---Name')).toBe('already-hyphenated-name')
  })

  it('collapses mixed runs of whitespace and hyphens into a single hyphen', () => {
    expect(nameToSlug('Mixed - -  Run')).toBe('mixed-run')
  })

  it('removes leading and trailing hyphens', () => {
    expect(nameToSlug('-Leading and Trailing-')).toBe('leading-and-trailing')
  })

  it('removes leading/trailing whitespace that becomes leading/trailing hyphens', () => {
    expect(nameToSlug('  Padded Name  ')).toBe('padded-name')
  })

  it('handles a name that is only hyphens/whitespace by returning an empty string', () => {
    expect(nameToSlug('   ---   ')).toBe('')
  })

  it('handles a single-hyphen input', () => {
    expect(nameToSlug('-')).toBe('')
  })

  it('returns an empty string for empty input', () => {
    expect(nameToSlug('')).toBe('')
  })

  it('is idempotent on an already-valid slug', () => {
    const slug = nameToSlug('Improvised Explosive Device (Flint Children Squad)')
    expect(nameToSlug(slug)).toBe(slug)
  })

  it('preserves underscores and digits as word characters', () => {
    expect(nameToSlug('Unit_42 Type-A')).toBe('unit_42-type-a')
  })

  it('handles the longest real entity name in the dataset unchanged by the length cap', () => {
    expect(nameToSlug('Improvised Explosive Device (Flint Children Squad)')).toBe(
      'improvised-explosive-device-flint-children-squad'
    )
  })

  it('truncates pathologically long input rather than processing it unbounded', () => {
    const longName = 'A'.repeat(10_000)
    const result = nameToSlug(longName)
    // Truncated to the defensive cap, then fully lowercased with no hyphens
    // (a single run of word characters has nothing for the separator/trim
    // regexes to act on).
    expect(result).toBe('a'.repeat(256))
    expect(result.length).toBe(256)
  })

  it('resolves the classic quadratic-backtracking trigger shape quickly and correctly', () => {
    // "a" + "-".repeat(n) + "a" is the textbook input that forces an O(n^2)
    // retry-at-every-start-position search against a trailing `-+$` pattern.
    // Going through the public API, the 256-char cap alone would make this
    // fast regardless of the regex shape, so this only pins the *correct*
    // end-to-end output for a pathological input (the capped prefix collapses
    // to a single hyphen run, trimmed to the leading 'a').
    const n = 100_000
    const input = `a${'-'.repeat(n)}a`
    expect(nameToSlug(input)).toBe('a')
  })

  it('the trim regex itself is linear, independent of the length cap', () => {
    // This isolates the actual CodeQL js/polynomial-redos fix: the old
    // trailing-trim pattern `/^-+|-+$/g` had a quantifier directly before an
    // anchor with nothing after it, the classic O(n^2) backtracking shape on
    // "a" + "-".repeat(n) + "a". The new pattern in slug.ts, `/^-|-$/g`, has
    // no quantifier at all, so it's linear regardless of input size — proven
    // here directly against the pattern (bypassing nameToSlug's length cap,
    // which is defense-in-depth, not the mechanism that fixes the ReDoS).
    // Keep this pattern literal in sync with the trim step in `nameToSlug`.
    const trimPattern = /^-|-$/g
    const n = 2_000_000
    const input = `a${'-'.repeat(n)}a`

    const start = performance.now()
    const result = input.replace(trimPattern, '')
    const elapsed = performance.now() - start

    // Neither alternative matches: the string starts and ends with 'a', not
    // '-', so this is a genuine no-op — the adversarial part is entirely in
    // how much backtracking work the engine does to conclude that, not in
    // the output.
    expect(result).toBe(input)
    expect(elapsed).toBeLessThan(500)
  })
})
