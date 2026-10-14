import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { assertCoversWorkspaces, discoverWorkspaceDirs } from '../lib/workspaceCoverage'
import { Exited, trapExit } from './trapExit'

/** `assertCoversWorkspaces` exits the process on failure; `trapExit` turns that into a throw. */
const { errors } = trapExit()

const temps: string[] = []
afterAll(() => {
  for (const t of temps) rmSync(t, { recursive: true, force: true })
})

function tree(paths: string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'ws-cover-'))
  temps.push(root)
  for (const p of paths) {
    const full = join(root, p)
    if (p.endsWith('/')) mkdirSync(full, { recursive: true })
    else {
      mkdirSync(join(full, '..'), { recursive: true })
      writeFileSync(full, '{}')
    }
  }
  return root
}

describe('discoverWorkspaceDirs', () => {
  test('finds apps/* and packages/* that carry a manifest, sorted, and nothing else', () => {
    const root = tree([
      'packages/zeta/package.json',
      'apps/web/package.json',
      'apps/no-manifest/',
      'apps/stray-file.json',
      'packages/alpha/package.json',
      'other/thing/package.json',
      'tools/package.json',
    ])
    expect(discoverWorkspaceDirs(root)).toEqual(['apps/web', 'packages/alpha', 'packages/zeta'])
  })

  test('appends tools only when asked and only when it has a manifest', () => {
    const withTools = tree(['apps/web/package.json', 'tools/package.json'])
    expect(discoverWorkspaceDirs(withTools, { withTools: true })).toEqual(['apps/web', 'tools'])
    const bareTools = tree(['apps/web/package.json', 'tools/'])
    expect(discoverWorkspaceDirs(bareTools, { withTools: true })).toEqual(['apps/web'])
  })

  test('a root with neither apps/ nor packages/ yields nothing rather than throwing', () => {
    expect(discoverWorkspaceDirs(tree(['README/']))).toEqual([])
  })
})

describe('assertCoversWorkspaces (against this checkout)', () => {
  const workspaces = discoverWorkspaceDirs()

  test('the checkout has workspaces to account for', () => {
    expect(workspaces).toContain('packages/gates')
    expect(workspaces.length).toBeGreaterThan(3)
  })

  test('returns when every workspace is scanned', () => {
    expect(() => assertCoversWorkspaces('probe', workspaces)).not.toThrow()
    expect(errors).toEqual([])
  })

  test('a subdirectory or a glob beneath a workspace covers it; a trailing slash is ignored', () => {
    const [first, second, ...rest] = workspaces
    const scanned = [`${first}/src/**/*.tsx`, `${second}/`, ...rest.map((ws) => `${ws}/lib`)]
    expect(() => assertCoversWorkspaces('probe', scanned)).not.toThrow()
  })

  test('a name that merely shares a prefix does not cover a workspace', () => {
    const [first, ...rest] = workspaces
    expect(() => assertCoversWorkspaces('probe', [`${first}-extra/src`, ...rest])).toThrow(Exited)
    expect(errors.join('\n')).toContain(`${first} is not scanned by this gate`)
  })

  test('an unscanned workspace with no exemption fails, naming the gate and the workspace', () => {
    const missing = 'packages/gates'
    const scanned = workspaces.filter((ws) => ws !== missing)
    expect(() => assertCoversWorkspaces('my gate', scanned)).toThrow(new Exited(1))
    const out = errors.join('\n')
    expect(out).toContain('my gate: workspace coverage is not accounted for')
    expect(out).toContain(`${missing} is not scanned by this gate and has no stated exemption`)
  })

  test('an unscanned workspace with a stated exemption passes', () => {
    const scanned = workspaces.filter((ws) => ws !== 'packages/gates')
    expect(() =>
      assertCoversWorkspaces('probe', scanned, { 'packages/gates': 'nothing renders here' })
    ).not.toThrow()
  })

  test('an exemption for a workspace that IS scanned is stale and fails', () => {
    expect(() =>
      assertCoversWorkspaces('probe', workspaces, { 'packages/gates': 'no longer true' })
    ).toThrow(Exited)
    expect(errors.join('\n')).toContain(
      'packages/gates carries an exemption but IS now covered by the scan set'
    )
  })

  test('an exemption naming no workspace at all is stale too', () => {
    expect(() =>
      assertCoversWorkspaces('probe', workspaces, { 'apps/long-gone': 'deleted' })
    ).toThrow(Exited)
    expect(errors.join('\n')).toContain('apps/long-gone carries an exemption')
  })
})
