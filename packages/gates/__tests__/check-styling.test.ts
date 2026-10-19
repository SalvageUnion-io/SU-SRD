import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Finding, RuleSet } from '../lib/ruleEngine'
import { evaluate, formatFailures, increases, listFiles, ratchetCounts } from '../lib/ruleEngine'
import { chromeLaws, statTextFindings } from '../rules/chrome'
import { classPrefix } from '../rules/classPrefix'
import { designTokens, fontSizePx, scanTokenSources } from '../rules/designTokens'
import { SRD_CSS_ENTRY, srdCss } from '../rules/srdCss'
import { stylingOwnership } from '../rules/stylingOwnership'
import { DATA_DIR, PENDING_TL_GROUNDS, toneGround } from '../rules/toneGround'

/**
 * `tools/check-rule-sets.ts` gates merges on these rule sets. These tests pin the
 * engine's verdict logic and run each rule set against a fixture tree, so a
 * rule that silently stops matching fails here rather than going green on the
 * real repo.
 */

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'styling-'))
  roots.push(root)
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
  return root
}

const finding = (n: number): Finding[] =>
  Array.from({ length: n }, (_, i) => ({ file: 'x.ts', line: i + 1, detail: 'd' }))

const SET: RuleSet = {
  id: 'demo',
  label: 'demo',
  exemptionsLive: 'nowhere',
  rules: [
    { id: 'z', rule: 'zero law', fix: 'fix z', mode: 'zero' },
    { id: 'r', rule: 'ratchet law', fix: 'fix r', mode: 'ratchet' },
  ],
  scan: () => ({}),
}

describe('ruleEngine.evaluate', () => {
  test('passes when zero rules are clean and ratchets sit exactly at baseline', () => {
    const v = evaluate(SET, { z: [], r: finding(3) }, { r: 3 })
    expect(v.ok).toBe(true)
  })

  test('a zero rule fails on any finding, with no baseline to hide behind', () => {
    const v = evaluate(SET, { z: finding(1), r: [] }, { r: 0 })
    expect(v.ok).toBe(false)
    expect(v.rules.find((r) => r.rule.id === 'z')?.problem).toBe('nonzero')
  })

  test('a ratchet fails when the count rises', () => {
    const v = evaluate(SET, { z: [], r: finding(4) }, { r: 3 })
    expect(v.rules.find((r) => r.rule.id === 'r')?.problem).toBe('regressed')
  })

  test('a ratchet fails when the count FALLS but the baseline was not lowered', () => {
    const v = evaluate(SET, { z: [], r: finding(2) }, { r: 3 })
    expect(v.ok).toBe(false)
    expect(v.rules.find((r) => r.rule.id === 'r')?.problem).toBe('unrecorded-improvement')
    expect(formatFailures(v, 'UPDATE').join('\n')).toContain('run: UPDATE')
  })

  test('a missing baseline entry means zero allowed', () => {
    const v = evaluate(SET, { z: [], r: finding(1) }, {})
    expect(v.rules.find((r) => r.rule.id === 'r')?.problem).toBe('regressed')
  })

  test('a baseline entry for a zero rule or an unknown rule is stale and fails', () => {
    const v = evaluate(SET, { z: [], r: [] }, { r: 0, z: 0, gone: 4 })
    expect(v.ok).toBe(false)
    expect(v.staleBaselineKeys.sort()).toEqual(['gone', 'z'])
  })

  test('ratchetCounts records ratchet rules only, and increases() names only rises', () => {
    const counts = ratchetCounts(SET, { z: finding(9), r: finding(2) })
    expect(counts).toEqual({ r: 2 })
    expect(increases({ r: 3 }, { r: 2 })).toEqual([])
    expect(increases({ r: 1 }, { r: 2 })).toEqual(['r: 1 → 2'])
  })
})

describe('ruleEngine.listFiles', () => {
  test('skips node_modules, dist, generated and dot-directories', () => {
    const root = fixture({
      'a/keep.ts': '',
      'a/deep/keep.tsx': '',
      'a/node_modules/x.ts': '',
      'a/dist/x.ts': '',
      'a/generated/x.ts': '',
      'a/.cache/x.ts': '',
      'a/other.md': '',
    })
    expect(listFiles(root, ['a', 'missing'], ['.ts', '.tsx'])).toEqual([
      'a/deep/keep.tsx',
      'a/keep.ts',
    ])
  })
})

