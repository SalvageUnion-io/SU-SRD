import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ratchetCounts } from '../lib/ruleEngine'
import { enclosingObject, parseCss } from '../lib/styleSource'
import { BREAKPOINT_LADDER, chromeTokens, scanChromeSources } from '../rules/chromeTokens'
import { Exited, trapExit } from './trapExit'

/**
 * The chrome-token laws (`packages/gates/rules/chromeTokens.ts`): each rule
 * against the form it forbids and the forms it must let through, so a rule
 * that silently stops matching fails here rather than going green on the repo.
 */

const scan = (rel: string, text: string) => scanChromeSources(new Map([[rel, text]]))
const lines = (found: ReturnType<typeof scan>, id: string) => found[id]?.map((f) => f.line)

describe('chrome tokens rule set', () => {
  test('every rule is zero', () => {
    expect(chromeTokens.id).toBe('chrome-tokens')
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

describe('chrome-tokens/left-rail', () => {
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

describe('chrome-tokens/dashed', () => {
  test('dashed outside the four meanings fails, in CSS and a style object', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { border-style: dashed; }',
        '.b { outline: 2px dashed; }',
        '.su-edit-cue:focus-within { outline-style: dashed; }',
        '.c { border-style: solid; text-decoration: underline dotted; }',
      ].join('\n')
    )
    expect(lines(css, 'dashed')).toEqual([1, 2, 3])
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        "const A = { borderStyle: 'dashed' }",
        "const B = { borderTop: on ? '1px dashed red' : '1px solid red' }",
        '<Badge shape="stamp" surface="dashed">x</Badge>',
        "const C = { borderStyle: 'solid' } // a dashed rule",
      ].join('\n')
    )
    expect(lines(tsx, 'dashed')).toEqual([1, 2, 3])
  })

  test('user-made, a reference unit, an edit field and an empty slot pass', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.su-entity-row__frame[data-user-made] { border-style: dashed; }',
        '.su-badge--dashed { border: 1px dashed; }',
        '.su-play-unit--reference > .frame { border-style: dashed; }',
        '.su-field__write-cue { border-style: dashed; }',
        '.su-edit-cue:hover { outline-style: dashed; }',
        '@media (hover: hover) { .su-btn--pencil { border-style: dashed; } }',
      ].join('\n')
    )
    expect(css.dashed).toEqual([])
    for (const file of [
      'apps/web/src/components/atoms/SlotGrid.tsx',
      'apps/web/src/components/atoms/Field.tsx',
      'apps/web/src/components/referenceEntity/card/cardChrome.ts',
    ]) {
      expect(scan(file, "const A = { borderStyle: 'dashed' }").dashed).toEqual([])
    }
  })
})

