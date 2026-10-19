import { describe, expect, test } from 'bun:test'
import { parseSync } from 'oxc-parser'
import { iconSizeFindings, lucideNames } from '../rules/controls'
import { glyphFindings } from '../rules/copyTerms'

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
      'export const E = () => <a>Advance ›</a>',
    ].join('\n')
    expect(lines(glyphFindings('a.tsx', source))).toEqual([1, 2, 3, 4, 5])
  })
})