describe('tokens rule set', () => {
  const scan = (rel: string, text: string) => scanTokenSources(new Map([[rel, text]]))

  test('every rule is zero', () => {
    expect(designTokens.rules.filter((r) => r.mode !== 'zero').map((r) => r.id)).toEqual([])
    expect(ratchetCounts(designTokens, {})).toEqual({})
  })

  test('raw colour literals are found; issue refs and HTML entities are not', () => {
    const found = scan(
      'apps/web/src/routes/x.tsx',
      [
        "const a = '#ff0000'",
        'see microsoft/TypeScript#30581 and PR #466',
        "const arrow = '&#8599;'",
        "const shadow = 'shadow-[0_5px_18px_rgba(0,0,0,0.2)]'",
      ].join('\n')
    )
    expect(found['raw-color']?.map((f) => f.line)).toEqual([1, 4])
  })

  test('a design-tokens-ignore comment waives its own line only', () => {
    const found = scan(
      'apps/web/src/routes/x.tsx',
      "const a = '#ff0000' // design-tokens-ignore: brand\nconst b = '#00ff00'"
    )
    expect(found['raw-color']?.map((f) => f.line)).toEqual([2])
  })

  test('the token definition file is exempt from raw-color but not from other rules', () => {
    const found = scan(
      'apps/web/src/styles/theme.css',
      '--color-x: #ff0000;\n.x { font-size: 9px; }'
    )
    expect(found['raw-color']).toEqual([])
    expect(found['type-floor']?.length).toBe(1)
  })

  test('each zero rule matches the form it forbids', () => {
    const found = scan('apps/web/src/x.tsx', 'bg-su-orange linear-gradient(')
    for (const id of ['shadow-tokens', 'gradient']) {
      expect(found[id]?.length).toBe(1)
    }
  })

  test('type-floor: a retired rung by any name, or a literal under 11px, fails', () => {
    const found = scan(
      'apps/web/src/routes/x.tsx',
      [
        'text-nano text-micro text-label text-label-lg',
        'font-size: var(--text-micro);',
        'fontSize: fontSize.labelLg,',
        'capsLabel() // su-caps--label',
        'text-[9.5px] text-[0.6rem]',
        'font-size: 10px;',
        "style={{ fontSize: '10.5px' }}",
        '<text fontSize={9}>',
      ].join('\n')
    )
    expect(found['type-floor']?.map((f) => f.detail)).toEqual([
      'text-nano',
      'text-micro',
      'text-label',
      'text-label-lg',
      '--text-micro',
      'fontSize.labelLg',
      'su-caps--label',
      'text-[9.5px]',
      'text-[0.6rem]',
      'font-size: 10px',
      "fontSize: '10.5px",
      'fontSize={9',
    ])
  })

  test('type-floor: the floor itself and everything above it pass', () => {
    const found = scan(
      'apps/web/src/routes/x.tsx',
      [
        'text-badge text-note text-labels text-label-ish',
        'font-size: 11px; font-size: 0.75rem; font-size: 9pt;',
        "style={{ fontSize: 13 }} fontSize: '0.8125rem' fontSize: fontSize.badge",
        'text-[12px] text-[clamp(26px,4vw,40px)]',
      ].join('\n')
    )
    expect(found['type-floor']).toEqual([])
  })

  test('rust-allowlist: every spelling of rust fails outside Button / buttonVariants / InlineRef', () => {
    const found = scan(
      'apps/web/src/x.tsx',
      [
        'text-rust hover:text-rust border-rust/40 bg-rust-hi accent-rust',
        'outline: var(--color-rust); box-shadow: 0 0 0 3px var(--color-rust-25)',
        'backgroundColor: color.rust, color.rustHi',
        'trust the rustic text-rusty', // not rust
      ].join('\n')
    )
    expect(found['rust-allowlist']?.map((f) => f.detail)).toEqual([
      'text-rust',
      'text-rust',
      'border-rust',
      'bg-rust-hi',
      'accent-rust',
      '--color-rust',
      '--color-rust-25',
      'color.rust',
      'color.rustHi',
    ])
  })

  test('rust-allowlist: the allowlisted files and a Button-rust ignore line pass', () => {
    for (const file of [
      'apps/web/src/components/atoms/Button.tsx',
      'apps/web/src/components/atoms/buttonVariants.ts',
      'apps/web/src/components/atoms/InlineRef.tsx',
      'apps/web/src/styles/theme.css',
    ]) {
      expect(scan(file, 'bg-rust var(--color-rust)')['rust-allowlist']).toEqual([])
    }
    const css = scan(
      'apps/web/src/styles/index.css',
      "background: var(--color-rust); /* design-tokens-ignore: Button's rust */\nborder-color: var(--color-rust);"
    )
    expect(css['rust-allowlist']?.map((f) => f.line)).toEqual([2])
  })

  test('texture-placement: speckle is a finding on a forbidden surface or a paper ground', () => {
    const ref = "filter: 'url(#su-blot)', opacity: tokens.texture.blotOpacity"
    for (const file of [
      'apps/web/src/components/atoms/Button.tsx',
      'apps/web/src/components/atoms/KofiButton.tsx',
      'apps/web/src/components/atoms/buttonVariants.ts',
      'apps/web/src/components/atoms/Field.tsx',
      'apps/web/src/components/atoms/inputs.tsx',
      'apps/web/src/components/atoms/SearchField.tsx',
      'apps/web/src/components/atoms/Tooltip.tsx',
    ]) {
      expect(scan(file, ref)['texture-placement']?.length, file).toBe(2)
    }
    // R10 (2026-10-19): Play's and the Peek's brand-colour bands wear it too.
    for (const file of [
      'apps/web/src/play/PlayUnits.tsx',
      'apps/web/src/styles/play/units.css',
      'apps/web/src/components/entity/PeekCard.tsx',
    ]) {
      expect(scan(file, ref)['texture-placement'] ?? [], file).toEqual([])
    }
    const onPaper = scan(
      'apps/web/src/components/atoms/BandTitle.tsx',
      '<div className="bg-paper"><svg><rect filter="url(#su-speck)" /></svg></div>\n' +
        "const s = { backgroundColor: color.paper, opacity: 'var(--texture-speck-opacity)' }"
    )
    expect(onPaper['texture-placement']?.map((f) => f.detail)).toEqual([
      'su-speck',
      '--texture-speck-opacity',
    ])
  })

  test('texture-placement: speckle on a band or an ink ground passes', () => {
    const found = scan(
      'apps/web/src/components/atoms/BandTitle.tsx',
      [
        '<div className="bg-mech"><svg><rect filter="url(#su-blot)" /></svg></div>',
        'const s = { backgroundColor: color.ink, opacity: tokens.texture.fleckOpacity }',
        "const t = { color: color.paper, filter: 'url(#su-fleck)' }", // paper TEXT, ink ground
      ].join('\n')
    )
    expect(found['texture-placement']).toEqual([])
  })

  test('cool-ground: wk-bg-2 by any spelling fails, outside the print sheet', () => {
    const text = [
      "className='bg-wk-bg-2 hover:bg-wk-bg-2 border-wk-bg-2'",
      'background: var(--color-wk-bg-2);',
      'const s = { backgroundColor: color.wkBg2 }',
      'bg-wk-bg text-wk-muted bg-wk-bg-20', // the warm ground and look-alikes pass
    ].join('\n')
    expect(scan('apps/web/src/routes/x.tsx', text)['cool-ground']?.map((f) => f.detail)).toEqual([
      'bg-wk-bg-2',
      'bg-wk-bg-2',
      'border-wk-bg-2',
      '--color-wk-bg-2',
      'wkBg2',
    ])
    expect(scan('apps/web/src/styles/build/print.css', text)['cool-ground']).toEqual([])
  })

  const details = (rule: string, rel: string, text: string) =>
    scan(rel, text)[rule]?.map((f) => f.detail) ?? []
  const lines = (rule: string, text: string) =>
    scan('apps/web/src/x.tsx', text)[rule]?.map((f) => f.line) ?? []
  /** A template literal's `${expr}`, spelled so the fixture stays a plain string. */
  const interp = (expr: string) => ['$', '{', expr, '}'].join('')

  test('raw-tracking: a literal letter-spacing fails; a rung, 0 and keywords pass', () => {
    const css = [
      'letter-spacing: 0.1em;',
      'letter-spacing: var(--tracking-caps);',
      'letter-spacing: 0;',
      'letter-spacing: normal;',
    ].join('\n')
    expect(details('raw-tracking', 'apps/web/src/styles/x.css', css)).toEqual([
      'letter-spacing: 0.1em',
    ])
    const ts = "const a = { letterSpacing: '-0.025em' }\nconst b = { letterSpacing: tracking.caps }"
    expect(details('raw-tracking', 'apps/web/src/x.tsx', ts)).toEqual(["letterSpacing: '-0.025em'"])
  })

  test('size-literal: a 44/32/18px height or touch floor fails; a Size and other heights pass', () => {
    const css = [
      'min-height: 44px;',
      'height: max(100%, 2.75rem);',
      'min-width: 44px;',
      'min-height: var(--size-full);',
      'height: 22px;',
      'width: 44px;', // a plain width is a box, not a Size
      'max-width: 32rem;',
    ].join('\n')
    expect(lines('size-literal', css)).toEqual([1, 2, 3])
    const ts = "const A = { height: '18px', minHeight: size.full, width: '18px' }"
    expect(details('size-literal', 'apps/web/src/x.tsx', ts)).toEqual(["height: '18px'"])
  })

  test('ink-mix: a color-mix of ink fails; the ramp and other mixes pass', () => {
    const text = [
      'background: color-mix(in oklab, var(--color-ink) 70%, transparent);',
      'border-color: color-mix(in srgb, var(--color-ink-deep) 80%, transparent);',
      `const s = \`color-mix(in oklab, ${interp('color.ink')} 25%, transparent)\``,
      'background: var(--color-ink-75);',
      'color: color-mix(in oklab, var(--color-paper) 60%, transparent);',
    ].join('\n')
    expect(lines('ink-mix', text)).toEqual([1, 2, 3])
  })

  test('raw-border-width: a literal border weight fails; a token and 0 pass', () => {
    const text = [
      'border: 2px solid var(--color-ink);',
      'border-top-width: 1px;',
      "const a = { borderWidth: '0 0 2px' }",
      `const b = { borderTop: \`1px solid ${interp('color.paper30')}\` }`,
      'border: var(--bw-chrome) solid var(--color-ink);',
      'border: 0;',
      'border-radius: 4px;', // a radius, not a weight
      `const c = { borderWidth: \`0 0 ${interp('borderWidth.pill')}\` }`,
    ].join('\n')
    expect(lines('raw-border-width', text)).toEqual([1, 2, 3, 4])
  })

  test('raw-radius: a literal radius fails; a token, calc on a token, 0 and percentages pass', () => {
    const text = [
      'border-radius: 0.25rem;',
      "const a = { borderRadius: '0.375rem' }",
      "const b = { borderTopLeftRadius: '6px' }",
      'border-radius: var(--radius-card);',
      'border-radius: calc(var(--radius-card) - var(--bw-chrome));',
      'border-radius: 0;',
      'border-radius: 50%;',
    ].join('\n')
    expect(lines('raw-radius', text)).toEqual([1, 2, 3])
  })

  test('raw-spacing: a length outside the scale tokens is counted; tokens and unitless options are not', () => {
    const text = [
      'padding: 3px var(--space-6);',
      'gap: 0.75rem;',
      "const a = { marginLeft: '34px', padding: space[8] }",
      'padding: var(--space-8) var(--space-12);',
      'margin: calc(-1 * var(--space-4));',
      'margin: 0;',
      'QRCode.toString(url, { margin: 1 })', // a library option, unitless
    ].join('\n')
    expect(details('raw-spacing', 'apps/web/src/x.tsx', text)).toEqual([
      'padding: 3px var(--space-6)',
      'gap: 0.75rem',
      "marginLeft: '34px'",
    ])
  })

  test('raw-shadow: a cast shadow fails, split over lines included; the lift, the ring and frames pass', () => {
    const text = [
      `const a = { boxShadow: \`0 14px 28px -14px ${interp('color.ink50')}\` }`,
      "const b = { boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }",
      'box-shadow: 0 5px 18px var(--color-ink-20);',
      '.x {',
      '  box-shadow:',
      '    0 0 0 1px var(--color-ink),',
      '    0 10px 15px -3px var(--color-ink-20);',
      '}',
      'box-shadow: var(--shadow-lift);',
      'const c = { boxShadow: shadow.lift }',
      'box-shadow: var(--focus-ring-shadow);',
      'box-shadow: 0 0 0 3px var(--color-ink);',
      'box-shadow: inset 0 -2px 0 var(--color-paper);',
      `const d = { boxShadow: \`0 2px 0 ${interp('color.ink')}, ${interp('shadow.lift')}\` }`,
      '.y {',
      '  box-shadow:',
      '    0 0 0 3px var(--ground),',
      '    0 0 0 6px var(--color-ink);',
      '}',
    ].join('\n')
    expect(lines('raw-shadow', text)).toEqual([1, 2, 3, 5])
  })

  test('raw-z-index: a literal above 3 fails; a layer and local stacking pass', () => {
    const text = [
      'z-index: 10;',
      'const a = { zIndex: 30 }',
      "const b = { zIndex: '40' }",
      'z-index: var(--z-sticky);',
      'const c = { zIndex: layer.menu }',
      'z-index: 3;',
      'z-index: -1;',
      'const d = { position: "absolute", zIndex: 1, top: 0 }',
    ].join('\n')
    expect(lines('raw-z-index', text)).toEqual([1, 2, 3])
  })
})

