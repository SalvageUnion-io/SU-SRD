import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { BarrelExport } from '../check-barrel-consumers'
import {
  census,
  explain,
  groupOf,
  judge,
  main,
  namesImportedFromLib,
  parseBarrel,
} from '../check-barrel-consumers'
import { captured } from './fixtureTree'

/**
 * `tools/check-barrel-consumers.ts` gates merges, so its parsing and its
 * verdicts are pinned here: a regex that matched nothing would pass a barrel
 * full of one app's compositions.
 */

describe('parseBarrel', () => {
  test('reads named, type, aliased and namespace re-exports, not comments', () => {
    const source = [
      "export { Badge } from './components/atoms/Badge'",
      "export type { BadgeTone } from './components/atoms/Badge'",
      'export {',
      '  FOCUS_RING,',
      '  type Ring,',
      '  INPUT_FOCUS as FOCUS_INPUT,',
      "} from './components/atoms/interaction'",
      "export * as tokens from './design/tokens'",
      "// export { Gone } from './components/shared/Gone'",
    ].join('\n')
    expect(parseBarrel(source)).toEqual([
      { name: 'Badge', specifier: './components/atoms/Badge' },
      { name: 'BadgeTone', specifier: './components/atoms/Badge' },
      { name: 'FOCUS_RING', specifier: './components/atoms/interaction' },
      { name: 'Ring', specifier: './components/atoms/interaction' },
      { name: 'FOCUS_INPUT', specifier: './components/atoms/interaction' },
      { name: 'tokens', specifier: './design/tokens' },
    ])
  })
})

describe('namesImportedFromLib', () => {
  test('reads the root import only, with type and aliased bindings', () => {
    const source = [
      "import { Button, type ButtonProps, Stat as S } from 'component-lib'",
      "import type { CardFootMeta } from 'component-lib'",
      "import { color } from 'component-lib/design/tokens'",
      "// import { Gone } from 'component-lib'",
    ].join('\n')
    expect(namesImportedFromLib(source)).toEqual(['Button', 'ButtonProps', 'Stat', 'CardFootMeta'])
  })
})

const lib = 'packages/component-lib/src'

describe('groupOf', () => {
  test("a component is filed under its directory's group", () => {
    expect(groupOf(`${lib}/components/atoms/Button.tsx`)).toBe('Atoms')
    expect(groupOf(`${lib}/components/containers/Inset.tsx`)).toBe('Containers')
    expect(groupOf(`${lib}/components/compositions/WizShell.tsx`)).toBe('Compositions')
    expect(groupOf(`${lib}/markdownSection/MarkdownSection.tsx`)).toBe('Containers')
  })

  test('a .ts module, or one outside the group directories, is unclassified', () => {
    expect(groupOf(`${lib}/components/atoms/heatLevel.ts`)).toBeNull()
    expect(groupOf(`${lib}/components/referenceEntity/useDetailModal.tsx`)).toBeNull()
  })
})

