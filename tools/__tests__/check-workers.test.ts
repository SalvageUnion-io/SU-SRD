import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { WORKER_APPS } from '../check-generated'
import type { WorkerApp } from '../check-workers'
import { ENTRY, loadWorkers, main, SCRIPTS, shapeProblems } from '../check-workers'

const ROOT = join(import.meta.dir, '..', '..')

const SCRIPT_SET = Object.fromEntries(SCRIPTS.map((s) => [s, `run ${s}`]))

function worker(app: string, overrides: Partial<WorkerApp> = {}): WorkerApp {
  return {
    app,
    config: {
      main: ENTRY,
      workers_dev: false,
      compatibility_date: '2026-07-13',
      compatibility_flags: ['nodejs_als'],
      observability: { enabled: true },
    },
    scripts: {
      ...SCRIPT_SET,
      deploy: 'wrangler deploy',
      'worker:bundle': 'wrangler deploy --dry-run',
    },
    present: new Set([`${app}/${ENTRY}`, `${app}/worker-configuration.d.ts`]),
    ...overrides,
  }
}

const withConfig = (app: string, config: Record<string, unknown>) =>
  worker(app, { config: { ...worker(app).config, ...config } })

describe('shapeProblems', () => {
  test('two matching Workers have none', () => {
    expect(shapeProblems([worker('apps/a'), worker('apps/b')], ['apps/a', 'apps/b'])).toEqual([])
  })

  test('the app list and WORKER_APPS must match both ways', () => {
    expect(shapeProblems([worker('apps/a'), worker('apps/new')], ['apps/a', 'apps/gone'])).toEqual([
      'apps/new: has a wrangler.jsonc but is not in WORKER_APPS (tools/check-generated.ts)',
      'apps/gone: in WORKER_APPS but has no wrangler.jsonc',
    ])
  })

  test('another entry layout fails', () => {
    expect(
      shapeProblems([withConfig('apps/a', { main: 'src/http/worker.ts' })], ['apps/a'])
    ).toEqual(['apps/a: main is "src/http/worker.ts", not "src/worker/index.ts"'])
  })

  test('a main that is not on disk fails', () => {
    const missing = worker('apps/a', { present: new Set(['apps/a/worker-configuration.d.ts']) })
    expect(shapeProblems([missing], ['apps/a'])).toEqual([
      'apps/a: main src/worker/index.ts does not exist',
    ])
  })

  test('an unset workers_dev fails; true and false both pass', () => {
    expect(shapeProblems([withConfig('apps/a', { workers_dev: undefined })], ['apps/a'])).toEqual([
      'apps/a: workers_dev is unset; set it to true or false explicitly',
    ])
    expect(shapeProblems([withConfig('apps/a', { workers_dev: true })], ['apps/a'])).toEqual([])
  })

  test('a missing script and missing Env types fail', () => {
    const { 'worker:bundle': _, ...scripts } = worker('apps/a').scripts
    const bare = worker('apps/a', { scripts, present: new Set([`apps/a/${ENTRY}`]) })
    expect(shapeProblems([bare], ['apps/a'])).toEqual([
      'apps/a: no "worker:bundle" script',
      'apps/a: no worker-configuration.d.ts; run `bun run check generated`',
    ])
  })

  test('a shared key that differs is printed per app', () => {
    const problems = shapeProblems(
      [worker('apps/a'), withConfig('apps/b', { compatibility_date: '2026-01-01' })],
      ['apps/a', 'apps/b']
    )
    expect(problems).toEqual([
      'wrangler.jsonc "compatibility_date" differs:\n      apps/a: "2026-07-13"\n      apps/b: "2026-01-01"',
    ])
  })

  test('a shared key set in one app and unset in another differs', () => {
    const problems = shapeProblems(
      [worker('apps/a'), withConfig('apps/b', { observability: undefined })],
      ['apps/a', 'apps/b']
    )
    expect(problems).toEqual([
      'wrangler.jsonc "observability" differs:\n      apps/a: {"enabled":true}\n      apps/b: unset',
    ])
  })

  test('a same-everywhere script that differs fails', () => {
    const b = worker('apps/b')
    b.scripts = { ...b.scripts, deploy: 'wrangler deploy --env production' }
    expect(shapeProblems([worker('apps/a'), b], ['apps/a', 'apps/b'])).toEqual([
      'script "deploy" differs:\n      apps/a: "wrangler deploy"\n      apps/b: "wrangler deploy --env production"',
    ])
  })
})

describe('the repo', () => {
  test('finds exactly the three Workers, and they share one shape', async () => {
    const workers = await loadWorkers(ROOT)
    expect(workers.map((w) => w.app)).toEqual([...WORKER_APPS].sort())
    expect(shapeProblems(workers, WORKER_APPS)).toEqual([])
  })

  test('main passes and says how many it checked', async () => {
    const out: string[] = []
    expect(await main(ROOT, (l) => out.push(l))).toBe(0)
    expect(out.join('\n')).toContain('3 Workers share one shape')
  })
})

describe('main on a scratch tree', () => {
  const dir = mkdtempSync(join(tmpdir(), 'check-workers-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))
  const write = (rel: string, body: string) => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    writeFileSync(join(dir, rel), body)
  }

  test('no Workers at all fails rather than passing on nothing', async () => {
    mkdirSync(join(dir, 'apps', 'web'), { recursive: true })
    const err: string[] = []
    expect(
      await main(
        dir,
        () => {},
        (l) => err.push(l)
      )
    ).toBe(1)
    expect(err.join('\n')).toContain('found no apps/*/wrangler.jsonc')
  })

  test('reads JSONC, and fails a Worker missing from WORKER_APPS', async () => {
    write(
      'apps/extra/wrangler.jsonc',
      '{\n  // a comment\n  "main": "src/worker/index.ts",\n  "workers_dev": false,\n}\n'
    )
    write('apps/extra/package.json', JSON.stringify({ scripts: SCRIPT_SET }))
    write(`apps/extra/${ENTRY}`, 'export default {}\n')
    const [loaded] = await loadWorkers(dir)
    expect(loaded?.config.main).toBe(ENTRY)
    expect(loaded?.present.has(`apps/extra/${ENTRY}`)).toBe(true)

    const err: string[] = []
    expect(
      await main(
        dir,
        () => {},
        (l) => err.push(l)
      )
    ).toBe(1)
    const text = err.join('\n')
    expect(text).toContain('apps/extra: has a wrangler.jsonc but is not in WORKER_APPS')
    expect(text).toContain('apps/extra: no worker-configuration.d.ts')
  })

  test('an app without a package.json has no scripts', async () => {
    write('apps/bare/wrangler.jsonc', '{ "main": "src/worker/index.ts" }')
    const bare = (await loadWorkers(dir)).find((w) => w.app === 'apps/bare')
    expect(bare?.scripts).toEqual({})
  })
})