describe('motion: chrome-tokens/raw-duration, raw-easing, motion-loop', () => {
  test('a literal duration fails; a token and zero pass', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { transition: color 120ms var(--ease); }',
        '.b { transition-duration: .3s; transition-timing-function: var(--ease); }',
        '.c { animation: spin 1.4s var(--ease) infinite; }',
        '.d { transition: color var(--dur-fast) var(--ease); transition-delay: 0ms; }',
      ].join('\n')
    )
    expect(lines(css, 'raw-duration')).toEqual([1, 2, 3])
    const tsx = scan(
      'apps/web/src/X.tsx',
      "const A = { transitionDuration: '150ms' }\nconst B = { transitionDuration: duration.base }"
    )
    expect(lines(tsx, 'raw-duration')).toEqual([1])
  })

  test('an easing named at the call site, or none named, fails', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { transition: transform var(--dur-base) ease-out; }',
        '.b { transition: color var(--dur-fast); }',
        '.c { transition-duration: var(--dur-fast); }',
        '.d { transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }',
        '.e { transition: none; }',
        '.f { transition-duration: var(--dur-fast); transition-timing-function: var(--ease); }',
        '.g { --ease: x; }',
      ].join('\n')
    )
    expect(lines(css, 'raw-easing')).toEqual([1, 2, 3, 4])
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        "const A = { transitionTimingFunction: 'ease-in-out' }",
        "const B = { transition: 'opacity 150ms' }",
        'const C = { transitionDuration: duration.fast }',
        'const D = { transitionDuration: duration.fast, transitionTimingFunction: ease }',
        `const E = { transition: \`opacity ${'$'}{duration.fast} ${'$'}{ease}\` }`,
        "const F = { transition: 'none' }",
      ].join('\n')
    )
    expect(lines(tsx, 'raw-easing')).toEqual([1, 2, 3])
  })

  test('a loop runs only under no-preference, and never from a style object', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { animation: spin var(--dur-loop) var(--ease) infinite; }',
        '@media (prefers-reduced-motion: no-preference) {',
        '  .b { animation: spin var(--dur-loop) var(--ease) infinite; }',
        '}',
        '.c { animation: once var(--dur-base) var(--ease); }',
      ].join('\n')
    )
    expect(lines(css, 'motion-loop')).toEqual([1])
    const tsx = scan('apps/web/src/X.tsx', "const A = { animation: 'spin 2s infinite' }")
    expect(lines(tsx, 'motion-loop')).toEqual([1])
  })

  test('theme.css, the definitions and the reduced-motion backstop, is exempt', () => {
    const css = scan(
      'apps/web/src/styles/theme.css',
      '* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }'
    )
    expect(css['raw-duration']).toEqual([])
    expect(css['raw-easing']).toEqual([])
  })
})

describe('chrome-tokens/raw-breakpoint', () => {
  test('the gate’s ladder is design/tokens.ts’s `breakpoint`', () => {
    const tokens = readFileSync(
      join(import.meta.dir, '../../../apps/web/src/design/tokens.ts'),
      'utf8'
    )
    const block = tokens.match(/export const breakpoint = \{([^}]*)\}/)?.[1] ?? ''
    expect([...block.matchAll(/'([\d.]+rem)'/g)].map((m) => m[1])).toEqual([...BREAKPOINT_LADDER])
  })

  test('a query off the ladder, a max query or a px container query fails', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '@media (min-width: 40rem) { .a { color: red; } }',
        '@media (max-width: 39.99rem) { .a { color: red; } }',
        '@media (width >= 42rem) { .a { color: red; } }',
        '@container (width >= 414px) { .a { color: red; } }',
        '@media (width < 40rem) { .a { color: red; } }',
        '@media (40rem <= width) { .a { color: red; } }',
      ].join('\n')
    )
    expect(lines(css, 'raw-breakpoint')).toEqual([1, 2, 3, 4, 5, 6])
  })

  test('a rung, its complement, and queries that are not about width pass', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '@media (width >= 40rem) { .a { color: red; } }',
        '@media not (width >= 64rem) { .a { color: red; } }',
        '@media (width >= 40rem) and (not (width >= 64rem)) { .a { color: red; } }',
        '@container card (width >= 80rem) { .a { color: red; } }',
        '@media (pointer: coarse), not (width >= 48rem) { .a { color: red; } }',
        '@media print { .a { max-width: 30rem; } }',
        '@container (width >= 18rem) {',
        '  /* design-tokens-ignore: a component’s own fit */',
        '  .a { color: red; }',
        '}',
      ].join('\n')
    )
    expect(css['raw-breakpoint']).toEqual([])
  })

  test('a script reads its rung from `breakpoint`', () => {
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        "const A = '(min-width: 48rem)'",
        "const B = '(width >= 64rem)'",
        "const C = '(max-width: 30rem) 100vw, 16rem'",
        "const D = widthAtLeast('md')",
        `const E = \`(width >= ${'$'}{breakpoint.lg}) 560px, 100vw\``,
        "const F = '(display-mode: standalone)'",
      ].join('\n')
    )
    expect(lines(tsx, 'raw-breakpoint')).toEqual([1, 2, 3])
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
