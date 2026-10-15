import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  codegenDrift,
  internalFunctionsIn,
  internalReferencesIn,
  main,
  publicFunctionsIn,
  reExportsIn,
  referencesIn,
  registeredModules,
  uncalled,
} from '../check-convex-callers'
import { captured, fixtureTrees } from './fixtureTree'

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

describe('internalFunctionsIn', () => {
  test('finds internal builders and skips public ones and `@operator` one-offs', () => {
    const source = [
      '/** Called by a cron. */',
      'export const sweep = internalMutation({',
      'export const peek = internalQuery({',
      'export const run = internalAction({',
      'export const listMine = query({',
      '/**',
      ' * A one-off repair.',
      ' *',
      ' * @operator Run by hand.',
      ' */',
      'export const repair = internalMutation({',
    ].join('\n')
    expect(internalFunctionsIn(source)).toEqual(['sweep', 'peek', 'run'])
  })
})

describe('internalReferencesIn', () => {
  test('reads internal references outside comments', () => {
    const source = [
      "crons.hourly('sweep', { minuteUTC: 37 }, internal.photos.sweep)",
      '// internal.games.retired is only mentioned here',
      'const QUERIES = { me: internal.botClient.me }',
    ].join('\n')
    expect([...internalReferencesIn(source)].sort()).toEqual(['botClient:me', 'photos:sweep'])
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
  test('reports what nothing references', () => {
    const defined = ['games:listMine', 'games:rename', 'crew:readEntity']
    const referenced = new Set(['games:listMine'])
    expect(uncalled(defined, referenced)).toEqual(['crew:readEntity', 'games:rename'])
  })
})

describe('api.d.ts drift', () => {
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
  expect(stdout).toMatch(
    /all \d+ public functions have a caller, all \d+ internal functions are called/
  )
})

describe('main', () => {
  const tree = fixtureTrees('convex-callers')
  const api = (...modules: string[]) =>
    modules.map((m, i) => `import type * as m${i} from "../${m}.js";`).join('\n')

  /** A deployment where every function is called and api.d.ts registers each module. */
  const healthy: Record<string, string> = {
    'apps/web/convex/games.ts': [
      'export const list = query({ handler: async () => [] })',
      'export const prune = internalMutation({ handler: async () => {} })',
      '/** @operator run once by hand */',
      'export const backfill = internalMutation({ handler: async () => {} })',
    ].join('\n'),
    'apps/web/convex/crons.ts': 'crons.daily("prune", {}, internal.games.prune)\n',
    'apps/web/convex/schema.ts': 'export default defineSchema({})\n',
    'apps/web/convex/_generated/api.d.ts': api('crons', 'games'),
    'apps/web/src/routes/Games.tsx': 'useQuery(api.games.list)\n',
    'apps/web/src/routes/__tests__/Games.test.tsx': 'useQuery(api.games.unused)\n',
  }

  test('passes and counts what it checked when every function is called and registered', () => {
    const io = captured()
    expect(main(tree(healthy), io.log, io.error)).toBe(0)
    expect(io.err).toEqual([])
    expect(io.out).toEqual([
      '✓ Convex callers: all 1 public functions have a caller, all 1 internal functions are called, and api.d.ts registers all 2 modules.',
    ])
  })

  test('fails on codegen drift, an uncalled public function and an uncalled internal one', () => {
    const root = tree({
      ...healthy,
      'apps/web/convex/games.ts': `${healthy['apps/web/convex/games.ts']}\nexport const rename = mutation({ handler: async () => {} })\nexport const sweep = internalAction({ handler: async () => {} })`,
      // `entities` re-exports `rename`, so it is public under both names.
      'apps/web/convex/entities.ts': "export { rename as retitle } from './games'\n",
      'apps/web/convex/_generated/api.d.ts': api('crons', 'games', 'gone'),
    })
    const io = captured()
    expect(main(root, io.log, io.error)).toBe(1)
    expect(io.out).toEqual([])
    expect(io.err.join('\n')).toBe(
      [
        '✗ Convex codegen drift — apps/web/convex/_generated/api.d.ts is stale.',
        '    convex/entities.ts exists on disk but is NOT registered in api.d.ts',
        '    api.d.ts registers convex/gone.ts, which no longer exists',
        '  → Regenerate with `bunx convex dev` (needs a CONVEX_DEPLOYMENT); never hand-edit\n    convex/_generated/.',
        '✗ Public Convex functions with no caller in the client:',
        '    entities.retitle',
        '    games.rename',
        '  → Delete it, make it internal, or call it. A public function nobody calls is\n    reachable surface that nothing exercises.',
        '✗ Internal Convex functions nothing calls:',
        '    games.sweep',
        '  → Delete it, or tag its doc comment `@operator` if it is a one-off run by hand\n    from the dashboard (and delete it once it has run).',
      ].join('\n')
    )
  })

  test('a caller only a test references still counts as uncalled', () => {
    const root = tree({
      ...healthy,
      'apps/web/src/routes/Games.tsx': '// api.games.list is mentioned only in a comment\n',
    })
    const io = captured()
    expect(main(root, io.log, io.error)).toBe(1)
    expect(io.err).toContain('    games.list')
  })
})
