import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseSync } from 'oxc-parser'
import {
  controlLaws,
  iconSizeFindings,
  lucideNames,
  ONE_ON_OFF,
  switchingFindings,
} from '../rules/controls'
import { glyphFindings } from '../rules/copyTerms'
import { loneSignFindings } from '../rules/loneSign'

/**
 * The `controls` rule set (hard rules R23, R29) and the copy set's `glyph`
 * rule (R23), against fixtures: what counts as a lucide glyph, what names its
 * Size, and which characters stand in for an icon.
 */

const lines = (findings: { line: number }[]) => findings.map((f) => f.line)

describe('icon-size', () => {
  test('a lucide glyph names an iconSize, and nothing else sizes or strokes it', () => {
    const source = [
      "import { ChevronDown, X } from 'lucide-react'",
      "import { iconSize, tokens } from './tokens'",
      'export const A = () => <X size={iconSize.mini} />',
      'export const B = () => <X size={tokens.iconSize[size]} />',
      'export const C = () => <X size={14} />',
      'export const D = () => <X />',
      'export const E = () => <ChevronDown size={iconSize.full} strokeWidth={3} />',
      'export const F = () => <ChevronDown size={iconSize.full} style={{ width: 20 }} width={20} />',
      'export const G = () => <Other size={14} />',
    ].join('\n')
    expect(lines(iconSizeFindings('a.tsx', source))).toEqual([5, 6, 7, 8])
  })

  test('a local bound to a glyph is one, through a lookup; a component that draws one is not', () => {
    const source = [
      "import { Bot, UserRound } from 'lucide-react'",
      'const GLYPHS = { pilot: UserRound, mech: Bot }',
      'export function A({ kind, open }) {',
      '  const Glyph = GLYPHS[kind]',
      '  const Chevron = open ? Bot : UserRound',
      '  return <><Glyph /><Chevron size={12} /></>',
      '}',
      'const Drawn = () => <Bot size={iconSize.mini} />',
      'export const B = () => <Drawn />',
    ].join('\n')
    expect([...lucideNames(parseSync('a.tsx', source).program)].sort()).toEqual([
      'Bot',
      'Chevron',
      'GLYPHS',
      'Glyph',
      'UserRound',
    ])
    expect(iconSizeFindings('a.tsx', source).map((f) => f.detail)).toEqual([
      '<Glyph> names no Size: pass size={iconSize.…}',
      '<Chevron size={12}>: not an `iconSize`',
    ])
  })

  test('a type-only import draws nothing', () => {
    const source =
      "import type { LucideIcon } from 'lucide-react'\nexport const A = (I: LucideIcon) => <I />"
    expect(iconSizeFindings('a.tsx', source)).toEqual([])
  })
})

describe('copy glyph', () => {
  test('an arrow as back is banned in any copy; a text ⋯ only where JSX draws it', () => {
    const source = [
      'export const A = () => <a>&larr; Back</a>',
      'export const B = () => <a>‹ Back</a>',
      "export const label = '← Load'",
      'export const C = () => <button>⋯</button>',
      'export const D = () => <Menu trigger="⋯" />',
      "export const note = 'the ⋯ menu'",
      '// a comment may say ← and ⋯',
      "export const E = () => <a>{'Next: Stats'}</a>",
    ].join('\n')
    expect(lines(glyphFindings('a.tsx', source))).toEqual([1, 2, 3, 4, 5])
  })
  test('a forward arrow is banned where JSX draws it as text; a value change in a string is not', () => {
    const source = [
      'export const A = () => <a>Advance ›</a>',
      'export const B = () => <a>Next &rsaquo;</a>',
      "export const C = () => <b>{last ? 'End' : 'Next step ›'}</b>",
      "export const D = () => <b>{open && 'Live Sheet →'}</b>",
      'export const E = () => <i>{before} → {after}</i>',
      // `@{` stands in for a template's placeholder, so the fixture stays a plain string.
      "export const F = () => <b aria-label={`HP @{a} → @{b}`} title={'6 → 4'} />",
      'export const what = `@{name} · HP → @{after}`',
      'export const G = () => <b>{`@{a} → @{b}`}</b>',
    ]
      .join('\n')
      .replaceAll('@{', '$' + '{')
    expect(lines(glyphFindings('a.tsx', source))).toEqual([1, 2, 3, 4, 5])
  })
  test('imports, console and bookQuote calls are no copy; a template chunk is', () => {
    const source = [
      "import { back } from './←'",
      "console.warn('← old')",
      "export const quote = bookQuote('← the book')",
      'export const tip = `‹ back`',
    ].join('\n')
    expect(lines(glyphFindings('a.tsx', source))).toEqual([4])
  })
  test('a Button whose whole text is a sign is a hand-built stepper (R12)', () => {
    const source = [
      'export const A = () => <Button onClick={f}>−</Button>',
      'export const B = () => <button type="button">\n  +\n</button>',
      "export const C = () => <Button>{'-'}</Button>",
      'export const D = () => <Button>&minus;</Button>',
      'export const E = () => <Button>+ Scrap</Button>',
      'export const F = () => <StepButton aria-label="Increase HP">+</StepButton>',
      'export const G = () => <span>−</span>',
      'export const H = () => <Button><Plus size={iconSize.mini} /></Button>',
    ].join('\n')
    expect(lines(loneSignFindings('a.tsx', source))).toEqual([1, 2, 5, 6])
  })
})

