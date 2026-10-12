import { describe, expect, test } from 'bun:test'
import type { Workspace } from '../lib/workspaceGraph'
import { readWorkspaces, selectWorkspaces } from '../lib/workspaceGraph'

const GRAPH: Workspace[] = [
  { dir: 'packages/data', name: 'data', deps: [] },
  { dir: 'packages/ui', name: 'ui', deps: ['data'] },
  { dir: 'apps/site', name: 'site', deps: ['ui'] },
  { dir: 'apps/bot', name: 'bot', deps: ['data'] },
  { dir: 'apps/worker', name: 'worker', deps: [] },
  { dir: 'tools', name: 'tools', deps: [] },
]
const ALL = ['bot', 'data', 'site', 'tools', 'ui', 'worker']

describe('selectWorkspaces', () => {
  test('an app edit runs that app and tools', () => {
    expect(selectWorkspaces(['apps/worker/src/index.ts'], GRAPH)).toEqual(['tools', 'worker'])
  })

  test('a package edit pulls in its dependents, transitively', () => {
    expect(selectWorkspaces(['packages/ui/src/Card.tsx'], GRAPH)).toEqual(['site', 'tools', 'ui'])
    expect(selectWorkspaces(['packages/data/lib/x.ts'], GRAPH)).toEqual([
      'bot',
      'data',
      'site',
      'tools',
      'ui',
    ])
  })

  test('a workspace manifest edit selects like its source', () => {
    expect(selectWorkspaces(['apps/bot/package.json'], GRAPH)).toEqual(['bot', 'tools'])
  })

  test('shared preloads, the root bunfig and the root manifests run everything', () => {
    for (const file of ['test/happydom.ts', 'bunfig.toml', 'package.json', 'bun.lock']) {
      expect(selectWorkspaces(['apps/worker/a.ts', file], GRAPH)).toEqual(ALL)
    }
  })

  test('a file outside every workspace runs the gates alone', () => {
    const withGates = [...GRAPH, { dir: 'packages/gates', name: 'gates', deps: [] }]
    expect(selectWorkspaces(['biome.jsonc'], withGates)).toEqual(['gates', 'tools'])
    expect(selectWorkspaces(['.github/workflows/ci.yml', 'docs/README.md'], GRAPH)).toEqual([
      'tools',
    ])
  })

  test('a prefix of a workspace dir is not that workspace', () => {
    expect(selectWorkspaces(['apps/sitemap.ts'], GRAPH)).toEqual(['tools'])
  })

  test('no changes run nothing; no base runs everything', () => {
    expect(selectWorkspaces([], GRAPH)).toEqual([])
    expect(selectWorkspaces(null, GRAPH)).toEqual(ALL)
  })
})

describe('readWorkspaces, against this repo', () => {
  const graph = readWorkspaces()

  test('finds every workspace, tools and gates included', () => {
    expect(graph.map((ws) => ws.dir)).toContain('tools')
    expect(graph.map((ws) => ws.dir)).toContain('packages/gates')
    expect(graph.map((ws) => ws.dir)).toContain('packages/salvageunion-reference')
    expect(graph.length).toBeGreaterThanOrEqual(8)
  })

  test('reads the workspace: edges', () => {
    const deps = (name: string) => graph.find((ws) => ws.name === name)?.deps
    expect(deps('component-lib')).toContain('salvageunion-reference')
    expect(deps('srd')).toEqual(expect.arrayContaining(['component-lib', 'observability']))
  })

  test('a component-lib edit reaches both browser apps and the catalog but not the Workers', () => {
    const selected = selectWorkspaces(['packages/component-lib/src/index.ts'], graph)
    expect(selected).toEqual(['catalog', 'component-lib', 'gates', 'itun', 'srd', 'tools'])
  })

  test("an app's edit runs the catalog, whose story guard reads that app's stories", () => {
    expect(selectWorkspaces(['apps/itun/src/main.tsx'], graph)).toContain('catalog')
    expect(selectWorkspaces(['apps/srd/src/main.tsx'], graph)).toContain('catalog')
  })

  test('a salvageunion-reference edit reaches every consumer', () => {
    const selected = selectWorkspaces(['packages/salvageunion-reference/lib/index.ts'], graph)
    expect(selected).toEqual(
      expect.arrayContaining(['salvageunion-reference', 'component-lib', 'srd', 'itun'])
    )
    expect(selected).toContain('discord-bot')
    expect(selected).not.toContain('su-assets')
  })
})
