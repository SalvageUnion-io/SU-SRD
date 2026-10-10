import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Finding, RuleSet } from '../lib/ruleEngine'
import { evaluate, formatFailures, increases, listFiles, ratchetCounts } from '../lib/ruleEngine'
import { fontSizePx, scanTokenSources } from '../rules/designTokens'
import { SRD_CSS_ENTRY, srdCss } from '../rules/srdCss'
import { stylingOwnership } from '../rules/stylingOwnership'

/**
 * `tools/check-styling.ts` gates merges on three rule sets. These tests pin the
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

  test('a ratchet fails when the count FALLS but the baseline was not lowered (PK-13)', () => {
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

  test('raw colour literals are found; issue refs and HTML entities are not', () => {
    const found = scan(
      'apps/itun/src/x.tsx',
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
      'apps/itun/src/x.tsx',
      "const a = '#ff0000' // design-tokens-ignore: brand\nconst b = '#00ff00'"
    )
    expect(found['raw-color']?.map((f) => f.line)).toEqual([2])
  })

  test('the token definition file is exempt from raw-color but not from other rules', () => {
    const found = scan(
      'packages/component-lib/src/styles/theme.css',
      '--color-x: #ff0000;\n.x { text-[13px] }'
    )
    expect(found['raw-color']).toEqual([])
    expect(found['arbitrary-font-size']?.length).toBe(1)
  })

  test('each zero rule matches the form it forbids', () => {
    const found = scan(
      'apps/srd/src/x.tsx',
      'bg-su-orange tracking-[0.1em] border-[3px] rounded-[4px] bg-white linear-gradient('
    )
    for (const id of [
      'shadow-tokens',
      'arbitrary-tracking',
      'arbitrary-border-width',
      'arbitrary-radius',
      'pure-white',
      'gradient',
    ]) {
      expect(found[id]?.length).toBe(1)
    }
  })

  test('type-floor: a retired rung by any name, or a literal under 11px, fails', () => {
    const found = scan(
      'apps/itun/src/x.tsx',
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
      'apps/itun/src/x.tsx',
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
      'apps/srd/src/x.tsx',
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
      'packages/component-lib/src/components/chrome/Button.tsx',
      'packages/component-lib/src/components/chrome/buttonVariants.ts',
      'packages/component-lib/src/components/chrome/InlineRef.tsx',
      'packages/component-lib/src/styles/theme.css',
    ]) {
      expect(scan(file, 'bg-rust var(--color-rust)')['rust-allowlist']).toEqual([])
    }
    const css = scan(
      'packages/component-lib/src/styles/index.css',
      "background: var(--color-rust); /* design-tokens-ignore: Button's rust */\nborder-color: var(--color-rust);"
    )
    expect(css['rust-allowlist']?.map((f) => f.line)).toEqual([2])
  })

  test('texture-placement: speckle is a finding on a forbidden surface or a paper ground', () => {
    const ref = "filter: 'url(#su-blot)', opacity: tokens.texture.blotOpacity"
    for (const file of [
      'apps/itun/src/components/dashboard/MajorFrame.tsx',
      'apps/itun/src/styles/dashboard/instruments.css',
      'packages/component-lib/src/components/chrome/Button.tsx',
      'packages/component-lib/src/components/shared/KofiButton.tsx',
      'packages/component-lib/src/components/chrome/buttonVariants.ts',
      'packages/component-lib/src/components/chrome/Field.tsx',
      'packages/component-lib/src/components/chrome/inputs.tsx',
      'packages/component-lib/src/components/shared/SearchField.tsx',
      'packages/component-lib/src/components/ui/tooltip.tsx',
      'packages/component-lib/src/components/referenceEntity/EntityTooltip.tsx',
    ]) {
      expect(scan(file, ref)['texture-placement']?.length, file).toBe(2)
    }
    const onPaper = scan(
      'packages/component-lib/src/components/chrome/BandTitle.tsx',
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
      'packages/component-lib/src/components/chrome/BandTitle.tsx',
      [
        '<div className="bg-mech"><svg><rect filter="url(#su-blot)" /></svg></div>',
        'const s = { backgroundColor: color.ink, opacity: tokens.texture.fleckOpacity }',
        "const t = { color: color.paper, filter: 'url(#su-fleck)' }", // paper TEXT, ink ground
      ].join('\n')
    )
    expect(found['texture-placement']).toEqual([])
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

const STYLING_BASE: Record<string, string> = {
  'packages/component-lib/src/styles/tailwind.css':
    "@layer theme, base, su-base, components, utilities;\n@import 'tailwindcss';\n@import './index.css' layer(su-base);\n",
  'packages/component-lib/src/styles/catalog.css': "@import './tailwind.css';\n",
  'apps/itun/src/index.css': "@import 'component-lib/styles/tailwind.css';\n",
  'apps/srd/src/styles/global.css': "@import 'component-lib/styles/tailwind.css';\n",
  'apps/itun/src/styles/dashboard/DashboardCanvas.css': '.pc-used { color: red }\n',
  'apps/itun/src/styles/dashboard/DashboardGrid.css': '',
  'apps/itun/src/styles/dashboard/instruments.css': '',
  'apps/itun/src/components/dashboard/Thing.tsx':
    'export const T = () => <div className="pc-used" />\n',
}

describe('styling rule set', () => {
  test('a clean fixture has no zero-rule findings', () => {
    const found = stylingOwnership.scan(fixture(STYLING_BASE))
    for (const id of [
      'app-theme',
      'dead-app-css',
      'pc-class-contract',
      'package-stylesheet-import',
    ]) {
      expect(found[id]).toEqual([])
    }
    expect(found['pc-class-defined']?.length).toBe(1)
  })

  test('an app @theme, dead app CSS and an undefined pc class are all found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/srd/src/styles/extra.css':
          '@theme {\n  --color-x: red;\n}\n.never-used { color: red }\n',
        'apps/srd/src/Page.tsx': 'export const P = () => <div className="pc-missing" />\n',
      })
    )
    expect(found['app-theme']?.length).toBe(2) // the @theme block and the reserved token inside it
    expect(found['dead-app-css']?.map((f) => f.detail)).toEqual([
      '.never-used defined but never referenced in app source',
    ])
    expect(found['pc-class-contract']?.map((f) => f.detail)[0]).toContain("'pc-missing'")
  })

  test('an unlayered package stylesheet import is found', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'packages/component-lib/src/styles/tailwind.css':
          "@import 'tailwindcss';\n@import './index.css';\n",
      })
    )
    expect(found['package-stylesheet-import']?.[0]?.detail).toContain('WITHOUT a cascade layer')
  })

  test('a consumer that compiles Tailwind itself is a second entry', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/srd/src/styles/global.css': "@import 'tailwindcss';\n",
      })
    )
    expect(found['package-stylesheet-import']?.map((f) => f.detail)).toEqual([
      'does not import the shared Tailwind entry (packages/component-lib/src/styles/tailwind.css)',
      "imports 'tailwindcss' itself — a second Tailwind entry beside the shared one",
    ])
  })

  test('a Tailwind utility in UI source is counted once per file, tests excluded', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/itun/src/A.tsx': 'export const A = () => <div className="flex items-center p-2" />\n',
        'apps/itun/src/A.test.tsx': 'expect("flex p-2")\n',
      })
    )
    expect(found['tailwind-utility-file']?.map((f) => f.file)).toEqual(['apps/itun/src/A.tsx'])
  })
})