describe('fontSizePx', () => {
  test('reads px, rem and unitless (style-object) sizes; names have no size', () => {
    expect(fontSizePx('text-[9.5px]')).toBe(9.5)
    expect(fontSizePx('font-size: 0.5rem')).toBe(8)
    expect(fontSizePx('fontSize={9')).toBe(9)
    expect(fontSizePx('text-label-lg')).toBeUndefined()
  })
})

const ENTRY = 'apps/web/src/styles/entry.css'

const STYLING_BASE: Record<string, string> = {
  [ENTRY]:
    "@layer su-reset, su-base;\n@import './theme.css';\n@import './reset.css' layer(su-reset);\n@import './index.css' layer(su-base);\n",
  'apps/web/src/styles/base.css': "@import './entry.css';\n",
  'apps/web/src/styles/app.css': "@import './styles/print.css';\n",
  'apps/web/src/styles/global.css': "@import './pages.css';\n",
  'apps/web/src/styles/play/dashboard/canvas.css': '.su-dash-used { color: red }\n',
  'apps/web/src/styles/play/dashboard/instruments.css': '',
  'apps/web/src/styles/play/dashboard/phone.css': '',
  'apps/web/src/play/Thing.tsx': 'export const T = () => <div className="su-dash-used" />\n',
}

