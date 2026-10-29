import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ratchetCounts } from '../lib/ruleEngine'
import { blankScriptComments, enclosingObject, parseCss } from '../lib/styleSource'
import {
  ALERT_ATOMS,
  BREAKPOINT_LADDER,
  CAPS_RULES,
  chromeTokens,
  LOADING_ATOMS,
  scanChromeSources,
} from '../rules/chromeTokens'
import { ENTITY_FRAME_STYLE_FILES } from '../rules/entityFrames'
import { Exited, trapExit } from './trapExit'

/**
 * The chrome-token laws (`packages/gates/rules/chromeTokens.ts`): each rule
 * against the form it forbids and the forms it must let through, so a rule
 * that silently stops matching fails here rather than going green on the repo.
 */

const scan = (rel: string, text: string) => scanChromeSources(new Map([[rel, text]]))
const lines = (found: ReturnType<typeof scan>, id: string) => found[id]?.map((f) => f.line)

describe('chrome tokens rule set', () => {
  test('every rule is zero, the entity-frame-ink rule (R38) too', () => {
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
    expect(enclosingObject(text, text.indexOf('y:') + 11)).toBe('{ x: 1, y: { z: 2 } }')
  })

  test('blankScriptComments blanks comments in place and keeps strings whole', () => {
    const text = [
      "const a = '// no' // gone",
      'const b = 1 /* gone',
      'still gone */ + 2',
      'const c = `/* kept */`',
      '/* never closed',
    ].join('\n')
    const out = blankScriptComments(text)
    expect(out.length).toBe(text.length)
    expect(out.split('\n')).toEqual([
      "const a = '// no'        ",
      'const b = 1        ',
      '              + 2',
      'const c = `/* kept */`',
      '               ',
    ])
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

  test('a design-tokens-ignore comment waives the rule it names, on its own line only', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.a { border-left: 3px solid; } /* design-tokens-ignore(left-rail): reason */',
        '.b { border-left: 3px solid; }',
        '.c { border-left: 3px solid; } /* design-tokens-ignore: no rule named */',
        '.d { border-left: 3px solid; } /* design-tokens-ignore(dashed): another rule */',
      ].join('\n')
    )
    expect(lines(css, 'left-rail')).toEqual([2, 3, 4])
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
        '.su-entity-compact__frame[data-user-made] { border-style: dashed; }',
        '.su-badge--dashed { border: 1px dashed; }',
        '.frame[data-reference] { border-style: dashed; }',
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

  test('loading-mark: @keyframes and su-pulse only in the loading atoms', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '@keyframes slide { to { transform: none; } }',
        '.a.su-pulse { opacity: 1; }',
        '/* su-pulse, @keyframes */',
        '.b { opacity: 1; }',
      ].join('\n')
    )
    expect(lines(css, 'loading-mark')).toEqual([1, 2])
    const tsx = scan(
      'apps/web/src/X.tsx',
      '<div className="su-pulse" />\n// su-pulse\nconst A = `@keyframes x {}`'
    )
    expect(lines(tsx, 'loading-mark')).toEqual([1, 3])
    for (const atom of LOADING_ATOMS) {
      const found = scan(
        atom,
        atom.endsWith('.css')
          ? '@keyframes su-pulse { 50% { opacity: 0.5; } }'
          : '<div className="su-pulse" />'
      )
      expect(found['loading-mark']).toEqual([])
    }
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

describe('chrome-tokens/raw-alert', () => {
  test('a raw role="alert" fails outside the error atoms; alertdialog and status pass', () => {
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        '<span role="alert">x</span>',
        "const props = { role: 'alert' }",
        '<div role={"alert"} />',
        '<div role="alertdialog" />',
        '<p role="status" />',
        '// role="alert"',
      ].join('\n')
    )
    expect(lines(tsx, 'raw-alert')).toEqual([1, 2, 3])
    for (const atom of ALERT_ATOMS) {
      expect(scan(atom, '<div role="alert" />')['raw-alert']).toEqual([])
    }
  })
})

describe('chrome-tokens/hand-caps', () => {
  test('a hand-set uppercase fails; the recipe and Button set it, and other transforms pass', () => {
    const css = scan(
      'apps/web/src/styles/partials/x.css',
      [
        '.su-a { text-transform: uppercase; }',
        '.su-b { text-transform: none; }',
        '.su-caps { text-transform: uppercase; }',
      ].join('\n')
    )
    expect(lines(css, 'hand-caps')).toEqual([1, 3])
    for (const [file, , why] of CAPS_RULES) {
      const selector = why.includes('Button') ? '.su-btn' : '.su-caps'
      expect(scan(file, `${selector} { text-transform: uppercase; }`)['hand-caps']).toEqual([])
    }
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        "const A = { textTransform: 'uppercase' }",
        "const B = { textTransform: 'none' }",
        "// textTransform: 'uppercase'",
        '<span className={capsLabel()}>x</span>',
      ].join('\n')
    )
    expect(lines(tsx, 'hand-caps')).toEqual([1])
  })
})

