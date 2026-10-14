import { afterAll } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

/**
 * Throwaway repo-shaped trees for the gate scripts' `main()` tests. Each call
 * returns a fresh root; every root a file made is removed after that file.
 */
export function fixtureTrees(prefix: string): (files: Record<string, string>) => string {
  const roots: string[] = []
  afterAll(() => {
    for (const root of roots) rmSync(root, { recursive: true, force: true })
  })
  return (files) => {
    const root = mkdtempSync(join(tmpdir(), `${prefix}-`))
    roots.push(root)
    writeTree(root, files)
    return root
  }
}

/** Write `path → contents` under `root`, making directories as needed. */
function writeTree(root: string, files: Record<string, string>): void {
  for (const [path, contents] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), contents)
  }
}

/** A `log` / `error` pair that records what a `main()` printed, one string per call. */
export function captured(): {
  log: (...parts: unknown[]) => void
  error: (...parts: unknown[]) => void
  out: string[]
  err: string[]
} {
  const out: string[] = []
  const err: string[] = []
  return {
    log: (...parts) => out.push(parts.map(String).join(' ')),
    error: (...parts) => err.push(parts.map(String).join(' ')),
    out,
    err,
  }
}