describe('styling rule set', () => {
  test('a clean fixture has no findings', () => {
    const found = stylingOwnership.scan(fixture(STYLING_BASE))
    for (const id of [
      'app-theme',
      'dead-app-css',
      'dash-class-contract',
      'package-stylesheet-import',
      'no-tailwind',
      'style-object-annotation',
      'entity-markup',
    ]) {
      expect(found[id]).toEqual([])
    }
  })

  test('entity-markup: code and stylesheets outside entity/ that reach into an entity form are found (R7)', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/play/actions.css': [
          '.su-play-act[data-open] .su-entity-row__frame { border-width: 3px }',
          '/* `.su-entity-row__main` in a comment is prose */',
          '.su-play-act { display: flex }',
          '',
        ].join('\n'),
        'apps/web/src/play/Pill.tsx':
          'export const P = () => <div className="su-entity-token__pill" />\n',
        'apps/web/src/play/__tests__/Pill.test.tsx': "q('.su-entity-token__name')\n",
        'apps/web/src/components/entity/forms/Row.tsx':
          '<div className="su-entity-row__frame" />\n',
        'apps/web/src/components/containers/Frame.tsx':
          'export const F = () => <div className="su-entity-row__main" />\n',
        'apps/web/src/styles/partials/entity-forms.css': '.su-entity-row__frame { flex: 1 }\n',
        'apps/web/src/styles/partials/controls.css':
          '.su-picker > .su-entity-row__frame { min-height: 0 }\n',
        'apps/web/src/styles/build/print.css':
          '@media print {\n  .su-entity-token__pill { font-size: revert-layer }\n}\n',
      })
    )
    expect(found['entity-markup']?.map((f) => `${f.file}:${f.line}`).sort()).toEqual([
      'apps/web/src/components/containers/Frame.tsx:1',
      'apps/web/src/play/Pill.tsx:1',
      'apps/web/src/styles/build/print.css:2',
      'apps/web/src/styles/partials/controls.css:1',
      'apps/web/src/styles/play/actions.css:1',
    ])
  })

  test('a Tailwind package in any workspace manifest (tools/ included) and a Tailwind directive in any stylesheet are found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'package.json': JSON.stringify(
          {
            devDependencies: { tailwindcss: '4.1.0', typescript: '5.9.0' },
            workspaces: { packages: ['apps/*', 'packages/*', 'tools'] },
          },
          null,
          2
        ),
        'tools/package.json': JSON.stringify(
          { devDependencies: { '@tailwindcss/cli': '4.1.0' } },
          null,
          2
        ),
        'packages/game-domain/package.json': JSON.stringify(
          { dependencies: { clsx: '2.1.1', 'tailwind-merge': '3.0.0' } },
          null,
          2
        ),
        'apps/web/package.json': JSON.stringify(
          { devDependencies: { '@tailwindcss/vite': '4.1.0' } },
          null,
          2
        ),
        'apps/web/src/styles/index.css':
          '/* @apply in a comment is prose */\n.su-x { color: red }\n@layer utilities {\n  .flex { display: flex }\n}\n',
        'apps/web/src/styles/global.css':
          "@import './entry.css';\n@source '../src';\n.su-y {\n  @apply flex;\n}\n",
      })
    )
    expect(found['no-tailwind']?.map((f) => `${f.file}:${f.line} ${f.detail}`)).toEqual([
      "package.json:3 devDependencies declares 'tailwindcss'",
      "apps/web/package.json:3 devDependencies declares '@tailwindcss/vite'",
      "packages/game-domain/package.json:4 dependencies declares 'tailwind-merge'",
      "tools/package.json:3 devDependencies declares '@tailwindcss/cli'",
      "apps/web/src/styles/global.css:2 Tailwind directive '@source'",
      "apps/web/src/styles/global.css:4 Tailwind directive '@apply'",
      "apps/web/src/styles/index.css:3 Tailwind directive '@layer utilities'",
    ])
  })

  test('an app @theme, dead app CSS and an undefined dashboard class are all found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/extra.css':
          '@theme {\n  --color-x: red;\n}\n.never-used { color: red }\n',
        'apps/web/src/Page.tsx': 'export const P = () => <div className="su-dash-missing" />\n',
      })
    )
    expect(found['app-theme']?.length).toBe(1) // the reserved token; the @theme block is no-tailwind's
    expect(found['dead-app-css']?.map((f) => f.detail)).toEqual([
      '.never-used defined but never referenced in app source',
    ])
    expect(found['dash-class-contract']?.map((f) => f.detail)[0]).toContain("'su-dash-missing'")
  })

  test('a dashboard class defined but never used is found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/play/dashboard/instruments.css': '.su-dash-dead { color: red }\n',
      })
    )
    expect(found['dash-class-contract']?.map((f) => f.detail)).toEqual([
      "dashboard class '.su-dash-dead' defined but never referenced",
    ])
  })

  test('an unlayered package stylesheet import is found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        [ENTRY]:
          "@layer su-reset;\n@import './reset.css' layer(su-reset);\n@import './index.css';\n",
      })
    )
    expect(found['package-stylesheet-import']?.[0]?.detail).toContain('WITHOUT a cascade layer')
  })

  test('an entry missing either import is found, naming what then renders wrong', () => {
    const noIndex = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        [ENTRY]: "@layer su-reset, su-base;\n@import './reset.css' layer(su-reset);\n",
      })
    )
    expect(noIndex['package-stylesheet-import']?.map((f) => f.detail)).toEqual([
      "does not import './index.css' — every `.su-*` component renders unstyled",
    ])
    const noReset = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        [ENTRY]: "@layer su-reset, su-base;\n@import './index.css' layer(su-base);\n",
      })
    )
    expect(noReset['package-stylesheet-import']?.map((f) => f.detail)).toEqual([
      "does not import './reset.css' — every element loses its reset",
    ])
  })

  test('an import into a layer no @layer declaration names is found on its line', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        [ENTRY]:
          "@layer su-reset;\n@import './reset.css' layer(su-reset);\n@import './index.css' layer(su-base);\n",
      })
    )
    expect(
      found['package-stylesheet-import']?.map((f) => `${f.line} ${f.detail.split(' —')[0]}`)
    ).toEqual(['3 imports into layer(su-base) but no @layer declaration names it'])
  })

  test('every class of a selector list split across lines is harvested as dead CSS', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/extra.css': '.multi-a,\n.multi-b {\n  color: red;\n}\n',
      })
    )
    expect(found['dead-app-css']?.map((f) => `${f.line} ${f.detail}`)).toEqual([
      '1 .multi-a defined but never referenced in app source',
      '2 .multi-b defined but never referenced in app source',
    ])
  })

  test('a reset layered after the package stylesheet is found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        [ENTRY]:
          "@layer su-base, su-reset;\n@import './reset.css' layer(su-reset);\n@import './index.css' layer(su-base);\n",
      })
    )
    expect(found['package-stylesheet-import']?.[0]?.detail).toContain('BEFORE')
  })

  test('an annotated style object is counted; satisfies, a style function and prose are not', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/components/A.tsx': [
          "const WIDE: CSSProperties = { width: '100%' }",
          'const TALL: React.CSSProperties = {',
          "  height: '100%',",
          '}',
          "const OK = { width: '100%' } satisfies CSSProperties",
          'const band = (fill: string): CSSProperties => ({ background: fill })',
          '// never `const X: CSSProperties = {}`',
          '',
        ].join('\n'),
      })
    )
    expect(found['style-object-annotation']?.map((f) => `${f.file}:${f.line}`)).toEqual([
      'apps/web/src/components/A.tsx:1',
      'apps/web/src/components/A.tsx:2',
    ])
  })

  test('an app stylesheet that imports the shared entry loads the package twice', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/app.css': "@import './entry.css';\n",
      })
    )
    expect(found['package-stylesheet-import']?.map((f) => f.detail)).toEqual([
      'imports the shared stylesheet entry, which the base stylesheet (apps/web/src/styles/base.css) already loads',
    ])
  })

  test('a consumer that imports the package stylesheet itself is a second entry', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/base.css': "@import './index.css';\n",
      })
    )
    expect(found['package-stylesheet-import']?.map((f) => f.detail)).toEqual([
      `does not import the shared stylesheet entry (${ENTRY})`,
      'imports the package stylesheet or the reset itself — a second entry beside the shared one',
    ])
  })
})