describe('chrome-tokens/badge-caps-snug', () => {
  test('11px letterspaces only at caps-snug, in a stylesheet, a style object and the recipe', () => {
    const css = scan(
      'apps/web/src/styles/partials/x.css',
      [
        '.su-a { font-size: var(--text-badge); letter-spacing: var(--tracking-caps); }',
        '.su-b { font-size: var(--text-badge); letter-spacing: var(--tracking-caps-snug); }',
        '.su-c { font-size: var(--text-sm); letter-spacing: var(--tracking-caps); }',
        '.su-d { font-size: var(--text-badge); letter-spacing: normal; }',
      ].join('\n')
    )
    expect(lines(css, 'badge-caps-snug')).toEqual([1])
    const tsx = scan(
      'apps/web/src/X.tsx',
      [
        'const A = { fontSize: fontSize.badge, letterSpacing: tracking.caps }',
        'const B = { fontSize: tokens.fontSize.badge, letterSpacing: tokens.tracking.capsSnug }',
        'const C = { fontSize: fontSize.sm, letterSpacing: tracking.caps }',
        "const D = capsLabel({ size: 'badge', tracking: 'caps' })",
        "const E = capsLabel({ size: 'badge', weight: 'semibold' })",
        "const F = capsLabel({ size: 'badge', tracking: 'snug' })",
        "const G = capsLabel({ size: 'caption', tracking: 'caps' })",
      ].join('\n')
    )
    expect(lines(tsx, 'badge-caps-snug')).toEqual([1, 4])
  })
})

describe('chrome-tokens/muted-note', () => {
  test('a muted ink with a font size fails outside the atoms and containers; either alone passes', () => {
    const body = [
      'const A = { color: color.wkMuted, fontSize: fontSize.sm }',
      'const B = { color: tokens.color.ink75, fontSize: tokens.fontSize.note }',
      "const C = { color: 'var(--color-wk-muted)', fontSize: fontSize.xs }",
      'const D = { color: color.wkMuted, margin: 0 }',
      'const E = { color: color.ink, fontSize: fontSize.sm }',
      'const F = { color: color.wkMuted, fontSize: fontSize.sm } // design-tokens-ignore(muted-note): a label',
    ].join('\n')
    expect(lines(scan('apps/web/src/X.tsx', body), 'muted-note')).toEqual([1, 2, 3])
    expect(scan('apps/web/src/components/atoms/X.tsx', body)['muted-note']).toEqual([])
    expect(scan('apps/web/src/components/containers/X.tsx', body)['muted-note']).toEqual([])
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
        '  /* design-tokens-ignore(raw-breakpoint): a component’s own fit */',
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

describe('chrome-tokens/entity-frame-ink', () => {
  test("solid ink on an entity frame's border fails, as a fallback too", () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.su-entity-compact__frame { border-color: var(--su-compact-frame, var(--color-ink)); }',
        '.su-mini-group { border: var(--bw-chrome) solid var(--color-ink); }',
        '.x .su-entity-mini__body, .y { border-top-color: var(--color-ink-deep); }',
        '.su-ec-frame[data-x] { border-color: var(--color-ink-2); }',
      ].join('\n')
    )
    expect(lines(css, 'entity-frame-ink')).toEqual([1, 2, 3, 4])
  })

  test('the subtle ink, a width, and solid ink inside a frame but not on it pass', () => {
    const css = scan(
      'apps/web/src/styles/x.css',
      [
        '.su-entity-compact__frame { border-color: var(--su-compact-frame, var(--color-ink-40)); }',
        '.su-ec-frame { border-width: var(--bw-entity); border-style: solid; }',
        '.su-ec-frame > .su-x-inner { border-bottom: var(--bw-chrome) solid var(--color-ink); }',
        '.su-entity-compact__frame-x { border-color: var(--color-ink); }',
      ].join('\n')
    )
    expect(css['entity-frame-ink']).toEqual([])
  })

  test("a frame's style object takes only the subtle ink, clear or --su-compact-frame", () => {
    const rel = ENTITY_FRAME_STYLE_FILES[0] as string
    const bad = scan(
      rel,
      "const A = { borderColor: 'var(--color-ink)' }\nconst B = { borderColor: paint.background }"
    )
    expect(lines(bad, 'entity-frame-ink')).toEqual([1, 2])
    const good = scan(
      rel,
      [
        'const A = { borderColor: color.ink40 }',
        "const B = { borderColor: 'transparent' }",
        "const C = { borderColor: 'var(--su-compact-frame, var(--color-ink-40))' }",
      ].join('\n')
    )
    expect(good['entity-frame-ink']).toEqual([])
    // Elsewhere a borderColor is no entity frame's.
    expect(
      scan('apps/web/src/X.tsx', 'const A = { borderColor: color.ink }')['entity-frame-ink']
    ).toEqual([])
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
