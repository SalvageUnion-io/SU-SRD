import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { bareAppLinkFindings, fontSizeFindings, hierarchy } from '../rules/hierarchy'

/**
 * The hierarchy rule set (ruleset §4.8, hard rule R54,
 * `packages/gates/rules/hierarchy.ts`): each rule against the form it forbids
 * and the forms it lets through.
 */

const lines = (found: { line: number }[]) => found.map((f) => f.line)

describe('hierarchy rule set', () => {
  test('both rules are ratchets', () => {
    expect(hierarchy.id).toBe('hierarchy')
    expect(hierarchy.rules.map((r) => [r.id, r.mode])).toEqual([
      ['font-size-rung', 'ratchet'],
      ['bare-applink', 'ratchet'],
    ])
  })

  test('the scan reads the repo', () => {
    const found = hierarchy.scan(join(import.meta.dir, '../../..'))
    expect(Object.keys(found)).toEqual(['font-size-rung', 'bare-applink'])
  })
})

describe('hierarchy/font-size-rung', () => {
  const FILE = 'apps/web/src/build/X.tsx'

  test('a retired token or a literal fails in a script', () => {
    const source = [
      'const A = { fontSize: fontSize.sm }',
      "const B = { fontSize: fontSize['2xl'] }",
      "const C = { fontSize: '17px' }",
      "const D = { fontSize: 'var(--text-xs)' }",
      'const E = { fontSize: fontSize.caption }',
      "const F = { fontSize: 'var(--text-title)' }",
      '// fontSize.sm in a comment',
    ].join('\n')
    expect(lines(fontSizeFindings(FILE, source))).toEqual([1, 2, 3, 4])
  })

  test('a retired var or a literal fails in a stylesheet', () => {
    const source = [
      '.a { font-size: var(--text-sm); }',
      '.b { font-size: 18px; }',
      '.c { font-size: var(--text-lede); }',
      '.d { font-size: inherit; }',
    ].join('\n')
    expect(lines(fontSizeFindings('apps/web/src/styles/partials/x.css', source))).toEqual([1, 2])
  })

  test("the ladder's home and the link preview set their own sizes", () => {
    const source = '.a { font-size: 34px; }'
    expect(fontSizeFindings('apps/web/src/styles/theme.css', source)).toEqual([])
    expect(
      fontSizeFindings('apps/web/src/components/compositions/OgCard.tsx', "{ fontSize: '34px' }")
    ).toEqual([])
  })
})

describe('hierarchy/bare-applink', () => {
  const FILE = 'apps/web/src/play/X.tsx'

  test('an AppLink of plain words fails', () => {
    const source = [
      'export const A = () => (',
      '  <div>',
      '    <AppLink href="/">Training Bay</AppLink>',
      '    <AppLink href="/">{copy("go")}</AppLink>',
      '  </div>',
      ')',
    ].join('\n')
    expect(lines(bareAppLinkFindings(FILE, source))).toEqual([3, 4])
  })

  test('an AppLink that wraps a card or row passes', () => {
    const source = [
      'export const A = () => (',
      '  <AppLink href="/">',
      '    <Card />',
      '  </AppLink>',
      ')',
    ].join('\n')
    expect(bareAppLinkFindings(FILE, source)).toEqual([])
    expect(bareAppLinkFindings(FILE, 'const x = 1')).toEqual([])
  })
})