/** The chrome laws' clean app: the styling base, with its one toaster. */
const TOASTER_HOME = 'apps/web/src/components/containers/Toaster.tsx'
const CHROME_BASE: Record<string, string> = {
  ...STYLING_BASE,
  [TOASTER_HOME]: 'export function ToasterMount() {\n  return <Toaster />\n}\n',
}

describe('chrome rule set', () => {
  test('a clean fixture has no findings', () => {
    const found = chromeLaws.scan(fixture(CHROME_BASE))
    for (const rule of chromeLaws.rules) expect(found[rule.id]).toEqual([])
  })

  test('one-toaster: a second `<Toaster`, or none, is found; a test may render its own (R20)', () => {
    const second = chromeLaws.scan(
      fixture({
        ...CHROME_BASE,
        'apps/web/src/components/islands/RollIsland.tsx':
          'const A = () => <>\n  <Toaster />\n</>\n',
        'apps/web/src/components/islands/__tests__/RollIsland.test.tsx': 'render(<Toaster />)\n',
        'apps/web/src/components/islands/Other.tsx': 'const B = () => <ToasterMount />\n',
      })
    )
    expect(second['one-toaster']?.map((f) => `${f.file}:${f.line}`)).toEqual([
      'apps/web/src/components/containers/Toaster.tsx:2',
      'apps/web/src/components/islands/RollIsland.tsx:2',
    ])
    const none = chromeLaws.scan(fixture(STYLING_BASE))
    expect(none['one-toaster']).toHaveLength(1)
  })

  test('offline-copy: the offline wording outside NotConnectedBanner is found (R20)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...CHROME_BASE,
        'apps/web/src/components/shared/NotConnectedBanner.tsx':
          "const M = 'Not connected — your Games are read-only until the connection returns'\n",
        'apps/web/src/components/shared/Lozenge.tsx': "const L = 'Read-only — not connected'\n",
        'apps/web/src/stores/backend.ts':
          "// prose may say not connected\nconst C = 'Your Games are read-only until the connection returns'\n",
        'apps/web/src/stores/fine.ts':
          "const F = 'Read-only for now'\nimport { NotConnectedBanner } from 'x'\n",
      })
    )
    expect(found['offline-copy']?.map((f) => `${f.file}:${f.line}`)).toEqual([
      'apps/web/src/components/shared/Lozenge.tsx:1',
      'apps/web/src/stores/backend.ts:2',
    ])
  })

  test('roll-tier: a roll-tier token in a style object, a stylesheet or a test is found (R20)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...CHROME_BASE,
        'apps/web/src/components/shared/Notice.tsx': 'const N = { color: color.rollFailure }\n',
        'apps/web/src/styles/build/notice.css': '.su-n { color: var(--color-roll-cascade); }\n',
        'apps/web/src/__tests__/tokens.test.ts': 'expect(color.rollNailed).toBe(1)\n',
        'apps/web/src/components/shared/Fine.tsx':
          '/* the bot paints rollSuccess */\nconst F = { color: color.statusWarn }\n',
      })
    )
    expect(found['roll-tier']?.map((f) => `${f.file}:${f.line}`).sort()).toEqual([
      'apps/web/src/__tests__/tokens.test.ts:1',
      'apps/web/src/components/shared/Notice.tsx:1',
      'apps/web/src/styles/build/notice.css:1',
    ])
  })

  test('ground-signal: every ground prop, and data-ground off a frame, is found (R19)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/components/A.tsx': [
          '<Chips chips={c} onInk={paint.ink} />',
          '<Segmented label="Showing" ground="ink" />',
          "  ground?: 'paper' | 'ink'",
          '<Button variant="ghost" surface="ink" />',
          "const SURFACE: StampSurface = 'on-ink'",
          '<Stat label="SP" inverse={true} />',
          '<div data-ground="ink" />',
          '<CloseButton onPaper />',
          '  onPaper?: boolean',
          '<SignInControl onDark />',
          'export function inlineCode(onPaper = false): CSSProperties {',
          '<div data-grain={g} className="background" />',
          "const ground = band ? 'ink' : 'paper'",
          '// an `onInk` prop is banned; so is ground="ink"',
          '',
        ].join('\n'),
        'apps/web/src/components/entity/parts/Head.tsx': '<div data-ground="ink" />\n',
        'apps/web/src/components/__tests__/A.test.tsx': '<Chips onInk />\n',
      })
    )
    expect(found['ground-signal']?.map((f) => `${f.file}:${f.line}`)).toEqual([
      'apps/web/src/components/A.tsx:1',
      'apps/web/src/components/A.tsx:2',
      'apps/web/src/components/A.tsx:3',
      'apps/web/src/components/A.tsx:4',
      'apps/web/src/components/A.tsx:5',
      'apps/web/src/components/A.tsx:6',
      'apps/web/src/components/A.tsx:7',
      'apps/web/src/components/A.tsx:8',
      'apps/web/src/components/A.tsx:9',
      'apps/web/src/components/A.tsx:10',
    ])
  })

  test('paper-mix: paper faded by color-mix is found in CSS and style objects; tokens and tints are not', () => {
    const found = chromeLaws.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/partials/x.css': [
          '.a { color: color-mix(in oklab, var(--color-paper) 60%, transparent); }',
          '.b { color: var(--color-paper-60); }',
          '.c { background: color-mix(in srgb, var(--color-pilot) 25%, var(--color-paper)); }',
          '.d { border-color: color-mix(in oklab, currentcolor 40%, transparent); }',
          '',
        ].join('\n'),
        'apps/web/src/components/A.tsx': [
          `const T = { backgroundColor: \`color-mix(in oklab, $\{color.paper} 20%, transparent)\` }`,
          "const U = { borderColor: 'color-mix(in oklab, transparent, var(--color-paper) 55%)' }",
          'const V = { backgroundColor: color.paper15 }',
          '',
        ].join('\n'),
      })
    )
    expect(found['paper-mix']?.map((f) => `${f.file}:${f.line}`)).toEqual([
      'apps/web/src/components/A.tsx:1',
      'apps/web/src/components/A.tsx:2',
      'apps/web/src/styles/partials/x.css:1',
    ])
  })

  test('focus-ring: every variant beside the one ring is found; the ring, a moved skip link and a sibling are not (R28)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/partials/focus.css': [
          '.a:focus-visible { outline: 2px solid var(--color-ink); outline-offset: -4px; }',
          '.b:hover,',
          '.b:focus-visible { color: var(--color-rust); }',
          '.c:focus-within { outline-style: dashed; }',
          '.d:focus { border-color: var(--color-ink); }',
          '.bar .su-btn:focus-visible { outline-color: var(--color-paper); }',
          '.ring:focus-visible { outline: 3px solid transparent; box-shadow: var(--focus-ring-shadow); }',
          '.frame:has(> .link:focus-visible) { box-shadow: var(--focus-ring-shadow); }',
          '.skip:focus { left: 8px; outline: 3px solid transparent; box-shadow: var(--focus-ring-shadow); }',
          '.field:focus ~ .label { top: 0; color: var(--color-ink); }',
          '@media (pointer: coarse) {',
          '  .e:focus-visible { text-decoration-thickness: 2px; }',
          '}',
          '',
        ].join('\n'),
      })
    )
    expect(found['focus-ring']?.map((f) => `${f.line} ${f.detail}`)).toEqual([
      '1 .a:focus-visible { outline: 2px solid var(--color-ink) }',
      '1 .a:focus-visible { outline-offset: -4px }',
      '2 .b:hover, .b:focus-visible { color: var(--color-rust) }',
      '4 .c:focus-within { outline-style: dashed }',
      '5 .d:focus { border-color: var(--color-ink) }',
      '6 .bar .su-btn:focus-visible { outline-color: var(--color-paper) }',
      '12 .e:focus-visible { text-decoration-thickness: 2px }',
    ])
  })

  test('dialog-width: a cap on a dialog, modal or popup is found; its parts and other caps are not (R24)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/build/dialogs.css': [
          '.su-share-dialog { max-width: 36rem; }',
          '.su-x, .su-repair-modal { padding: 4px; max-width: 24rem; }',
          '@media (width >= 40rem) {',
          '  .su-play-popup--narrow { max-inline-size: 28rem; }',
          '}',
          "[role='dialog'] { max-width: 80vw; }",
          '.su-share-dialog__body { max-width: 30rem; }',
          '.su-share-dialog .su-qr { max-width: 12rem; }',
          '.su-card { max-width: 40rem; }',
          '.su-entity-dialog { padding: var(--space-12); }',
          '',
        ].join('\n'),
      })
    )
    expect(found['dialog-width']?.map((f) => `${f.line} ${f.detail}`)).toEqual([
      '1 .su-share-dialog { max-width: 36rem }',
      '2 .su-x, .su-repair-modal { max-width: 24rem }',
      '4 .su-play-popup--narrow { max-inline-size: 28rem }',
      "6 [role='dialog'] { max-width: 80vw }",
    ])
  })

  test('one component per chrome role: raw fields, labels, trails and steppers off their homes (R16)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/build/A.tsx': [
          '<input aria-label="New fact" />',
          '<textarea',
          '  rows={2}',
          '  onChange={(e) => set(e.target.value)}',
          '/>',
          '<input ref={file} type="file" accept="image/*" />',
          '<label htmlFor={id}>In:</label>',
          '<nav aria-label="Breadcrumb">',
          "<button aria-current={i === active ? 'step' : undefined} />",
          'const HYDRATES = /<button\\b|<input\\b|<textarea\\b/',
          '// a raw <input /> and <label> in prose',
          '',
        ].join('\n'),
        'apps/web/src/components/atoms/inputs.tsx':
          '<input className="su-text-input" />\n<label />\n',
        'apps/web/src/components/atoms/BreadcrumbTrail.tsx': '<nav aria-label="Breadcrumb">\n',
        'apps/web/src/build/wizard/WizShell.tsx':
          "<button aria-current={a ? 'step' : undefined} />\n",
        'apps/web/src/build/__tests__/A.test.tsx': '<input />\n<label />\n',
      })
    )
    const at = (id: string) => found[id]?.map((f) => `${f.file}:${f.line}`)
    expect(at('raw-field')).toEqual(['apps/web/src/build/A.tsx:1', 'apps/web/src/build/A.tsx:2'])
    expect(at('raw-label')).toEqual(['apps/web/src/build/A.tsx:7'])
    expect(at('breadcrumb-nav')).toEqual(['apps/web/src/build/A.tsx:8'])
    expect(at('step-current')).toEqual(['apps/web/src/build/A.tsx:9'])
  })

  test('button-href: the button recipe is called only in Button, Toggle and HeaderMenu (R16)', () => {
    const found = chromeLaws.scan(
      fixture({
        ...CHROME_BASE,
        'apps/web/src/play/A.tsx': [
          "<AppLink href={h} className={buttonVariants({ size: 'mini' })}>Open</AppLink>",
          "const CLASS = buttonVariants({ variant: 'primary' })",
          '// the old buttonVariants({}) spread, in prose',
          '<Button href={h} size="mini">Open</Button>',
          '',
        ].join('\n'),
        'apps/web/src/components/atoms/Button.tsx': 'cn(buttonVariants({ variant }), c)\n',
        'apps/web/src/components/atoms/Toggle.tsx': 'cn(buttonVariants({ size }), c)\n',
        'apps/web/src/components/containers/HeaderMenu.tsx': 'buttonVariants({ size })\n',
        'apps/web/src/play/__tests__/A.test.tsx': 'buttonVariants({ size })\n',
      })
    )
    expect(found['button-href']?.map((f) => `${f.file}:${f.line}`)).toEqual([
      'apps/web/src/play/A.tsx:1',
      'apps/web/src/play/A.tsx:2',
    ])
  })

  test('stat-text: JSX text of a stat label before an expression is found, outside Stat (R36)', () => {
    const lines = (rel: string, text: string) => statTextFindings(rel, text).map((f) => f.line)
    expect(
      lines(
        'apps/web/src/build/A.tsx',
        [
          '<span>SP {sp}</span>',
          '<p>HP: {hp}/{max}</p>',
          '<p>Structure Points: <strong>{n}</strong></p>',
          '<p>{n} Hit Points</p>',
          '<Stat label="SP" value={sp} />',
          'const label = `SP $' + '{sp}`',
          '  SP: { short: "SP" },',
          '<p>SPACE {x}</p>',
        ].join('\n')
      )
    ).toEqual([1, 2, 3])
    expect(lines('apps/web/src/components/atoms/Stat.tsx', '<span>SP {sp}</span>')).toEqual([])
  })
})

