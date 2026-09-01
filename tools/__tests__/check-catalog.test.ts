import { describe, expect, test } from 'bun:test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dir, '..', '..')
const TOOL = join(ROOT, 'tools', 'check-catalog.ts')

async function runCheck() {
  const proc = Bun.spawn(['bun', TOOL], { cwd: ROOT, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

/**
 * Each case mutates a real manifest, runs the tool, and restores the file.
 * Mutating the real tree rather than a fixture is deliberate: the tool's whole
 * job is to read THESE seven manifests, and a fixture copy would not prove it
 * is pointed at them.
 */
type MutableManifest = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  workspaces?: { catalog?: Record<string, string> }
}

/** Reach a manifest's dependency / catalog block, creating it if absent. */
function deps(j: MutableManifest): Record<string, string> {
  j.dependencies ??= {}
  return j.dependencies
}

function catalogOf(j: MutableManifest): Record<string, string> {
  j.workspaces ??= {}
  j.workspaces.catalog ??= {}
  return j.workspaces.catalog
}

async function withManifest(rel: string, mutate: (json: MutableManifest) => void) {
  const path = join(ROOT, rel)
  const original = readFileSync(path, 'utf8')
  try {
    const json = JSON.parse(original) as MutableManifest
    mutate(json)
    writeFileSync(path, `${JSON.stringify(json, null, 2)}\n`)
    return await runCheck()
  } finally {
    writeFileSync(path, original)
  }
}

describe('check-catalog', () => {
  test('passes on the tree as committed', async () => {
    const { exitCode, stdout } = await runCheck()
    expect(exitCode).toBe(0)
    expect(stdout).toContain('no version written twice')
  })

  test('reports the real entry and reference counts', async () => {
    // Guards against the check silently reading an empty catalog and passing —
    // the same vacuous-pass shape the scan floors exist for.
    const { stdout } = await runCheck()
    expect(stdout).toMatch(/catalog: \d+ entries, \d+ references/)
    const entries = Number(stdout.match(/catalog: (\d+) entries/)?.[1])
    expect(entries).toBeGreaterThan(10)
  })

  test('FAILS when a package is pinned with a literal in two manifests', async () => {
    const { exitCode, stderr } = await withManifest('apps/su-assets/package.json', (j) => {
      // `idb` is already pinned literally in apps/itun, so this makes two.
      deps(j).idb = '8.0.3'
    })
    expect(exitCode).toBe(1)
    expect(stderr).toContain('idb')
    expect(stderr).toContain('not in the catalog')
  })

  test('FAILS when a catalogued package is pinned with a literal', async () => {
    const { exitCode, stderr } = await withManifest('apps/su-assets/package.json', (j) => {
      deps(j)['@sentry/browser'] = '10.69.0'
    })
    expect(exitCode).toBe(1)
    expect(stderr).toContain('@sentry/browser')
    expect(stderr).toContain('IS catalogued')
  })

  test('FAILS on a catalog entry nothing references', async () => {
    const { exitCode, stderr } = await withManifest('package.json', (j) => {
      catalogOf(j)['left-pad'] = '^1.3.0'
    })
    expect(exitCode).toBe(1)
    expect(stderr).toContain('left-pad')
    expect(stderr).toContain('referenced by 0 manifest')
  })

  test('FAILS loudly if the catalog itself goes missing', async () => {
    const { exitCode, stderr } = await withManifest('package.json', (j) => {
      if (j.workspaces) j.workspaces.catalog = {}
    })
    expect(exitCode).toBe(1)
    expect(stderr).toContain('declares no `workspaces.catalog`')
  })
})
