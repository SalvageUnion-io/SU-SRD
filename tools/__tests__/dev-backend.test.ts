/**
 * `tools/dev-backend.ts` — the start-up sequence against a stand-in machine.
 * `realSys` is exercised against throwaway local processes and servers.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Browser } from '@playwright/test'
import { CHECKOUT_HEADER, portFor } from 'gates/ports'
import type { RunResult, Sys } from '../dev-backend'
import { main, parseArgs, realSys, SEED_ACCOUNT, STATE_DIR } from '../dev-backend'
import { fixtureTrees } from './fixtureTree'

const tree = fixtureTrees('dev-backend')

describe('parseArgs', () => {
  test('reads --fresh, and nothing else', () => {
    expect(parseArgs([])).toEqual({ fresh: false })
    expect(parseArgs(['--fresh'])).toEqual({ fresh: true })
    expect(() => parseArgs(['--port'])).toThrow('usage: bun run dev:backend')
  })
})

/** What the stand-in machine was asked to do, and how it answers. */
type World = {
  calls: string[]
  logs: string[]
  errors: string[]
  /** URLs that answer, and the checkout header each names. */
  up: Map<string, string | null>
  /** URLs that come up once the dev server is spawned. */
  comesUp: Map<string, string | null>
  run: (cmd: readonly string[]) => RunResult
  /** What `interrupted` and the server's exit do. */
  ending: 'interrupt' | 'exit'
  seedFails?: boolean
}

const ok = (stdout = ''): RunResult => ({ code: 0, stdout, stderr: '' })

function fakeSys(over: Partial<World> = {}): { sys: Sys; world: World } {
  const world: World = {
    calls: [],
    logs: [],
    errors: [],
    up: new Map(),
    comesUp: new Map(),
    run: () => ok(),
    ending: 'interrupt',
    ...over,
  }
  let release: (() => void) | undefined
  const ended = new Promise<void>((resolve) => {
    release = resolve
  })
  const sys: Sys = {
    run: async (cmd) => {
      world.calls.push(`run ${cmd.join(' ')}`)
      return world.run(cmd)
    },
    spawn: (cmd, _cwd, _log, env) => {
      world.calls.push(`spawn ${cmd.join(' ')} ${env?.VITE_TEST_AUTH} ${env?.DEV_ROOMS_STATE}`)
      for (const [url, header] of world.comesUp) world.up.set(url, header)
      return {
        exited: world.ending === 'exit' ? Promise.resolve(1) : ended.then(() => 0),
        stop: () => world.calls.push('stop'),
      }
    },
    probe: async (url) => (world.up.has(url) ? world.up.get(url) : undefined),
    sleep: async () => {},
    interrupted: () =>
      world.ending === 'interrupt'
        ? Promise.resolve().then(() => release?.())
        : new Promise(() => {}),
    launch: async () =>
      ({
        newPage: async () => ({
          addInitScript: async () => {
            world.calls.push('force online')
          },
        }),
        close: async () => {
          world.calls.push('browser close')
        },
      }) as unknown as Browser,
    seed: async (_page, base, account) => {
      world.calls.push(`seed ${base} ${account?.email}`)
      if (world.seedFails) throw new Error('no chrome\nstack')
      return { pilot: '/build/pilots/p', game: '/play/games/g' }
    },
    log: (line) => world.logs.push(line),
    error: (line) => world.errors.push(line),
  }
  return { sys, world }
}

