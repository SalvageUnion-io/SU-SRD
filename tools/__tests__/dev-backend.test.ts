/**
 * `tools/dev-backend.ts` — the pins it reads off CI's action, the binary it
 * picks, and the start-up sequence against a stand-in machine. `realSys` is
 * exercised against throwaway local processes and servers.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Browser } from '@playwright/test'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import type { RunResult, Sys } from '../dev-backend'
import {
  authKeys,
  backendPins,
  backendPorts,
  backendUrl,
  binariesDir,
  main,
  parseArgs,
  realSys,
  resolveBinary,
  SEED_ACCOUNT,
  STATE_DIR,
} from '../dev-backend'
import { fixtureTrees } from './fixtureTree'

const tree = fixtureTrees('dev-backend')

const PINS = { version: 'precompiled-x', sha256: 'a'.repeat(64) }
const ACTION = `env:\n  CONVEX_BACKEND_VERSION: ${PINS.version}\n  CONVEX_BACKEND_SHA256: ${PINS.sha256}\n`

describe('parseArgs', () => {
  test('reads --fresh, and nothing else', () => {
    expect(parseArgs([])).toEqual({ fresh: false })
    expect(parseArgs(['--fresh'])).toEqual({ fresh: true })
    expect(() => parseArgs(['--port'])).toThrow('usage: bun run dev:backend')
  })
})

describe('backendPins', () => {
  test("reads CI's own pins, so the two never drift", () => {
    const yml = readFileSync(
      join(CHECKOUT_ROOT, '.github/actions/convex-backend/action.yml'),
      'utf8'
    )
    const pins = backendPins(yml)
    expect(pins.version).toStartWith('precompiled-')
    expect(pins.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(backendPins(ACTION)).toEqual(PINS)
  })

  test('an action without them is an error', () => {
    expect(() => backendPins('env: {}')).toThrow('names no pinned backend')
  })
})

test('backendUrl names the asset for the platform', () => {
  const base = 'https://github.com/get-convex/convex-backend/releases/download/v/'
  expect(backendUrl('v', 'x64', 'linux')).toBe(
    `${base}convex-local-backend-x86_64-unknown-linux-gnu.zip`
  )
  expect(backendUrl('v', 'arm64', 'linux')).toEndWith('aarch64-unknown-linux-gnu.zip')
  expect(backendUrl('v', 'arm64', 'darwin')).toEndWith('aarch64-apple-darwin.zip')
  expect(backendUrl('v', 'x64', 'darwin')).toEndWith('x86_64-apple-darwin.zip')
})

test("backendPorts clear convex dev --local's 3210 and follow the checkout's offset", () => {
  expect(backendPorts(tree({ '.git/HEAD': '' }))).toEqual({ api: 3310, site: 3311 })
  const worktree = backendPorts(tree({ '.git': 'gitdir: x' }))
  expect(worktree.api).toBeGreaterThan(3311)
  expect(worktree.site).toBe(worktree.api + 1)
})

test('authKeys makes a PKCS#8 key and its JWKS', async () => {
  const { privateKey, jwks } = await authKeys()
  expect(privateKey).toStartWith('-----BEGIN PRIVATE KEY-----')
  expect(JSON.parse(jwks).keys[0]).toMatchObject({ kty: 'RSA', use: 'sig', alg: 'RS256' })
})

/** What the stand-in machine was asked to do, and how it answers. */
type World = {
  calls: string[]
  logs: string[]
  errors: string[]
  /** URLs that answer, and the checkout header each names. */
  up: Map<string, string | null>
  /** URLs that come up once something is spawned. */
  comesUp: Map<string, string | null>
  run: (cmd: readonly string[]) => RunResult
  downloadFails?: boolean
  sha?: string
  /** What `interrupted` and the children's exits do. */
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
    run: (cmd) => (cmd.includes('keygen') ? ok('log line\nadmin-key-1\n') : ok()),
    ending: 'interrupt',
    ...over,
  }
  let release: (() => void) | undefined
  const ended = new Promise<void>((resolve) => {
    release = resolve
  })
  const sys: Sys = {
    run: async (cmd, _cwd, env) => {
      world.calls.push(
        `run ${cmd.join(' ')}${env?.CONVEX_DEPLOYMENT === '' ? ' [no deployment]' : ''}`
      )
      return world.run(cmd)
    },
    spawn: (cmd, _cwd, _log, env) => {
      world.calls.push(`spawn ${cmd[0]?.split('/').pop()} ${env?.VITE_CONVEX_URL ?? ''}`.trim())
      for (const [url, header] of world.comesUp) {
        if (cmd[0] === 'bun' ? url.includes('localhost') : !url.includes('localhost'))
          world.up.set(url, header)
      }
      return {
        exited: world.ending === 'exit' ? Promise.resolve(1) : ended.then(() => 0),
        stop: () => world.calls.push(`stop ${cmd[0]?.split('/').pop()}`),
      }
    },
    probe: async (url) => (world.up.has(url) ? world.up.get(url) : undefined),
    download: async (url, file) => {
      world.calls.push(`download ${url.split('/').pop()}`)
      if (world.downloadFails) throw new Error('offline')
      writeFileSync(file, 'zip')
    },
    sha256: async () => world.sha ?? PINS.sha256,
    sleep: async () => {},
    interrupted: () =>
      world.ending === 'interrupt'
        ? Promise.resolve().then(() => release?.())
        : new Promise(() => {}),
    launch: async () =>
      ({
        newPage: async () => ({}),
        close: async () => {
          world.calls.push('browser close')
        },
      }) as unknown as Browser,
    seed: async (_page, base, account) => {
      world.calls.push(`seed ${base} ${account?.email}`)
      if (world.seedFails) throw new Error('no chrome\nstack')
      return { pilot: '/build/sheet/pilot/p', game: '/build/play/games/g' }
    },
    log: (line) => world.logs.push(line),
    error: (line) => world.errors.push(line),
  }
  return { sys, world }
}

