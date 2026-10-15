import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The PWA manifest's description is what an install prompt shows. It said
 * "Local-first character builder" long after the account became the server of
 * record (ADR-034/035), so it now repeats `index.html`'s meta description, and
 * this keeps the two from drifting apart again. Read as text: importing
 * `vite.config.ts` would load every Vite plugin.
 */
const appDir = join(import.meta.dir, '..', '..', '..')

function match(source: string, pattern: RegExp, what: string): string {
  const found = pattern.exec(source)?.[1]
  if (found === undefined) throw new Error(`no ${what} found`)
  return found
}

describe('PWA manifest description', () => {
  const manifest = match(
    readFileSync(join(appDir, 'vite.config.ts'), 'utf8'),
    /description:\s*'([^']+)'/,
    'manifest description in vite.config.ts'
  )
  const meta = match(
    readFileSync(join(appDir, 'index.html'), 'utf8'),
    /<meta\s+name="description"\s+content="([^"]+)"/,
    'meta description in index.html'
  )

  test("matches index.html's meta description", () => {
    expect(manifest).toBe(meta)
  })

  test('does not describe the retired device-only model', () => {
    expect(manifest).not.toMatch(/local-first/i)
  })
})
