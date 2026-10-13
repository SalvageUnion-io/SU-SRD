import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  BANNED,
  CAPITALISED_SHARE,
  capitalisedTerms,
  copyTerms,
  DATA_DIR,
  extractCopy,
  lintCopy,
  MIN_USES,
  PRODUCT_FILE,
  productBans,
  productNames,
  termPattern,
  weighTerms,
} from '../rules/copyTerms'

/**
 * `tools/check-copy.ts` ratchets lower-case game terms and banned spellings in
 * shipped copy. These pin what the extractor reads as copy, how the term list
 * is weighed from the dataset, and what each rule flags, against fixtures.
 */

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'copy-'))
  roots.push(root)
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

const texts = (file: string, source: string) => extractCopy(file, source).map((c) => c.text)

describe('extractCopy', () => {
  test('reads JSX text, copy attributes and prose string literals', () => {
    const src = [
      "import x from 'some mech module'",
      'export const A = () => (',
      '  <p aria-label="Assign a mech" className="su mech card">',
      '    Your mech',
      '  </p>',
      ')',
      "const note = 'A pilot flies one mech'",
      "const key = 'mech'",
      `const tpl = \`Build a \${x} mech now\``,
    ].join('\n')
    expect(texts('a.tsx', src)).toEqual([
      'Assign a mech',
      'Your mech',
      'A pilot flies one mech',
      'Build a',
      'mech now',
    ])
  })

  test('skips book quotes, console lines and schema descriptions', () => {
    const src = [
      "const q = bookQuote({ source: 'Salvage Union Workshop Manual', page: 3 }, 'the mech moves')",
      "console.error('[itun] a mech failed')",
      "const s = z.string().describe('Mech module names')",
      "const keep = 'a real pilot sentence'",
    ].join('\n')
    expect(texts('a.ts', src)).toEqual(['a real pilot sentence'])
  })

  test('reports the line each string starts on', () => {
    const [c] = extractCopy('a.ts', "\n\nconst a = 'two words'")
    expect(c?.line).toBe(3)
  })
})

describe('termPattern', () => {
  test('matches a word and its plural, any casing, and never a slug, path or host', () => {
    const re = termPattern('mech')
    const hits = (s: string) => [...s.matchAll(re)].map((m) => m[0])
    expect(hits("Mechs and a mech's MECH")).toEqual(['Mechs', 'mech', 'MECH'])
    expect(hits('su-mech-card /schema/mech/ mech.salvageunion.io')).toEqual([])
  })
})

describe('the term list', () => {
  const data = (keywords: string[], prose: string) =>
    fixture({
      [`${DATA_DIR}/keywords.json`]: JSON.stringify(keywords.map((name) => ({ name }))),
      [`${DATA_DIR}/systems.json`]: JSON.stringify([{ name: 'mech mech', description: prose }]),
    })

  test('keeps a keyword the dataset capitalises, drops one it writes as plain English', () => {
    const prose = `${'The Mech and a Pilot can move. '.repeat(MIN_USES)} a pilot`
    const root = data(['mech', 'pilot', 'move', 'difficult terrain (False Flag)'], prose)
    const uses = weighTerms(root)
    expect(uses.find((u) => u.term === 'mech')).toEqual({
      term: 'mech',
      capitalised: MIN_USES,
      lower: 0,
    })
    expect(uses.map((u) => u.term)).toContain('difficult terrain')
    expect(capitalisedTerms(uses)).toEqual(['mech', 'pilot'])
  })

  test('needs both the share and the sample size', () => {
    const n = MIN_USES * 10
    const lower = Math.ceil(n * (1 - CAPITALISED_SHARE)) + 1
    expect(
      capitalisedTerms([
        { term: 'often', capitalised: n - lower, lower },
        { term: 'rare', capitalised: MIN_USES - 1, lower: 0 },
        { term: 'kept', capitalised: MIN_USES, lower: 0 },
      ])
    ).toEqual(['kept'])
  })
})

describe('lintCopy', () => {
  const at = (text: string) => [{ file: 'a.tsx', line: 1, text }]

  test('flags a term with any lower-case word, once per span, longest term first', () => {
    const r = lintCopy(
      at('A Mech, a mech, Hit points, MECHS and weapons system'),
      ['mech', 'hit points', 'system', 'weapons system'],
      []
    )
    expect(r['lowercase-term']?.map((f) => f.detail)).toEqual([
      '"weapons system": say Weapons System',
      '"Hit points": say Hit Points',
      '"mech": say Mech',
    ])
  })

  test('bans TL and Heat Cap in prose, but not the bare sheet label', () => {
    const r = lintCopy(
      [...at('Not enough TL 3 scrap'), ...at('exceeds its Heat Cap'), ...at('Heat Cap')],
      [],
      BANNED
    )
    expect(r['banned-variant']?.map((f) => f.detail.split(':')[0])).toEqual([
      '"TL 3"',
      '"Heat Cap"',
    ])
    expect(lintCopy(at('Tech 3 and Heat Capacity'), [], BANNED)['banned-variant']).toEqual([])
  })

  test('bans every other casing of the product names, but not a log tag', () => {
    const bans = productBans({ name: 'In the Union now', shortName: 'ITUN' })
    const r = lintCopy(
      at('Open In The Union Now or Itun, not In the Union now, ITUN or [itun]'),
      [],
      bans
    )
    expect(r['banned-variant']?.map((f) => f.detail.split(':')[0])).toEqual([
      '"In The Union Now"',
      '"Itun"',
    ])
  })
})

describe('the rule set', () => {
  test('reads the product names from component-lib, not a copy of them', () => {
    const root = fixture({
      [PRODUCT_FILE]: "export const PRODUCT = { name: 'Some Name', shortName: 'SN' } as const",
    })
    expect(productNames(root)).toEqual({ name: 'Some Name', shortName: 'SN' })
    expect(() => productNames(fixture({ [PRODUCT_FILE]: 'export {}' }))).toThrow(PRODUCT_FILE)
  })

  test('scans a fixture tree end to end', () => {
    const root = fixture({
      [`${DATA_DIR}/keywords.json`]: JSON.stringify([{ name: 'mech' }]),
      [`${DATA_DIR}/chassis.json`]: JSON.stringify([{ text: 'The Mech '.repeat(MIN_USES) }]),
      [PRODUCT_FILE]: "export const PRODUCT = { name: 'In the Union now', shortName: 'ITUN' }",
      'apps/itun/src/A.tsx': 'export const A = () => <p>Build a mech in Itun</p>',
      'apps/itun/src/__tests__/A.test.tsx': 'export const B = () => <p>a mech</p>',
      'apps/srd/src/B.stories.tsx': 'export const C = () => <p>a mech</p>',
    })
    const r = copyTerms.scan(root)
    expect(r['lowercase-term']?.map((f) => f.file)).toEqual(['apps/itun/src/A.tsx'])
    expect(r['banned-variant']).toHaveLength(1)
    expect(copyTerms.summary?.(root)).toBe(
      // product.ts is shipped copy too
      '2 copy strings in 2 files, 1 terms from keywords.json'
    )
  })
})
