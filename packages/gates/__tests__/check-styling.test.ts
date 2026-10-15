import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { Finding, RuleSet } from '../lib/ruleEngine'
import { evaluate, formatFailures, increases, listFiles, ratchetCounts } from '../lib/ruleEngine'
import { classPrefix } from '../rules/classPrefix'
import { designTokens, fontSizePx, scanTokenSources } from '../rules/designTokens'
import { SRD_CSS_ENTRY, srdCss } from '../rules/srdCss'
import { stylingOwnership } from '../rules/stylingOwnership'
import { DATA_DIR, PENDING_TL_GROUNDS, toneGround } from '../rules/toneGround'

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

  test('every rule is zero, so the set keeps no baseline', () => {
    expect(designTokens.rules.filter((r) => r.mode !== 'zero').map((r) => r.id)).toEqual([])
    expect(ratchetCounts(designTokens, {})).toEqual({})
  })

  test('raw colour literals are found; issue refs and HTML entities are not', () => {
    const found = scan(
      'apps/cantina/src/x.tsx',
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
      'apps/cantina/src/x.tsx',
      "const a = '#ff0000' // design-tokens-ignore: brand\nconst b = '#00ff00'"
    )
    expect(found['raw-color']?.map((f) => f.line)).toEqual([2])
  })

  test('the token definition file is exempt from raw-color but not from other rules', () => {
    const found = scan(
      'packages/component-lib/src/styles/theme.css',
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
      'apps/cantina/src/x.tsx',
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
      'apps/cantina/src/x.tsx',
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
      'packages/component-lib/src/components/atoms/Button.tsx',
      'packages/component-lib/src/components/atoms/buttonVariants.ts',
      'packages/component-lib/src/components/atoms/InlineRef.tsx',
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
      'apps/cantina/src/components/dashboard/MajorFrame.tsx',
      'apps/cantina/src/styles/dashboard/instruments.css',
      'packages/component-lib/src/components/atoms/Button.tsx',
      'packages/component-lib/src/components/atoms/KofiButton.tsx',
      'packages/component-lib/src/components/atoms/buttonVariants.ts',
      'packages/component-lib/src/components/atoms/Field.tsx',
      'packages/component-lib/src/components/atoms/inputs.tsx',
      'packages/component-lib/src/components/atoms/SearchField.tsx',
      'packages/component-lib/src/components/atoms/Tooltip.tsx',
      'packages/component-lib/src/entity/PeekCard.tsx',
    ]) {
      expect(scan(file, ref)['texture-placement']?.length, file).toBe(2)
    }
    const onPaper = scan(
      'packages/component-lib/src/components/atoms/BandTitle.tsx',
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
      'packages/component-lib/src/components/atoms/BandTitle.tsx',
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
    expect(scan('apps/cantina/src/x.tsx', text)['cool-ground']?.map((f) => f.detail)).toEqual([
      'bg-wk-bg-2',
      'bg-wk-bg-2',
      'border-wk-bg-2',
      '--color-wk-bg-2',
      'wkBg2',
    ])
    expect(scan('apps/cantina/src/styles/print.css', text)['cool-ground']).toEqual([])
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

const ENTRY = 'packages/component-lib/src/styles/entry.css'

const STYLING_BASE: Record<string, string> = {
  [ENTRY]:
    "@layer su-reset, su-base;\n@import './theme.css';\n@import './reset.css' layer(su-reset);\n@import './index.css' layer(su-base);\n",
  'apps/cantina/src/index.css': "@import 'component-lib/styles/entry.css';\n",
  'apps/web/src/styles/global.css': "@import 'component-lib/styles/entry.css';\n",
  'apps/cantina/src/styles/dashboard/DashboardCanvas.css': '.su-dash-used { color: red }\n',
  'apps/cantina/src/styles/dashboard/DashboardGrid.css': '',
  'apps/cantina/src/styles/dashboard/instruments.css': '',
  'apps/cantina/src/styles/dashboard/DashboardPhone.css': '',
  'apps/cantina/src/components/dashboard/Thing.tsx':
    'export const T = () => <div className="su-dash-used" />\n',
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
    ]) {
      expect(found[id]).toEqual([])
    }
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
        'packages/component-lib/package.json': JSON.stringify(
          { dependencies: { clsx: '2.1.1', 'tailwind-merge': '3.0.0' } },
          null,
          2
        ),
        'apps/cantina/package.json': JSON.stringify(
          { devDependencies: { '@tailwindcss/vite': '4.1.0' } },
          null,
          2
        ),
        'packages/component-lib/src/styles/index.css':
          '/* @apply in a comment is prose */\n.su-x { color: red }\n@layer utilities {\n  .flex { display: flex }\n}\n',
        'apps/web/src/styles/global.css':
          "@import 'component-lib/styles/entry.css';\n@source '../src';\n.su-y {\n  @apply flex;\n}\n",
      })
    )
    expect(found['no-tailwind']?.map((f) => `${f.file}:${f.line} ${f.detail}`)).toEqual([
      "package.json:3 devDependencies declares 'tailwindcss'",
      "apps/cantina/package.json:3 devDependencies declares '@tailwindcss/vite'",
      "packages/component-lib/package.json:4 dependencies declares 'tailwind-merge'",
      "tools/package.json:3 devDependencies declares '@tailwindcss/cli'",
      "apps/web/src/styles/global.css:2 Tailwind directive '@source'",
      "apps/web/src/styles/global.css:4 Tailwind directive '@apply'",
      "packages/component-lib/src/styles/index.css:3 Tailwind directive '@layer utilities'",
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
        'apps/cantina/src/styles/dashboard/DashboardGrid.css': '.su-dash-dead { color: red }\n',
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
        'packages/component-lib/src/A.tsx': [
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
      'packages/component-lib/src/A.tsx:1',
      'packages/component-lib/src/A.tsx:2',
    ])
  })

  test('a consumer that imports the package stylesheet itself is a second entry', () => {
    const found = stylingOwnership.scan(
      fixture({
        ...STYLING_BASE,
        'apps/web/src/styles/global.css': "@import 'component-lib/styles/index.css';\n",
      })
    )
    expect(found['package-stylesheet-import']?.map((f) => f.detail)).toEqual([
      `does not import the shared stylesheet entry (${ENTRY})`,
      'imports the package stylesheet or the reset itself — a second entry beside the shared one',
    ])
  })
})

