/**
 * Every public query declares what it returns (`returns`), so Convex refuses an
 * answer that has drifted from the shape the client reads, and the client's
 * types come from that validator rather than from whatever the handler happens
 * to build.
 *
 * convex-test checks each answer against its `returns` on every call, so the
 * rest of this suite exercises the validators; this file only stops a new
 * query landing without one.
 */

import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'

const CONVEX_DIR = join(import.meta.dir, '../../../convex')

type Registered = { isPublic?: boolean; isQuery?: boolean; exportReturns?: () => string }

async function publicQueries(): Promise<Array<{ name: string; returns: unknown }>> {
  const out: Array<{ name: string; returns: unknown }> = []
  // Function modules only: `model/` holds helpers and `_generated/` the API.
  const files = new Bun.Glob('*.ts').scan({ cwd: CONVEX_DIR })
  for await (const file of files) {
    const mod: Record<string, unknown> = await import(join(CONVEX_DIR, file))
    const path = file.replace(/\.ts$/, '')
    for (const [name, value] of Object.entries(mod)) {
      const fn = value as Registered | null
      if (fn?.isPublic !== true || fn.isQuery !== true) continue
      if (typeof fn.exportReturns !== 'function') continue
      out.push({ name: `${path}:${name}`, returns: JSON.parse(fn.exportReturns()) })
    }
  }
  return out
}

describe('public query returns', () => {
  test('every public query declares returns', async () => {
    const queries = await publicQueries()
    // Trips only if the walk found next to nothing (there are 33 today).
    expect(queries.length).toBeGreaterThan(25)
    const missing = queries.filter((q) => q.returns === null).map((q) => q.name)
    expect(missing).toEqual([])
  })
})
