import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { assertScanFloor } from '../lib/scanFloor'
import { Exited, trapExit } from './trapExit'

const TOOLS = join(import.meta.dir, '..')

/**
 * `assertScanFloor` calls `process.exit(1)` on failure, so it cannot be tested
 * in-process — the runner would exit with it. Each case runs a one-line script
 * in a subprocess and asserts on the exit code and stderr instead.
 */
async function runFloor(scanned: number, floor: number) {
  const proc = Bun.spawn(
    [
      'bun',
      '-e',
      `import { assertScanFloor } from ${JSON.stringify(join(TOOLS, 'lib/scanFloor.ts'))}
       assertScanFloor('probe', ${scanned}, ${floor})
       console.log('REACHED-SUCCESS-PATH')`,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe('assertScanFloor', () => {
  test('passes and returns when the scan met the floor', async () => {
    const { exitCode, stdout } = await runFloor(998, 650)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('REACHED-SUCCESS-PATH')
  })

  test('passes on the boundary — floor is inclusive', async () => {
    const { exitCode, stdout } = await runFloor(650, 650)
    expect(exitCode).toBe(0)
    expect(stdout).toContain('REACHED-SUCCESS-PATH')
  })

  test('FAILS when the scan found fewer files than the floor', async () => {
    const { exitCode, stdout, stderr } = await runFloor(649, 650)
    expect(exitCode).toBe(1)
    expect(stdout).not.toContain('REACHED-SUCCESS-PATH')
    expect(stderr).toContain('scanned 649 files, expected at least 650')
  })

  /**
   * The case this whole helper exists for: a gate whose directory list went
   * stale walks nothing, counts zero violations, and would otherwise print
   * success. Zero must be the loudest failure, not the quietest pass.
   */
  test('FAILS loudly when the scan found nothing at all', async () => {
    const { exitCode, stdout, stderr } = await runFloor(0, 650)
    expect(exitCode).toBe(1)
    expect(stdout).not.toContain('REACHED-SUCCESS-PATH')
    expect(stderr).toContain('scanned 0 files')
    expect(stderr).toContain('did not look at the tree it was written for')
  })

  test('names the gate so a CI failure says which one broke', async () => {
    const { stderr } = await runFloor(0, 10)
    expect(stderr).toContain('probe')
  })
})

/**
 * The same contract in-process, with `process.exit` trapped: the subprocess
 * cases above prove the real exit, these prove the message a CI log carries.
 */
describe('assertScanFloor (exit trapped)', () => {
  const { errors } = trapExit()

  test('returns silently at or above the floor', () => {
    expect(() => assertScanFloor('probe', 10, 10)).not.toThrow()
    expect(errors).toEqual([])
  })

  test('below the floor it exits 1 and tells the author how to lower it legitimately', () => {
    expect(() => assertScanFloor('styling (app CSS)', 1, 2)).toThrow(new Exited(1))
    const out = errors.join('\n')
    expect(out).toContain('styling (app CSS): scanned 1 files, expected at least 2')
    expect(out).toContain('lower the floor')
  })
})
