import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readWorkspaces } from '../lib/workspaceGraph'

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
})

describe('readWorkspaces, against a fixture root', () => {
  const root = mkdtempSync(join(tmpdir(), 'workspace-graph-'))

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  const manifest = (dir: string, pkg: object) => {
    mkdirSync(join(root, dir), { recursive: true })
    writeFileSync(join(root, dir, 'package.json'), JSON.stringify(pkg))
  }
  manifest('packages/data', { name: 'data' })
  manifest('apps/site', {
    name: 'site',
    dependencies: { data: 'workspace:*', react: '19.0.0' },
  })
  manifest('tools', { name: 'tools', devDependencies: { data: 'workspace:*' } })
  // A directory with no manifest is not a workspace.
  mkdirSync(join(root, 'apps/scratch'), { recursive: true })

  test('discovers workspaces under the root it is given, tools last', () => {
    expect(readWorkspaces(root)).toEqual([
      { dir: 'apps/site', name: 'site', deps: ['data'] },
      { dir: 'packages/data', name: 'data', deps: [] },
      { dir: 'tools', name: 'tools', deps: ['data'] },
    ])
  })
})