describe('resolveBinary', () => {
  const unzipping = (cmd: readonly string[]) => {
    if (cmd[0] === 'unzip') writeFileSync(join(cmd[4] ?? '', 'convex-local-backend'), 'bin')
    return ok()
  }

  test('a cached pinned binary is used as is', async () => {
    const home = tree({ [`.cache/convex/binaries/${PINS.version}/convex-local-backend`]: 'bin' })
    const { sys, world } = fakeSys()
    expect(await resolveBinary(sys, PINS, home)).toBe(
      join(binariesDir(home), PINS.version, 'convex-local-backend')
    )
    expect(world.calls).toEqual([])
  })

  test('otherwise it is downloaded, checked, unzipped into the shared cache', async () => {
    const home = tree({})
    const { sys, world } = fakeSys({ run: unzipping })
    const binary = await resolveBinary(sys, PINS, home)
    expect(existsSync(binary)).toBe(true)
    expect(existsSync(join(binariesDir(home), PINS.version, 'backend.zip'))).toBe(false)
    expect(world.calls[0]).toStartWith('download convex-local-backend-')
    expect(world.calls[1]).toStartWith('run unzip -oq')
    expect(world.calls[2]).toStartWith('run chmod +x')
  })

  test('a bad checksum falls back to the newest cached binary, with a warning', async () => {
    const home = tree({
      '.cache/convex/binaries/precompiled-1/convex-local-backend': 'bin',
      '.cache/convex/binaries/precompiled-2/convex-local-backend': 'bin',
      '.cache/convex/binaries/precompiled-3/empty': '',
    })
    const { sys, world } = fakeSys({ sha: 'b'.repeat(64) })
    expect(await resolveBinary(sys, PINS, home)).toBe(
      join(binariesDir(home), 'precompiled-2', 'convex-local-backend')
    )
    expect(world.errors[0]).toContain('checksum')
    expect(world.errors[0]).toContain('running the cached precompiled-2')
    expect(existsSync(join(binariesDir(home), PINS.version))).toBe(false)
  })

  test('a failed unzip with nothing cached is an error naming both', async () => {
    const { sys } = fakeSys({ run: () => ({ code: 9, stdout: '', stderr: 'no unzip' }) })
    await expect(resolveBinary(sys, PINS, tree({}))).rejects.toThrow(
      /unzip failed: no unzip\) and .* holds none/
    )
  })

  test('offline with no cache directory at all is an error', async () => {
    const { sys } = fakeSys({ downloadFails: true })
    await expect(resolveBinary(sys, PINS, tree({}))).rejects.toThrow('(offline)')
  })
})