describe('class-prefix rule set', () => {
  test('a clean fixture has no findings', () => {
    const found = classPrefix.scan(
      fixture({ 'apps/cantina/src/styles/a.css': '.su-a, .su-b:hover { color: red }\n' })
    )
    expect(found['class-prefix']).toEqual([])
  })

  test('a package or the Cantina class without the su- prefix is found, nested ones included; srd is out of scope', () => {
    const found = classPrefix.scan(
      fixture({
        'apps/cantina/src/styles/wizard.css':
          '/* .wiz-old in a comment is prose */\n.su-wiz-ok, .wiz-pill:hover { color: red }\n@media (min-width: 40rem) {\n  .su-wiz-ok .npc-step { color: red }\n}\n',
        'packages/component-lib/src/styles/theme.css':
          ".sheet--pilot,\n.su-sheet--mech { --tone: red }\n@import 'x.css';\n",
        'apps/web/src/styles/pages.css': '.srd-page { color: red }\n',
      })
    )
    expect(found['class-prefix']?.map((f) => `${f.file}:${f.line} ${f.detail}`)).toEqual([
      'apps/cantina/src/styles/wizard.css:2 .wiz-pill is not a .su-* class',
      'apps/cantina/src/styles/wizard.css:4 .npc-step is not a .su-* class',
      'packages/component-lib/src/styles/theme.css:1 .sheet--pilot is not a .su-* class',
    ])
  })
})

describe('srd-css rule set', () => {
  const entry = { [SRD_CSS_ENTRY]: "import '../styles/global.css'\n" }

  test('passes when only the entry imports css', () => {
    const found = srdCss.scan(fixture({ ...entry, 'apps/web/src/pages/a.page.tsx': 'export {}\n' }))
    expect(found['srd-css-entry']).toEqual([])
    expect(found['lib-css-import']).toEqual([])
  })

  test('a css import in an SSR module is found', () => {
    const found = srdCss.scan(
      fixture({ ...entry, 'apps/web/src/pages/a.page.tsx': "import './a.css'\n" })
    )
    expect(found['srd-css-entry']?.[0]?.file).toBe('apps/web/src/pages/a.page.tsx')
  })

  test('an entry that imports nothing is a finding, not a pass', () => {
    const found = srdCss.scan(fixture({ [SRD_CSS_ENTRY]: 'export {}\n' }))
    expect(found['srd-css-entry']?.[0]?.detail).toContain('imports no stylesheet')
  })

  test('component-lib may not import css, except from tests', () => {
    const found = srdCss.scan(
      fixture({
        ...entry,
        'packages/component-lib/src/A.tsx': "import './a.css'\n",
        'packages/component-lib/src/A.test.tsx': "import './a.css'\n",
        'packages/component-lib/src/__tests__/B.tsx': "import './b.css'\n",
      })
    )
    expect(found['lib-css-import']?.map((f) => f.file)).toEqual([
      'packages/component-lib/src/A.tsx',
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
