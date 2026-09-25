import { describe, expect, test } from 'bun:test'
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * `tools/smoke-production.sh` — the one production smoke list.
 *
 * Two properties are asserted. The WIRING: both the post-deploy step and the
 * nightly job run this script, and the nightly notifier judges that job, so a
 * regression between deploys opens the tracking issue. The FAILURE REPORTING:
 * with every request failing, the script runs all checks, reports each one with
 * a readable status, and exits 1.
 */

const ROOT = join(import.meta.dir, '..', '..')
const SCRIPT = join(ROOT, 'tools', 'smoke-production.sh')
const WORKFLOWS = join(ROOT, '.github', 'workflows')

const workflow = (name: string) => readFileSync(join(WORKFLOWS, name), 'utf-8')

describe('smoke-production wiring', () => {
  test('the deploy workflow runs the script after deploying', () => {
    expect(workflow('deploy-cloudflare.yml')).toContain('run: bash tools/smoke-production.sh')
  })

  test('the nightly workflow runs it and its notifier treats it as always-run', () => {
    const nightly = workflow('e2e-nightly.yml')
    expect(nightly).toContain('run: bash tools/smoke-production.sh')
    expect(nightly).toMatch(/needs: \[[^\]]*\bproduction-smoke\b[^\]]*\]/)
    expect(nightly).toMatch(/ALWAYS_RUNS = new Set\(\[[^\]]*'production-smoke'/)
  })

  test('no workflow probes a retired Netlify hostname', () => {
    const files = readdirSync(WORKFLOWS).filter((f) => f.endsWith('.yml'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      expect({ file, hit: workflow(file).includes('.netlify.app') }).toEqual({ file, hit: false })
    }
  })
})

describe('smoke-production failure reporting', () => {
  test('an unreachable production reports every check as 000 and exits 1', async () => {
    // A fake `curl` that behaves like a transport failure: it still prints the
    // -w status (`000`) and exits non-zero.
    const bin = mkdtempSync(join(tmpdir(), 'smoke-bin-'))
    try {
      const fake = join(bin, 'curl')
      writeFileSync(
        fake,
        '#!/usr/bin/env bash\nfor a in "$@"; do [ "$a" = "%{http_code}" ] && printf 000; done\nexit 7\n'
      )
      chmodSync(fake, 0o755)

      const proc = Bun.spawn(['bash', SCRIPT], {
        cwd: ROOT,
        env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ''}` },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [stderr, exitCode] = await Promise.all([new Response(proc.stderr).text(), proc.exited])

      expect(exitCode).toBe(1)
      // Every check ran rather than the first failure aborting the script.
      expect(stderr).toContain('FAIL srd home — wanted 200, got 000\n')
      expect(stderr).toContain('FAIL bot token accepted by Discord — wanted 200, got 000\n')
      expect(stderr).toContain("FAIL artwork origin robots.txt has no 'Disallow: /'")
      expect(stderr).not.toContain('000000')
    } finally {
      rmSync(bin, { recursive: true, force: true })
    }
  })
})
