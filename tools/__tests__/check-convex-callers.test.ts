import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { publicFunctionsIn, reExportsIn, referencesIn, uncalled } from '../check-convex-callers'

/**
 * `tools/check-convex-callers.ts` gates merges, so its parsing is pinned here:
 * a regex that silently matched nothing would pass every repo, including one
 * full of public functions nobody calls.
 */

describe('publicFunctionsIn', () => {
  test('finds public builders and ignores internal ones and helpers', () => {
    const source = [
      'export const listMine = query({ args: {}, handler: async () => [] })',
      'export const create = mutation({',
      'export const run = action({',
      'export const repair = internalMutation({',
      'export const peek = internalQuery({',
      'export async function helper() {}',
      'const notExported = query({',
    ].join('\n')
    expect(publicFunctionsIn(source)).toEqual(['listMine', 'create', 'run'])
  })
})

describe('reExportsIn', () => {
  test('reads named, aliased and star re-exports of sibling modules', () => {
    const source = [
      "export { claimLocal, repairContainers as repair } from './claim'",
      'export {',
      '  removeMechPattern,',
      '  upsertMechPattern,',
      "} from './shelf'",
      "export * from './changeLog'",
    ].join('\n')
    expect(reExportsIn(source)).toEqual([
      {
        from: 'claim',
        names: [
          ['claimLocal', 'claimLocal'],
          ['repairContainers', 'repair'],
        ],
      },
      {
        from: 'shelf',
        names: [
          ['removeMechPattern', 'removeMechPattern'],
          ['upsertMechPattern', 'upsertMechPattern'],
        ],
      },
      { from: 'changeLog', names: '*' },
    ])
  })

  test('type-only re-exports, packages and commented-out lines register nothing', () => {
    const source = [
      "export { type Doc } from './_generated/dataModel'",
      "export { v } from 'convex/values'",
      "// export { claimLocal } from './claim'",
    ].join('\n')
    expect(reExportsIn(source)).toEqual([{ from: '_generated/dataModel', names: [] }])
  })
})

describe('referencesIn', () => {
  test('reads api.module.name and string function references', () => {
    const source = [
      'useQuery(api.games.listMine, {})',
      'const m = useMutation(api.entities.upsertByAppId)',
      "const r = makeFunctionReference<'query'>('account:me')",
    ].join('\n')
    expect([...referencesIn(source)].sort()).toEqual([
      'account:me',
      'entities:upsertByAppId',
      'games:listMine',
    ])
  })

  test('a mention in a comment is not a call', () => {
    const source = [
      '/** Replaces `api.games.rename`, which is gone. */',
      '// api.crew.readEntity used to live here',
      "const url = 'https://example.com' // api.ownership.assign",
      'const q = useQuery(api.games.get)',
    ].join('\n')
    expect([...referencesIn(source)]).toEqual(['games:get'])
  })
})

describe('uncalled', () => {
  test('reports what nothing references, minus what is allowed', () => {
    const defined = ['games:listMine', 'games:rename', 'crew:readEntity']
    const referenced = new Set(['games:listMine'])
    expect(uncalled(defined, referenced, {})).toEqual(['crew:readEntity', 'games:rename'])
    expect(uncalled(defined, referenced, { 'games:rename': 'called by an admin script' })).toEqual([
      'crew:readEntity',
    ])
  })
})

test('the repository passes', async () => {
  const proc = Bun.spawn(['bun', join(import.meta.dir, '..', 'check-convex-callers.ts')], {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
  expect(stdout).toMatch(/all \d+ public functions have a caller/)
})
