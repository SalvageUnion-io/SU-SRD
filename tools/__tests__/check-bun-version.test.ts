import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * `check-bun-version` — the post-Netlify shape.
 *
 * It used to check three `netlify.toml` files. With those deleted it was
 * asserting one thing (root `bun-types`) while printing `0 Netlify site(s)` —
 * passing by having nothing left to check. It is now repointed at the surface
 * where builds actually happen: every workflow's Bun setup.
 *
 * ## Why these run the real script in a shadow root
 *
 * The script resolves its root from `import.meta.url`, so a symlinked `tools/`
 * would make it read the REAL repo and pass vacuously — the exact trap this
 * suite exists to avoid. `tools/` is therefore COPIED, not linked.
 */

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SCRIPT = 'tools/check-bun-version.ts'

async function run(files: Record<string, string>): Promise<{ code: number; out: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'bunver-'))
  try {
    mkdirSync(join(dir, 'tools'), { recursive: true })
    const script = await Bun.file(join(REPO, SCRIPT)).text()
    writeFileSync(join(dir, SCRIPT), script)

    for (const [path, contents] of Object.entries(files)) {
      const full = join(dir, path)
      mkdirSync(dirname(full), { recursive: true })
      writeFileSync(full, contents)
    }

    const proc = Bun.spawnSync(['bun', SCRIPT], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
    return {
      code: proc.exitCode ?? 1,
      out: `${proc.stdout.toString()}${proc.stderr.toString()}`,
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const PKG = JSON.stringify({ devDependencies: { 'bun-types': '1.4.0' } })
const COMPOSITE = `jobs:\n  a:\n    steps:\n      - uses: ./.github/actions/setup-bun\n`

describe('check-bun-version', () => {
  test('passes when bun-types matches and every workflow uses the composite action', async () => {
    const { code, out } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': PKG,
      '.github/workflows/ci.yml': COMPOSITE,
    })
    expect(code).toBe(0)
    expect(out).toContain('none pinning by hand')
  })

  test('fails when bun-types drifts from .bun-version', async () => {
    const { code, out } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': JSON.stringify({ devDependencies: { 'bun-types': '1.3.10' } }),
      '.github/workflows/ci.yml': COMPOSITE,
    })
    expect(code).toBe(1)
    expect(out).toContain('bun-types = 1.3.10')
  })

  test('fails when a workflow pins a DIFFERENT bun-version by hand', async () => {
    // The original drift this guard was written for, relocated to where builds
    // now happen: CI testing a Bun that nothing else uses.
    const { code, out } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': PKG,
      '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n      - uses: oven-sh/setup-bun@v2\n        with:\n          bun-version: 1.2.0\n`,
    })
    expect(code).toBe(1)
    expect(out).toContain('pins bun-version 1.2.0')
  })

  test('fails a hand-pin even when it currently MATCHES', async () => {
    // The important case. A matching literal passes any equality check and
    // still cannot track `.bun-version` — it is drift that has not happened yet.
    const { code, out } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': PKG,
      '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n      - with:\n          bun-version: 1.4.0\n`,
    })
    expect(code).toBe(1)
    expect(out).toContain('pins bun-version by hand')
  })

  test('accepts bun-version-file, which is how the composite action reads it', async () => {
    const { code } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': PKG,
      '.github/workflows/ci.yml': `jobs:\n  a:\n    steps:\n      - with:\n          bun-version-file: .bun-version\n`,
    })
    expect(code).toBe(0)
  })

  test('refuses to pass by absence when there are no workflows at all', async () => {
    // The failure this rewrite exists to prevent. Silence must not read as
    // success — that is precisely what the Netlify-shaped version did once its
    // three files were deleted.
    const { code, out } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': PKG,
    })
    expect(code).toBe(1)
    expect(out).toContain('would pass by doing nothing')
  })

  test('fails when bun-types is absent entirely', async () => {
    const { code, out } = await run({
      '.bun-version': '1.4.0\n',
      'package.json': JSON.stringify({ devDependencies: {} }),
      '.github/workflows/ci.yml': COMPOSITE,
    })
    expect(code).toBe(1)
    expect(out).toContain('declares no bun-types')
  })
})
