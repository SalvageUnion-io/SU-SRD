/**
 * Every Games function a screen reads or writes through `roomCalls.ts` is a
 * call the Worker answers (`worker/shared/gameCalls.ts`), under its Convex
 * name: a screen that starts using a new one fails here, not at the table.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { testDb } from '../../worker/shared/__tests__/d1'
import type { CallDeps } from '../../worker/shared/gameCalls'
import { gameCall } from '../../worker/shared/gameCalls'

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(path)
    return /\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe('the Games hooks', () => {
  test('call only what the Worker answers', async () => {
    const called = new Set(
      sources(join(import.meta.dir, '../..')).flatMap((file) => {
        const text = readFileSync(file, 'utf8')
        return [
          ...[...text.matchAll(/useGames(?:Query|Mutation|Action)\(\s*api\.(\w+)\.(\w+)/g)].map(
            (m) => `${m[1]}.${m[2]}`
          ),
          ...[...text.matchAll(/roomCall\('([\w.]+)'/g)].map((m) => m[1] as string),
        ]
      })
    )
    expect(called.size).toBeGreaterThan(20)
    const deps = { db: testDb() } as unknown as CallDeps
    for (const name of called) {
      expect({
        name,
        answered: (await gameCall(name, { code: 'X' }, null, deps)) !== null,
      }).toEqual({
        name,
        answered: true,
      })
    }
  })
})