describe('main', () => {
  function setup() {
    const root = tree({ '.git/HEAD': '' })
    return { root, dev: `http://localhost:${portFor({ root, ci: false })}` }
  }

  test('a bad argument exits 2', async () => {
    const { sys, world } = fakeSys()
    expect(await main(['--nope'], sys, setup())).toBe(2)
    expect(world.errors[0]).toContain('usage')
  })

  test('serves with the test sign-in, seeds once, and stops on interrupt', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ comesUp: new Map([[`${s.dev}/`, s.root]]) })
    expect(await main([], sys, s)).toBe(0)
    const state = join(s.root, STATE_DIR)
    expect(world.calls[0]).toBe(
      `spawn bunx astro dev --ignore-lock true ${join(state, 'wrangler')}`
    )
    expect(world.calls).toContain(`seed ${s.dev} ${SEED_ACCOUNT.email}`)
    expect(JSON.parse(readFileSync(join(state, 'seed.json'), 'utf8'))).toEqual({
      ...SEED_ACCOUNT,
      pilot: '/build/pilots/p',
      game: '/play/games/g',
    })
    expect(world.logs.at(-1)).toContain('ready:')
    expect(world.calls.at(-1)).toBe('stop')

    // A restart keeps the seed.
    const again = fakeSys({ comesUp: world.comesUp })
    again.world.up.clear()
    expect(await main([], again.sys, s)).toBe(0)
    expect(again.world.calls.some((c) => c.startsWith('seed'))).toBe(false)

    // --fresh wipes it.
    writeFileSync(join(state, 'marker'), '')
    const fresh = fakeSys({ comesUp: world.comesUp })
    expect(await main(['--fresh'], fresh.sys, s)).toBe(0)
    expect(existsSync(join(state, 'marker'))).toBe(false)
    expect(fresh.world.calls.some((c) => c.startsWith('seed'))).toBe(true)
  })

  test('already running: exits 0 without starting anything', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ up: new Map([[`${s.dev}/`, s.root]]) })
    expect(await main([], sys, s)).toBe(0)
    expect(world.calls).toEqual([])
    expect(world.logs[0]).toContain('already running')
  })

  test('the dev port taken by something else exits 1', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ up: new Map([[`${s.dev}/`, '/another/checkout']]) })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('already taken')
  })

  test('a dev server that never answers exits 1 and is stopped', async () => {
    const { sys, world } = fakeSys()
    expect(await main([], sys, setup())).toBe(1)
    expect(world.errors[0]).toContain('the dev server did not answer within 120s')
    expect(world.calls.at(-1)).toBe('stop')
  })

  test('no browser starts: installs the headless shell into the checkout and tries again', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ comesUp: new Map([[`${s.dev}/`, s.root]]) })
    const launch = sys.launch
    let tries = 0
    sys.launch = async () => {
      if (tries++ === 0) throw new Error("Executable doesn't exist at /x")
      return launch()
    }
    expect(await main([], sys, s)).toBe(0)
    expect(world.calls).toContain('run bunx playwright install chromium-headless-shell')
    expect(world.calls).toContain('force online')
    expect(existsSync(join(s.root, STATE_DIR, 'seed.json'))).toBe(true)
  })

  test('a failed install is reported', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      comesUp: new Map([[`${s.dev}/`, s.root]]),
      run: () => ({ code: 1, stdout: '', stderr: 'offline' }),
    })
    sys.launch = async () => {
      throw new Error('nope')
    }
    expect(await main([], sys, s)).toBe(0)
    expect(world.errors[0]).toContain('installing chrome-headless-shell failed: offline')
  })

  test('a Chromium that still cannot start after the install is named as such', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ comesUp: new Map([[`${s.dev}/`, s.root]]) })
    sys.launch = async () => {
      throw new Error('Missing libnss3\nlog')
    }
    expect(await main([], sys, s)).toBe(0)
    expect(world.calls).toContain('run bunx playwright install chromium-headless-shell')
    expect(world.errors[0]).toContain('Chromium could not start: Missing libnss3')
  })

  test('a Chromium that cannot start is named as such', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ comesUp: new Map([[`${s.dev}/`, s.root]]) })
    // A headless shell already there: nothing to install, so the failure stands.
    const shell = join(s.root, '.pw-browsers/chromium_headless_shell-1/linux/chrome-headless-shell')
    mkdirSync(dirname(shell), { recursive: true })
    writeFileSync(shell, '')
    sys.launch = async () => {
      throw new Error('Target page, context or browser has been closed\nlog')
    }
    expect(await main([], sys, s)).toBe(0)
    expect(world.errors[0]).toContain(
      'Chromium could not start: Target page, context or browser has been closed)'
    )
    expect(world.calls.some((c) => c.includes('playwright install'))).toBe(false)
  })

  test('a failed seed warns and the site still runs; a server that exits ends it with 1', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      comesUp: new Map([[`${s.dev}/`, s.root]]),
      seedFails: true,
      ending: 'exit',
    })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('the seed failed, so nothing is signed in (no chrome)')
    expect(world.calls).toContain('browser close')
    expect(existsSync(join(s.root, STATE_DIR, 'seed.json'))).toBe(false)
    expect(world.errors[1]).toContain('the dev server exited')
  })
})

describe('realSys', () => {
  const dir = tree({})
  const server = Bun.serve({
    port: 0,
    fetch: () => new Response('payload', { headers: { [CHECKOUT_HEADER]: '/x' } }),
  })
  afterAll(() => server.stop(true))
  const url = `http://localhost:${server.port}`

  test('run captures output and the exit code', async () => {
    expect(
      await realSys.run(['sh', '-c', 'echo out; echo err >&2; exit 3'], dir, { X: '1' })
    ).toEqual({ code: 3, stdout: 'out\n', stderr: 'err\n' })
  })

  test('spawn logs to its file and stops its group', async () => {
    const log = join(dir, 'child.log')
    const child = realSys.spawn(['sh', '-c', 'echo started; exec sleep 30'], dir, log)
    await realSys.sleep(300)
    child.stop()
    expect(await child.exited).not.toBe(0)
    expect(readFileSync(log, 'utf8')).toContain('started')
  })

  test('probe reads the header, or undefined when nothing answers', async () => {
    expect(await realSys.probe(`${url}/`)).toBe('/x')
    expect(await realSys.probe('http://127.0.0.1:9/')).toBeUndefined()
  })

  test('interrupted resolves on SIGTERM', async () => {
    const done = realSys.interrupted()
    process.emit('SIGTERM')
    await done
  })
})