describe('tab-role and pressed', () => {
  const source = [
    'export const A = () => <div role="tablist"><b role="tab" /></div>',
    "export const B = () => <div role={'tab'} />",
    'export const C = () => <div role="group" />',
    'export const D = ({ on }) => <button aria-pressed={on} />',
    "export const props = { 'aria-pressed': true }",
    '// a comment naming role="tablist" and aria-pressed',
  ].join('\n')

  test('a tab role outside Tabs and aria-pressed outside Segmented and Toggle are findings', () => {
    const found = switchingFindings('apps/web/src/x/Row.tsx', source)
    expect(lines(found['tab-role'])).toEqual([1, 1, 2])
    expect(lines(found.pressed)).toEqual([4, 5])
  })

  test('each role is at home in its own atom, and ONE_ON_OFF names its owner', () => {
    const tabs = switchingFindings('apps/web/src/components/atoms/Tabs.tsx', source)
    expect(tabs['tab-role']).toEqual([])
    expect(switchingFindings('apps/web/src/components/atoms/Toggle.tsx', source).pressed).toEqual(
      []
    )
    for (const [file, why] of Object.entries(ONE_ON_OFF)) {
      expect(switchingFindings(file, source).pressed).toEqual([])
      expect(why).toMatch(/\(R\d+\)$/)
    }
  })
})

describe('controls scan', () => {
  const temps: string[] = []
  afterAll(() => {
    for (const t of temps) rmSync(t, { recursive: true, force: true })
  })
  /** A tree holding `files` (path from the repo root → text). */
  const tree = (files: Record<string, string>) => {
    const root = mkdtempSync(join(tmpdir(), 'controls-'))
    temps.push(root)
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      writeFileSync(join(root, rel), text)
    }
    return root
  }
  const glyph = "import { X } from 'lucide-react'\nexport const A = () => <X size={14} />\n"
  const pressed = 'export const B = ({ on }) => <button aria-pressed={on} />\n'

  test('reads the app source a glyph is drawn in, and skips tests', () => {
    const root = tree({
      'apps/web/src/a/Close.tsx': glyph,
      'apps/web/src/a/Plain.tsx': 'export const P = () => <b size={14} />\n',
      'apps/web/src/a/__tests__/Close.tsx': glyph,
      'apps/web/src/a/Close.test.tsx': glyph,
    })
    expect(controlLaws.scan(root)['icon-size']?.map((f) => [f.file, f.line])).toEqual([
      ['apps/web/src/a/Close.tsx', 2],
    ])
  })

  test('a switching role outside its home is found across the tree, tests aside', () => {
    const root = tree({
      'apps/web/src/a/Row.tsx': `export const T = () => <div role="tablist" />\n${pressed}`,
      'apps/web/src/a/Row.test.tsx': pressed,
    })
    const found = controlLaws.scan(root)
    expect(found['tab-role']?.map((f) => [f.file, f.line])).toEqual([['apps/web/src/a/Row.tsx', 1]])
    expect(
      found.pressed?.filter((f) => f.file === 'apps/web/src/a/Row.tsx').map((f) => f.line)
    ).toEqual([2])
  })

  test('a ONE_ON_OFF entry whose file sets no aria-pressed, or is gone, is stale', () => {
    // The kept entry is a component (its JSX `aria-pressed`), the emptied one any other.
    const files = Object.keys(ONE_ON_OFF)
    const kept = files.find((file) => file.endsWith('.tsx')) as string
    const emptied = files.find((file) => file !== kept) as string
    const root = tree({ [kept]: pressed, [emptied]: 'export const C = () => <button />\n' })
    const stale = controlLaws
      .scan(root)
      .pressed?.filter((f) => f.detail.startsWith('a stale ONE_ON_OFF entry'))
      .map((f) => f.file)
    expect(stale).toEqual(Object.keys(ONE_ON_OFF).filter((file) => file !== kept))
  })
})