describe('main', () => {
  /** A checkout with the action, and a home with the pinned binary cached. */
  function setup() {
    const root = tree({ '.git/HEAD': '', '.github/actions/convex-backend/action.yml': ACTION })
    const home = tree({ [`.cache/convex/binaries/${PINS.version}/convex-local-backend`]: 'bin' })
    const dev = `http://localhost:${portFor({ root, ci: false })}`
    return { root, home, dev, api: 'http://127.0.0.1:3310' }
  }

  test('a bad argument exits 2', async () => {
    const { sys, world } = fakeSys()
    expect(await main(['--nope'], sys, setup())).toBe(2)
    expect(world.errors[0]).toContain('usage')
  })

  test('starts, provisions, pushes, serves, seeds once, and stops both on interrupt', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      comesUp: new Map([
        [`${s.api}/version`, null],
        [`${s.dev}/`, s.root],
      ]),
    })
    expect(await main([], sys, s)).toBe(0)
    const state = join(s.root, STATE_DIR)
    const runs = world.calls.filter((c) => c.startsWith('run bunx convex'))
    expect(runs.map((c) => c.split(' --env-file')[0])).toEqual([
      'run bunx convex env get JWKS',
      expect.stringContaining('env set JWT_PRIVATE_KEY --from-file'),
      expect.stringContaining('env set JWKS --from-file'),
      'run bunx convex env set TEST_AUTH true',
      `run bunx convex env set SITE_URL ${s.dev}/build`,
      'run bunx convex deploy -y',
    ])
    // Every convex call names its own env file and blanks CONVEX_DEPLOYMENT.
    expect(runs.every((c) => c.endsWith(`${state}/convex.env [no deployment]`))).toBe(true)
    expect(readFileSync(join(state, 'convex.env'), 'utf8')).toContain(
      'CONVEX_SELF_HOSTED_ADMIN_KEY=admin-key-1'
    )
    // The keypair's files never outlive the call that read them.
    expect(existsSync(join(state, 'jwt.key'))).toBe(false)
    expect(world.calls).toContain(`spawn bun ${s.api}`)
    expect(world.calls).toContain(`seed ${s.dev} ${SEED_ACCOUNT.email}`)
    expect(JSON.parse(readFileSync(join(state, 'seed.json'), 'utf8'))).toEqual({
      ...SEED_ACCOUNT,
      pilot: '/build/sheet/pilot/p',
      game: '/build/play/games/g',
    })
    expect(world.logs.at(-1)).toContain('ready:')
    expect(world.calls.slice(-2)).toEqual(['stop bun', 'stop convex-local-backend'])

    // A restart keeps the secret and the seed, and an existing keypair.
    const secret = readFileSync(join(state, 'instance-secret'), 'utf8')
    const again = fakeSys({
      comesUp: world.comesUp,
      run: (cmd) =>
        cmd.includes('keygen') ? ok('admin-key-1') : cmd.includes('get') ? ok('{"keys":[]}') : ok(),
    })
    expect(await main([], again.sys, s)).toBe(0)
    expect(again.world.calls.some((c) => c.includes('JWT_PRIVATE_KEY'))).toBe(false)
    expect(again.world.calls.some((c) => c.startsWith('seed'))).toBe(false)
    expect(readFileSync(join(state, 'instance-secret'), 'utf8')).toBe(secret)

    // --fresh wipes it.
    const fresh = fakeSys({ comesUp: world.comesUp })
    expect(await main(['--fresh'], fresh.sys, s)).toBe(0)
    expect(readFileSync(join(state, 'instance-secret'), 'utf8')).not.toBe(secret)
    expect(fresh.world.calls.some((c) => c.startsWith('seed'))).toBe(true)
  })

  test('already running: exits 0 without starting anything', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      up: new Map([
        [`${s.api}/version`, null],
        [`${s.dev}/`, s.root],
      ]),
    })
    expect(await main([], sys, s)).toBe(0)
    expect(world.calls).toEqual([])
    expect(world.logs[0]).toContain('already running')
  })

  test.each([
    ['the backend port', 'api'],
    ['the dev port', 'dev'],
  ])('%s taken by something else exits 1', async (_, which) => {
    const s = setup()
    const url = which === 'api' ? `${s.api}/version` : `${s.dev}/`
    const { sys, world } = fakeSys({ up: new Map([[url, '/another/checkout']]) })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('already taken')
  })

  test('a backend that never answers exits 1 and is stopped', async () => {
    const { sys, world } = fakeSys()
    expect(await main([], sys, setup())).toBe(1)
    expect(world.errors[0]).toContain('the backend did not answer within 60s')
    expect(world.calls.at(-1)).toBe('stop convex-local-backend')
  })

  test('a dev server that never answers exits 1', async () => {
    const s = setup()
    const { sys, world } = fakeSys({ comesUp: new Map([[`${s.api}/version`, null]]) })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('the dev server did not answer within 120s')
  })

  test('no admin key exits 1', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      comesUp: new Map([[`${s.api}/version`, null]]),
      run: () => ok(''),
    })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('keygen produced no admin key')
  })

  test('a failed push exits 1 with what the CLI said', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      comesUp: new Map([[`${s.api}/version`, null]]),
      run: (cmd) =>
        cmd.includes('keygen')
          ? ok('k')
          : cmd.includes('deploy')
            ? { code: 1, stdout: 'schema invalid', stderr: '' }
            : ok(),
    })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('convex deploy -y failed:\nschema invalid')
  })

  test('a failed seed warns and the site still runs; a child that exits ends it with 1', async () => {
    const s = setup()
    const { sys, world } = fakeSys({
      comesUp: new Map([
        [`${s.api}/version`, null],
        [`${s.dev}/`, s.root],
      ]),
      seedFails: true,
      ending: 'exit',
    })
    expect(await main([], sys, s)).toBe(1)
    expect(world.errors[0]).toContain('the seed failed, so nothing is signed in (no chrome)')
    expect(world.calls).toContain('browser close')
    expect(existsSync(join(s.root, STATE_DIR, 'seed.json'))).toBe(false)
    expect(world.errors[1]).toContain('a process exited')
  })
})

describe('realSys', () => {
  const dir = tree({})
  const server = Bun.serve({
    port: 0,
    fetch: (req) =>
      new URL(req.url).pathname === '/missing'
        ? new Response('no', { status: 404 })
        : new Response('payload', { headers: { [CHECKOUT_HEADER]: '/x' } }),
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

  test('download writes the body, and refuses an error status; sha256 hashes the file', async () => {
    const file = join(dir, 'got')
    await realSys.download(`${url}/zip`, file)
    expect(readFileSync(file, 'utf8')).toBe('payload')
    expect(await realSys.sha256(file)).toBe(
      new Bun.CryptoHasher('sha256').update('payload').digest('hex')
    )
    await expect(realSys.download(`${url}/missing`, file)).rejects.toThrow('answered 404')
  })

  test('interrupted resolves on SIGTERM', async () => {
    const done = realSys.interrupted()
    process.emit('SIGTERM')
    await done
  })
})