describe('judge', () => {
  const exports: BarrelExport[] = [
    { name: 'Button', module: `${lib}/components/atoms/Button.tsx` },
    { name: 'Avatar', module: `${lib}/components/atoms/Avatar.tsx` },
    { name: 'WizShell', module: `${lib}/components/compositions/WizShell.tsx` },
    { name: 'heat', module: `${lib}/components/atoms/heat.ts` },
    { name: 'orphan', module: `${lib}/components/atoms/orphan.ts` },
  ]
  const apps = (...a: string[]) => new Set(a)
  const reach = new Map([
    ['Button', apps('itun', 'srd')],
    ['Avatar', apps('itun')],
    ['WizShell', apps('itun')],
    ['heat', apps('itun')],
    ['orphan', apps()],
  ])
  const direct = new Map([
    ['Button', apps('srd')],
    ['Avatar', apps('itun')],
    ['WizShell', apps('itun')],
    ['heat', apps('itun')],
    ['orphan', apps()],
  ])

  test('fails a single-app composition, an unused export and an unclassified helper', () => {
    const { verdicts, stale } = judge(exports, reach, direct, {})
    expect(verdicts).toEqual([
      {
        kind: 'composition',
        name: 'WizShell',
        app: 'itun',
        module: `${lib}/components/compositions/WizShell.tsx`,
        group: 'Compositions',
      },
      {
        kind: 'unclassified',
        name: 'heat',
        app: 'itun',
        module: `${lib}/components/atoms/heat.ts`,
      },
      { kind: 'unused', name: 'orphan' },
    ])
    expect(stale).toEqual([])
  })

  test('a single-app primitive passes; a listed helper passes; a stale listing fails', () => {
    const { verdicts, stale } = judge(
      exports.filter((e) => e.name !== 'WizShell' && e.name !== 'orphan'),
      reach,
      direct,
      { heat: 'the gauge reads it', Button: 'two apps render it' }
    )
    expect(verdicts).toEqual([])
    expect(stale).toEqual(['Button'])
  })

  const floors = { exports: 1, workspaces: 1, scanned: 1 }
  const read = (keep: (e: BarrelExport) => boolean) => () => ({
    exports: exports.filter(keep),
    reach,
    direct,
    workspaces: ['apps/itun', 'apps/srd'],
    scanned: 12,
  })

  test('main reports every verdict and stale listing with its fix, and fails', () => {
    const io = captured()
    const code = main(
      read(() => true),
      { allowed: { Gone: 'was listed' }, floors, ...io }
    )
    expect(code).toBe(1)
    expect(io.out).toEqual([])
    expect(io.err).toEqual([
      ...[
        {
          kind: 'composition',
          name: 'WizShell',
          app: 'itun',
          module: `${lib}/components/compositions/WizShell.tsx`,
          group: 'Compositions',
        },
        {
          kind: 'unclassified',
          name: 'heat',
          app: 'itun',
          module: `${lib}/components/atoms/heat.ts`,
        },
        { kind: 'unused', name: 'orphan' },
      ].map((v) => explain(v as Parameters<typeof explain>[0]).join('\n')),
      '✗ SINGLE_APP lists Gone, which is no longer an unclassified single-app export: remove it.',
    ])
  })

  test('main passes and counts the single-app exports when nothing fails', () => {
    const io = captured()
    const code = main(
      read((e) => e.name === 'Button' || e.name === 'Avatar'),
      { allowed: {}, floors, ...io }
    )
    expect(code).toBe(0)
    expect(io.out).toEqual([
      "✓ barrel consumers: 2 exports, 2 consuming workspaces (12 files); 1 single-app, none an app's composition.",
    ])
  })
})

describe('explain', () => {
  test('each failure names the export and its fix', () => {
    expect(explain({ kind: 'unused', name: 'orphan' })[1]).toContain('Unexport it')
    expect(
      explain({
        kind: 'composition',
        name: 'Wiz',
        app: 'itun',
        module: 'm',
        group: 'Compositions',
      })
    ).toEqual([
      "✗ Wiz (m): only itun renders it, and its directory files it under 'Compositions'.",
      "  → Move it and its tests into apps/itun/src/components/: a composition one app renders is that app's.",
    ])
    expect(explain({ kind: 'unclassified', name: 'heat', app: 'srd', module: 'm' })[1]).toContain(
      'apps/srd/src/'
    )
  })
})

describe('census of this repository', () => {
  const repo = census()

  test('reads the barrel and every consuming app', () => {
    expect(repo.workspaces).toEqual(['apps/discord-bot', 'apps/itun', 'apps/srd'])
    expect(repo.exports.length).toBeGreaterThan(60)
    expect(repo.scanned).toBeGreaterThan(270)
  })

  test('reach is transitive: srd reaches ControlButtons through the card it renders', () => {
    expect(repo.direct.get('ControlButtons')).toEqual(new Set(['itun']))
    expect(repo.reach.get('ControlButtons')).toEqual(new Set(['itun', 'srd']))
  })

  test('has no failing verdict and no stale SINGLE_APP entry', () => {
    expect(judge(repo.exports, repo.reach, repo.direct)).toEqual({
      verdicts: [],
      stale: [],
    })
  })
})

test('the repository passes', async () => {
  const proc = Bun.spawn(['bun', join(import.meta.dir, '..', 'check-barrel-consumers.ts')], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toMatch(/barrel consumers: \d+ exports/)
})