describe('class-prefix rule set', () => {
  test('a clean fixture has no findings', () => {
    const found = classPrefix.scan(
      fixture({ 'apps/web/src/styles/build/a.css': '.su-a, .su-b:hover { color: red }\n' })
    )
    expect(found['class-prefix']).toEqual([])
  })

  test('a class without the su- prefix is found, nested ones included, in every stylesheet', () => {
    const found = classPrefix.scan(
      fixture({
        'apps/web/src/styles/build/wizard.css':
          '/* .wiz-old in a comment is prose */\n.su-wiz-ok, .wiz-pill:hover { color: red }\n@media (min-width: 40rem) {\n  .su-wiz-ok .npc-step { color: red }\n}\n',
        'apps/web/src/styles/theme.css':
          ".sheet--pilot,\n.su-sheet--mech { --tone: red }\n@import 'x.css';\n",
        'apps/web/src/styles/pages.css': '.srd-page { color: red }\n',
      })
    )
    expect(found['class-prefix']?.map((f) => `${f.file}:${f.line} ${f.detail}`)).toEqual([
      'apps/web/src/styles/build/wizard.css:2 .wiz-pill is not a .su-* class',
      'apps/web/src/styles/build/wizard.css:4 .npc-step is not a .su-* class',
      'apps/web/src/styles/pages.css:1 .srd-page is not a .su-* class',
      'apps/web/src/styles/theme.css:1 .sheet--pilot is not a .su-* class',
    ])
  })
})

