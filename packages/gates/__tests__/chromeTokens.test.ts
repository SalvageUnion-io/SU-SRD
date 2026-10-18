import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ratchetCounts } from '../lib/ruleEngine'
import { chromeTokens, enclosingObject, parseCss, scanChromeSources } from '../rules/chromeTokens'
import { Exited, trapExit } from './trapExit'

/**
 * The chrome-token laws (`packages/gates/rules/chromeTokens.ts`): each rule
 * against the form it forbids and the forms it must let through, so a rule
 * that silently stops matching fails here rather than going green on the repo.
 */

const scan = (rel: string, text: string) => scanChromeSources(new Map([[rel, text]]))
const lines = (found: ReturnType<typeof scan>, id: string) => found[id]?.map((f) => f.line)

describe('chrome tokens rule set', () => {
  test('shares the tokens id, and every rule is zero', () => {
    expect(chromeTokens.id).toBe('tokens')
    expect(chromeTokens.rules.filter((r) => r.mode !== 'zero').map((r) => r.id)).toEqual([])
    expect(ratchetCounts(chromeTokens, {})).toEqual({})
  })
})

describe('parseCss', () => {
  test('a declaration knows its enclosing blocks, line and siblings', () => {
    const { decls, blocks } = parseCss(
      [
        '/* a { comment; } */',
        '@media (width >= 40rem) {',
        '  .a,',
        '  .b {',
        "    content: 'x;y';",
        '    color: red;',
        '  }',
        '}',
      ].join('\n')
    )
    expect(blocks.map((b) => [b.line, b.header])).toEqual([
      [2, '@media (width >= 40rem)'],
      [3, '.a, .b'],
    ])
    expect(decls.map((d) => [d.line, d.prop, d.context])).toEqual([
      [5, 'content', ['@media (width >= 40rem)', '.a, .b']],
      [6, 'color', ['@media (width >= 40rem)', '.a, .b']],
    ])
    expect(decls[0]?.siblings.length).toBe(2)
  })

  test('enclosingObject returns the braces around an offset', () => {
    const text = 'const A = { x: 1, y: { z: 2 } }\nconst B = { w: 3 }'
    expect(enclosingObject(text, text.indexOf('x'))).toBe('{ x: 1, y: { z: 2 } }')
    expect(enclosingObject(text, text.indexOf('w'))).toBe('{ w: 3 }')
  })
})

describe('tokens/left-rail', () => {
  test('a left or inline-start border with a width fails, in CSS and a style object', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { border-left: 3px solid var(--color-pilot); }',
        '.b { border-inline-start: var(--bw-chrome) solid; }',
        '.c { border-left-width: 2px; border: 1px solid; }',
      ].join('\n')
    )
    expect(lines(css, 'left-rail')).toEqual([1, 2, 3])
    const tsx = scan(
      'apps/web/src/X.tsx',
      "const A = { borderLeft: '3px solid red', padding: 4 }\nconst B = { borderInlineStartWidth: borderWidth.pill }"
    )
    expect(lines(tsx, 'left-rail')).toEqual([1, 2])
  })

  test('no width, a frame and a divider between siblings pass', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { border-left: 0; border-left-width: 0; border-left-color: red; }',
        '.b { border-left: 1px solid red; border-right: 1px solid blue; }',
        '.c + .c { border-left: 1px solid; }',
        '.d > * ~ .e, .f + .f { border-left: 1px solid; }',
        '/* .g { border-left: 3px solid; } */',
      ].join('\n')
    )
    expect(css['left-rail']).toEqual([])
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        'const FRAME = {',
        '  borderLeftWidth: frameWidth,',
        '  borderRightWidth: frameWidth,',
        '}',
        "// borderLeft: '3px solid'",
        'const NONE = { borderLeft: 0, borderLeftColor: color.ink }',
      ].join('\n')
    )
    expect(tsx['left-rail']).toEqual([])
  })

  test('a frame needs the same width on the right: a thicker left edge is a rail', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      '.a { border-left: 4px solid red; border-right: 1px solid red; }'
    )
    expect(lines(css, 'left-rail')).toEqual([1])
  })

  test('a design-tokens-ignore comment waives its own line only', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      '.a { border-left: 3px solid; } /* design-tokens-ignore: reason */\n.b { border-left: 3px solid; }'
    )
    expect(lines(css, 'left-rail')).toEqual([2])
  })
})

describe('chromeTokens preflight and scan', () => {
  const { errors } = trapExit()
  const temps: string[] = []
  afterAll(() => {
    for (const t of temps) rmSync(t, { recursive: true, force: true })
  })
  const emptyTree = () => {
    const root = mkdtempSync(join(tmpdir(), 'chrome-'))
    temps.push(root)
    return root
  }

  test('an empty tree trips the scan floor instead of passing', () => {
    expect(() => chromeTokens.preflight?.(emptyTree())).toThrow(new Exited(1))
    expect(errors.join('\n')).toContain('chrome tokens: scanned 0 files')
  })

  test('this checkout passes the floor and workspace coverage', () => {
    expect(() => chromeTokens.preflight?.(join(import.meta.dir, '..', '..', '..'))).not.toThrow()
    expect(errors).toEqual([])
  })

  test('scan reads authored files and skips tests', () => {
    const root = emptyTree()
    const files: Record<string, string> = {
      'apps/web/src/a.css': '.a { border-left: 3px solid; }\n',
      'apps/web/src/__tests__/b.css': '.b { border-left: 3px solid; }\n',
      'apps/web/src/C.test.tsx': "const C = { borderLeft: '3px solid' }\n",
    }
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(join(root, rel, '..'), { recursive: true })
      writeFileSync(join(root, rel), text)
    }
    expect(chromeTokens.scan(root)['left-rail']?.map((f) => f.file)).toEqual(['apps/web/src/a.css'])
    expect(chromeTokens.summary?.(root)).toBe('1 files scanned')
  })
})
