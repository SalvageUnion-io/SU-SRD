/**
 * The order-dependence check: a test that passes only because of the files
 * that happen to run before it.
 *
 * Every workspace runs `bun test --parallel=4 --no-isolate`: a worker keeps one
 * global and module registry across the files it is dealt, so a file that
 * leaves state behind (a patched global, a module mock, a cache never reset)
 * can hold up, or break, a later one. Which files share a worker shifts as the
 * suite grows, so such a leak surfaces as a failure in an unrelated PR.
 *
 * This runs one workspace's test files in ONE non-isolated process, in path
 * order and then reversed, each with the JUnit reporter, and fails on any test
 * that passes forward and fails (or never reports) reversed. A test that fails
 * reversed once and passes on a second reversed run is printed as flaky and
 * does not fail the check: the leak it reports must reproduce.
 *
 * Slow (every suite twice, serially), so it runs in the `nightly` profile of
 * `tools/check.ts`, not on a PR.
 *
 * Run:  bun tools/check-test-order.ts [<workspace dir> …]   # default: every workspace with a test script
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverWorkspaceDirs } from 'gates/lib/workspaceCoverage'
import { shardTestFiles } from './run-coverage'

const ROOT = join(import.meta.dir, '..')

const fromXml = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&')

const attr = (tag: string, name: string) =>
  fromXml(tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? '')

/**
 * Each test case in a JUnit report, by `file > describe > name`, mapped to
 * whether it passed. A skipped test is left out; a repeated id (a `test.each`
 * row) is numbered.
 */
export function parseJunit(xml: string): Map<string, boolean> {
  const out = new Map<string, boolean>()
  const CASE = /<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g
  for (const m of xml.matchAll(CASE)) {
    const tag = m[1] ?? ''
    const body = m[3] ?? ''
    if (/<skipped\b/.test(body)) continue
    const id = [attr(tag, 'file'), attr(tag, 'classname'), attr(tag, 'name')]
      .filter(Boolean)
      .join(' > ')
    let key = id
    for (let n = 2; out.has(key); n++) key = `${id} [${n}]`
    out.set(key, !/<(failure|error)\b/.test(body))
  }
  return out
}

/** Tests that passed forward and did not pass reversed (failed, or never ran). */
export function orderLeaks(
  forward: ReadonlyMap<string, boolean>,
  reversed: ReadonlyMap<string, boolean>
): string[] {
  return [...forward]
    .filter(([id, passed]) => passed && reversed.get(id) !== true)
    .map(([id]) => id)
}

/** Runs `files` in `cwd` in one process, writing a JUnit report to `outfile`. */
export type RunTests = (
  cwd: string,
  files: readonly string[],
  outfile: string
) => Promise<{ code: number; output: string }>

const runBun: RunTests = async (cwd, files, outfile) => {
  const proc = Bun.spawn(
    [
      process.execPath,
      'test',
      '--no-isolate',
      '--reporter=junit',
      `--reporter-outfile=${outfile}`,
      ...files,
    ],
    {
      cwd,
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' },
    }
  )
  const [out, err, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { code, output: `${out}${err}` }
}

export type WorkspaceResult = {
  dir: string
  tests: number
  leaks: string[]
  flaky: string[]
  /** Set when the forward run reported no test at all. */
  error?: string
}

/** Forward, reversed, and a second reversed run to confirm any leak. */
export async function checkWorkspace(
  dir: string,
  { root = ROOT, run = runBun }: { root?: string; run?: RunTests } = {}
): Promise<WorkspaceResult> {
  const cwd = join(root, dir)
  const files = shardTestFiles(cwd, 1)[0] ?? []
  const tmp = mkdtempSync(join(tmpdir(), 'test-order-'))
  const report = async (order: readonly string[], name: string) => {
    const outfile = join(tmp, `${name}.xml`)
    const { output } = await run(cwd, order, outfile)
    // A run that crashed before reporting leaves no file: no test passed.
    const xml = existsSync(outfile) ? readFileSync(outfile, 'utf8') : ''
    return { results: parseJunit(xml), output }
  }
  try {
    const forward = await report(files, 'forward')
    if (forward.results.size === 0)
      return {
        dir,
        tests: 0,
        leaks: [],
        flaky: [],
        error: `no test reported in path order:\n${forward.output.trim().slice(-2000)}`,
      }
    const backward = [...files].reverse()
    const first = orderLeaks(forward.results, (await report(backward, 'reversed')).results)
    if (first.length === 0) return { dir, tests: forward.results.size, leaks: [], flaky: [] }
    const again = new Set(
      orderLeaks(forward.results, (await report(backward, 'reversed-again')).results)
    )
    return {
      dir,
      tests: forward.results.size,
      leaks: first.filter((id) => again.has(id)),
      flaky: first.filter((id) => !again.has(id)),
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
}

/** Every workspace whose manifest has a `test` script. */
export function testWorkspaces(root = ROOT): string[] {
  return discoverWorkspaceDirs(root, { withTools: true }).filter((dir) => {
    try {
      const manifest = JSON.parse(readFileSync(join(root, dir, 'package.json'), 'utf8'))
      return typeof manifest.scripts?.test === 'string'
    } catch {
      return false
    }
  })
}

export type MainOptions = {
  root?: string
  run?: RunTests
  log?: (line: string) => void
  error?: (line: string) => void
}

/** Check each workspace in turn (serially: a loaded machine makes slow tests flake); returns the exit code. */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  { root = ROOT, run = runBun, log = console.log, error = console.error }: MainOptions = {}
): Promise<number> {
  const dirs = argv.length > 0 ? [...argv] : testWorkspaces(root)
  let failed = false
  for (const dir of dirs) {
    const r = await checkWorkspace(dir, { root, run })
    if (r.error) {
      failed = true
      error(`✗ ${dir}: ${r.error}`)
      continue
    }
    for (const id of r.flaky) log(`  ~ ${dir}: ${id} failed reversed once, passed on the rerun`)
    if (r.leaks.length > 0) {
      failed = true
      error(
        `✗ ${dir}: ${r.leaks.length} test(s) pass in path order and fail with the files reversed:`
      )
      for (const id of r.leaks) error(`    ${id}`)
    } else log(`✓ ${dir}: ${r.tests} tests pass in both file orders`)
  }
  if (failed)
    error(
      '\nA test that fails reversed relies on, or is broken by, state another file leaves behind. Reset that state in the leaking file (afterEach/afterAll, mock.restore, a fresh instance); `bun tools/check-test-order.ts <workspace>` reruns one.'
    )
  return failed ? 1 : 0
}

if (import.meta.main) process.exit(await main())
