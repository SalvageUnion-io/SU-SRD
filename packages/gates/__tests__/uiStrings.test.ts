import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCopyAttr, lintUiStrings, uiStringFindings } from '../rules/uiStrings'
import { EXEMPTIONS } from '../rules/uiStringsExemptions'

/**
 * `tools/check-rule-sets.ts` (the `copy` check) refuses UI strings typed at
 * the call site and holds the message catalogue's shape (ADR-054). These pin
 * what counts as a UI string and what the catalogue rule refuses.
 */

const found = (file: string, source: string) =>
  uiStringFindings(file, source).hardCoded.map((f) => f.detail)

describe('isCopyAttr', () => {
  test('reads label-like names, alone or as a suffix', () => {
    for (const name of ['label', 'title', 'aria-label', 'confirmLabel', 'emptyMessage', 'alt']) {
      expect(isCopyAttr(name)).toBe(true)
    }
  })

  test('leaves names that merely end in the letters', () => {
    for (const name of ['context', 'bodyClassName', 'titleAs', 'variant', 'salt']) {
      expect(isCopyAttr(name)).toBe(false)
    }
  })
})

describe('uiStringFindings', () => {
  test('counts JSX text, word-carrying attributes and drawn strings', () => {
    const src = [
      'export const A = ({ open }) => (',
      '  <Button label="Pilot" variant="flush" title="Open the sheet" className="su-a b">',
      "    {open ? 'Hide' : 'Show'}",
      '    Your crew',
      '  </Button>',
      ')',
    ].join('\n')
    expect(found('a.tsx', src)).toEqual([
      '"Pilot"',
      '"Open the sheet"',
      '"Hide"',
      '"Show"',
      '"Your crew"',
    ])
  })

  test('counts prose anywhere, but not imports, types, keys, errors or logs', () => {
    const src = [
      "import x from 'some two words'",
      "type T = 'two words'",
      "const o = { 'two words': 1, note: 'This sheet is read-only.' }",
      "throw new Error('a dev message')",
      "console.log('a dev message')",
      "const one = 'mech'",
    ].join('\n')
    expect(found('a.ts', src)).toEqual(['"This sheet is read-only."'])
  })

  test('a key said to the catalogue is not a UI string', () => {
    const src = [
      "import { sheetCopy } from '../messages/build-sheet'",
      "export const A = () => <p title={sheetCopy('payUpkeep')}>{sheetCopy('done')}</p>",
    ].join('\n')
    expect(found('a.tsx', src)).toEqual([])
  })

  test('a computed key is refused, a conditional between literals is not', () => {
    const src = [
      "import { sheetCopy } from '../messages/build-sheet'",
      "const a = sheetCopy(open ? 'hide' : 'show')",
      'const b = sheetCopy(key)',
    ].join('\n')
    const { computedKeys } = uiStringFindings('a.ts', src)
    expect(computedKeys.map((f) => f.line)).toEqual([3])
  })
})

describe('lintUiStrings', () => {
  const catalogue = [
    "import { messages } from './define'",
    'export const sheetCopy = messages({',
    "  done: 'Done',",
    "  unsaid: 'Nobody says this',",
    '})',
  ].join('\n')

  test('a key nothing says is a finding; a said one is not', () => {
    const sources = new Map([
      ['apps/web/src/messages/build-sheet.ts', catalogue],
      [
        'apps/web/src/build/sheet/A.tsx',
        "import { sheetCopy } from '../../messages/build-sheet'\nexport const A = () => sheetCopy('done')",
      ],
    ])
    const result = lintUiStrings(sources)
    expect(result.catalogue?.map((f) => f.detail)).toEqual([
      "sheetCopy('unsaid') is said nowhere: delete it",
    ])
    expect(result['hard-coded']).toEqual([])
  })

  test('messages() outside the catalogue and a clashing name are findings', () => {
    const sources = new Map([
      ['apps/web/src/messages/a.ts', catalogue],
      ['apps/web/src/messages/b.ts', catalogue],
      ['apps/web/src/build/Own.ts', "import { messages } from '../messages/define'\n"],
    ])
    const details = lintUiStrings(sources).catalogue?.map((f) => f.detail) ?? []
    expect(details.some((d) => d.includes('also exported by apps/web/src/messages/a.ts'))).toBe(
      true
    )
    expect(details.some((d) => d.startsWith('messages(…) outside'))).toBe(true)
  })
})

describe('EXEMPTIONS', () => {
  const [first] = EXEMPTIONS
  if (!first) throw new Error('no exemption to test')
  const [exempt] = first.strings
  if (exempt === undefined) throw new Error('an exemption with no string')

  test('waives the one string in the one file, and nothing else there', () => {
    const src = `const a = ${JSON.stringify(exempt)}\nconst b = 'This sheet is read-only.'`
    expect(found(first.file, src)).toEqual(['"This sheet is read-only."'])
    expect(found('apps/web/src/elsewhere.ts', src)).toHaveLength(2)
  })

  test('every exemption says why, and names strings its file still holds', () => {
    const root = join(import.meta.dir, '../../..')
    const files = EXEMPTIONS.map((e) => e.file)
    expect(new Set(files).size).toBe(files.length)
    for (const e of EXEMPTIONS) {
      expect(e.reason.length).toBeGreaterThan(20)
      expect(e.strings.length).toBeGreaterThan(0)
      expect(existsSync(join(root, e.file))).toBe(true)
      // White space collapsed, as the rule reads a string that runs over lines.
      const source = readFileSync(join(root, e.file), 'utf8').replace(/\s+/g, ' ')
      for (const s of e.strings) expect(source).toContain(s)
    }
  })
})
