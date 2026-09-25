import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { codegenDrift, modulesOnDisk, registeredModules } from '../check-convex-codegen'

/**
 * `tools/check-convex-codegen.ts` — the committed `api.d.ts` must register
 * exactly the Convex modules on disk (the #682 drift, where a new module was
 * never registered).
 */

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function convexDir(files: string[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'convex-'))
  dirs.push(dir)
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    writeFileSync(join(dir, f), '')
  }
  return dir
}

describe('check-convex-codegen', () => {
  test('modules are found recursively; schema, auth config and _generated are not modules', () => {
    const dir = convexDir([
      'games.ts',
      'model/entities.ts',
      'schema.ts',
      'auth.config.ts',
      '_generated/api.d.ts',
      'types.d.ts',
    ])
    expect([...modulesOnDisk(dir)].sort()).toEqual(['games', 'model/entities'])
  })

  test('registered modules are read from the type imports', () => {
    const api =
      'import type * as games from "../games.js";\nimport type * as model_entities from "../model/entities.js";\n'
    expect([...registeredModules(api)]).toEqual(['games', 'model/entities'])
  })

  test('a module on disk but not registered, and a registered module that is gone, are both drift', () => {
    const drift = codegenDrift(new Set(['games', 'model/entities']), new Set(['games', 'old']))
    expect(drift).toEqual({ missing: ['model/entities'], extra: ['old'] })
  })
})
