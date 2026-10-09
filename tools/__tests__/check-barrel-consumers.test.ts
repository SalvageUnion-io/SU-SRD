import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import type { BarrelExport, StoryIndex } from '../check-barrel-consumers'
import {
  census,
  explain,
  judge,
  metaTitle,
  namesImportedFromLib,
  parseBarrel,
  storyFor,
} from '../check-barrel-consumers'

/**
 * `tools/check-barrel-consumers.ts` gates merges, so its parsing and its
 * verdicts are pinned here: a regex that matched nothing would pass a barrel
 * full of one app's compositions.
 */

describe('parseBarrel', () => {
  test('reads named, type, aliased and namespace re-exports, not comments', () => {
    const source = [
      "export { Badge } from './components/chrome/Badge'",
      "export type { BadgeTone } from './components/chrome/Badge'",
      'export {',
      '  FOCUS_RING,',
      '  type Ring,',
      '  INPUT_FOCUS as FOCUS_INPUT,',
      "} from './components/chrome/interaction'",
      "export * as tokens from './design/tokens'",
      "// export { Gone } from './components/shared/Gone'",
    ].join('\n')
    expect(parseBarrel(source)).toEqual([
      { name: 'Badge', specifier: './components/chrome/Badge' },
      { name: 'BadgeTone', specifier: './components/chrome/Badge' },
      { name: 'FOCUS_RING', specifier: './components/chrome/interaction' },
      { name: 'Ring', specifier: './components/chrome/interaction' },
      { name: 'FOCUS_INPUT', specifier: './components/chrome/interaction' },
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

describe('metaTitle', () => {
  test('reads the default-export title, not a title in a story body', () => {
    const source = [
      "const card = { title: 'Cargo Hold' }",
      "export default { title: 'Atoms/Stat' }",
    ].join('\n')
    expect(metaTitle(source)).toBe('Atoms/Stat')
    expect(metaTitle("const x = { title: 'Nope' }")).toBeNull()
  })
})

const lib = 'packages/component-lib/src/components'
const story = (
  title: string | null,
  imports: string[],
  names: string[] = []
): { title: string | null; imports: string[]; names: string[] } => ({ title, imports, names })

describe('storyFor', () => {
  const stories: StoryIndex = new Map([
    [`${lib}/chrome/Field.stories.tsx`, story('Atoms/Field', [], ['Field', 'Textarea'])],
    [`${lib}/shared/Wiz.stories.tsx`, story('Compositions/Wizard/Wiz', [`${lib}/shared/Wiz.tsx`])],
    [`${lib}/shared/Other.stories.tsx`, story('Atoms/Other', [`${lib}/shared/Wiz.tsx`])],
  ])

  test('prefers the story named for the export', () => {
    expect(storyFor({ name: 'Wiz', module: `${lib}/shared/Wiz.tsx` }, stories)?.title).toBe(
      'Compositions/Wizard/Wiz'
    )
  })

  test('finds a story that imports the export through a sibling module', () => {
    expect(storyFor({ name: 'Textarea', module: `${lib}/chrome/inputs.tsx` }, stories)?.title).toBe(
      'Atoms/Field'
    )
  })

  test('a story in another directory does not classify an export', () => {
    expect(storyFor({ name: 'Helper', module: `${lib}/stat/helper.ts` }, stories)).toBeNull()
  })
})

describe('judge', () => {
  const exports: BarrelExport[] = [
    { name: 'Button', module: `${lib}/chrome/Button.tsx` },
    { name: 'Avatar', module: `${lib}/chrome/Avatar.tsx` },
    { name: 'WizShell', module: `${lib}/shared/WizShell.tsx` },
    { name: 'heat', module: `${lib}/stat/heat.ts` },
    { name: 'orphan', module: `${lib}/stat/orphan.ts` },
  ]
  const stories: StoryIndex = new Map([
    [`${lib}/chrome/Button.stories.tsx`, story('Atoms/Button', [`${lib}/chrome/Button.tsx`])],
    [`${lib}/chrome/Avatar.stories.tsx`, story('Atoms/Avatar', [`${lib}/chrome/Avatar.tsx`])],
    [
      `${lib}/shared/WizShell.stories.tsx`,
      story('Compositions/Wizard/Wiz Shell', [`${lib}/shared/WizShell.tsx`]),
    ],
  ])
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

  test('fails a single-app composition, an unused export and a storyless helper', () => {
    const { verdicts, stale } = judge(exports, reach, direct, stories, {})
    expect(verdicts).toEqual([
      {
        kind: 'composition',
        name: 'WizShell',
        app: 'itun',
        module: `${lib}/shared/WizShell.tsx`,
        title: 'Compositions/Wizard/Wiz Shell',
      },
      { kind: 'unclassified', name: 'heat', app: 'itun', module: `${lib}/stat/heat.ts` },
      { kind: 'unused', name: 'orphan' },
    ])
    expect(stale).toEqual([])
  })

  test('a single-app primitive passes; a listed helper passes; a stale listing fails', () => {
    const { verdicts, stale } = judge(
      exports.filter((e) => e.name !== 'WizShell' && e.name !== 'orphan'),
      reach,
      direct,
      stories,
      { heat: 'the gauge reads it', Button: 'two apps render it' }
    )
    expect(verdicts).toEqual([])
    expect(stale).toEqual(['Button'])
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
        title: 'Compositions/W',
      })
    ).toEqual([
      "✗ Wiz (m): only itun renders it, and its story files it under 'Compositions/W'.",
      "  → Move it, its story and its tests into apps/itun/src/components/: a composition one app renders is that app's.",
    ])
    expect(explain({ kind: 'unclassified', name: 'heat', app: 'srd', module: 'm' })[1]).toContain(
      'apps/srd/src/'
    )
  })
})

describe('census of this repository', () => {
  const repo = census()

  test('reads the barrel, both consuming apps and the stories', () => {
    expect(repo.workspaces).toEqual(['apps/itun', 'apps/srd'])
    expect(repo.exports.length).toBeGreaterThan(60)
    expect(repo.scanned).toBeGreaterThan(270)
    expect(repo.stories.size).toBeGreaterThan(40)
  })

  test('reach is transitive: srd reaches Card through ReferenceEntityCard', () => {
    expect(repo.direct.get('Card')).toEqual(new Set(['itun']))
    expect(repo.reach.get('Card')).toEqual(new Set(['itun', 'srd']))
  })

  test('has no failing verdict and no stale SINGLE_APP entry', () => {
    expect(judge(repo.exports, repo.reach, repo.direct, repo.stories)).toEqual({
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