describe('srd-css rule set', () => {
  const entry = { [SRD_CSS_ENTRY]: "import '../styles/global.css'\n" }

  test('passes when only the entry imports css', () => {
    const found = srdCss.scan(
      fixture({ ...entry, 'apps/web/src/reference/pages/a.page.tsx': 'export {}\n' })
    )
    expect(found['srd-css-entry']).toEqual([])
  })

  test('a css import in an SSR module is found', () => {
    const found = srdCss.scan(
      fixture({ ...entry, 'apps/web/src/reference/pages/a.page.tsx': "import './a.css'\n" })
    )
    expect(found['srd-css-entry']?.[0]?.file).toBe('apps/web/src/reference/pages/a.page.tsx')
  })

  test('an entry that imports nothing is a finding, not a pass', () => {
    const found = srdCss.scan(fixture({ [SRD_CSS_ENTRY]: 'export {}\n' }))
    expect(found['srd-css-entry']?.[0]?.detail).toContain('imports no stylesheet')
  })

  test('a component a page reaches may not import css; one only the builder reaches may', () => {
    const found = srdCss.scan(
      fixture({
        ...entry,
        'apps/web/src/reference/pages/a.page.tsx': "import { A } from '../../components/A'\n",
        'apps/web/src/components/A.tsx': "import './a.css'\nimport { C } from './C'\n",
        'apps/web/src/components/C.tsx': "import './c.css'\n",
        'apps/web/src/components/A.test.tsx': "import './a.css'\n",
        'apps/web/src/components/B.tsx': "import './b.css'\n",
      })
    )
    expect(found['srd-css-entry']?.map((f) => f.file)).toEqual([
      'apps/web/src/components/A.tsx',
      'apps/web/src/components/C.tsx',
    ])
  })
})