describe('srd-css rule set', () => {
  const entry = { [SRD_CSS_ENTRY]: "import '../styles/global.css'\n" }

  test('passes when only the entry imports css', () => {
    const found = srdCss.scan(fixture({ ...entry, 'apps/srd/src/pages/a.page.tsx': 'export {}\n' }))
    expect(found['srd-css-entry']).toEqual([])
    expect(found['lib-css-import']).toEqual([])
  })

  test('a css import in an SSR module is found', () => {
    const found = srdCss.scan(
      fixture({ ...entry, 'apps/srd/src/pages/a.page.tsx': "import './a.css'\n" })
    )
    expect(found['srd-css-entry']?.[0]?.file).toBe('apps/srd/src/pages/a.page.tsx')
  })

  test('an entry that imports nothing is a finding, not a pass', () => {
    const found = srdCss.scan(fixture({ [SRD_CSS_ENTRY]: 'export {}\n' }))
    expect(found['srd-css-entry']?.[0]?.detail).toContain('imports no stylesheet')
  })

  test('component-lib may not import css, except from stories and tests', () => {
    const found = srdCss.scan(
      fixture({
        ...entry,
        'packages/component-lib/src/A.tsx': "import './a.css'\n",
        'packages/component-lib/src/A.stories.tsx': "import './a.css'\n",
        'packages/component-lib/src/stories/B.tsx': "import './b.css'\n",
      })
    )
    expect(found['lib-css-import']?.map((f) => f.file)).toEqual([
      'packages/component-lib/src/A.tsx',
    ])
  })
})