describe('tone-ground rule set', () => {
  const gear = (techLevel: number | string) => ({
    id: `id-${techLevel}`,
    name: `TL ${techLevel}`,
    techLevel,
  })
  /** Every pending schema present and still on the ramp, so only the case under test fires. */
  const pending = Object.fromEntries(
    Object.keys(PENDING_TL_GROUNDS).map((schema) => [
      `${DATA_DIR}/${schema}.json`,
      JSON.stringify([gear(1)]),
    ])
  )

  test('systems and modules may paint the TL ground the book heads them in', () => {
    const root = fixture({
      ...pending,
      [`${DATA_DIR}/systems.json`]: JSON.stringify([gear(1), gear(6), gear('B'), gear('N')]),
      [`${DATA_DIR}/modules.json`]: JSON.stringify([gear(3)]),
    })
    expect(toneGround.scan(root)['tl-ground']).toEqual([])
  })

  test('a schema off the pending list that paints a TL ground fails, on its entity line', () => {
    const root = fixture({
      ...pending,
      // An unlisted schema with a tech level falls through to the ramp.
      [`${DATA_DIR}/widgets.json`]: '[\n  {"id": "w1", "name": "Widget", "techLevel": 2}\n]',
    })
    expect(toneGround.scan(root)['tl-ground']).toEqual([
      {
        file: `${DATA_DIR}/widgets.json`,
        line: 2,
        detail: 'widgets "Widget" paints its header on --color-tl-2',
      },
    ])
  })

  test('a pending schema that no longer paints a TL ground fails as stale', () => {
    const root = fixture({
      ...pending,
      [`${DATA_DIR}/drones.json`]: JSON.stringify([{ id: 'd', name: 'No TL' }]),
    })
    const found = toneGround.scan(root)['tl-ground'] ?? []
    expect(found.map((f) => f.detail)).toEqual([
      'PENDING_TL_GROUNDS.drones is stale: no drones header paints a TL ground now',
    ])
  })

  test('an ink-banner entity is never toned', () => {
    const root = fixture({
      ...pending,
      [`${DATA_DIR}/systems.json`]: JSON.stringify([{ ...gear(2), actionSource: 'x' }]),
    })
    expect(toneGround.scan(root)['tl-ground']).toEqual([])
  })
})
