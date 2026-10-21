import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { resolve } from 'node:path'
import type { launchBrowser } from 'gates/lib/chromium'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import type { Server } from '../shot'
import {
  APP_BASE,
  ensureServer,
  fileName,
  isOwnServer,
  main,
  NO_BACKEND,
  parseArgs,
  planShot,
  probe,
  readSeedFile,
  WIDTHS,
} from '../shot'
import { fixtureTrees } from './fixtureTree'

/**
 * `tools/shot.ts` — argument parsing and the target → server/path/file plan.
 * The dev-server half runs against throwaway local servers; the browser half
 * is exercised by running it.
 */

describe('parseArgs', () => {
  test('defaults to the page width and .shots/', () => {
    const args = parseArgs(['/chassis/mule/'])
    expect(args).toMatchObject({ target: '/chassis/mule/', width: 'page' })
    expect(WIDTHS[args.width]).toBe(1440)
    expect(args.out.endsWith('.shots')).toBe(true)
  })

  test('reads --width and --out in either form', () => {
    expect(parseArgs(['/about', '--width', 'phone', '--out=tmp/x'])).toEqual({
      target: '/about',
      width: 'phone',
      out: resolve('tmp/x'),
      signedIn: false,
    })
    expect(parseArgs(['--width=column', '/']).width).toBe('column')
  })

  test.each([
    [[]],
    [['/a', '/b']],
    [['/a', '--width', 'tablet']],
    [['/a', '--out']],
    [['/a', '--full']],
    // Neither app has a dark theme, so there is no flag to emulate one.
    [['/a', '--dark']],
    [['app:starter']],
    // A target is a route: a bare name is neither a reference route nor an app one.
    [['atoms--button--primary']],
    // A seeded page exists only for the seeded account.
    [[':pilot']],
    [[':ship', '--signed-in']],
  ])('rejects %p with the usage line', (argv) => {
    expect(() => parseArgs(argv)).toThrow('usage: bun run shot')
  })
})

test('--signed-in takes a route or a seeded page', () => {
  expect(parseArgs([':game', '--signed-in'])).toMatchObject({ target: ':game', signedIn: true })
  expect(parseArgs(['app:/play', '--signed-in']).signedIn).toBe(true)
})

describe('planShot', () => {
  test('a seeded page is the path the seed wrote, and an unseeded one says how to make it', () => {
    const seeded = { email: 'a@b', password: 'p', pilot: '/build/sheet/pilot/x' }
    expect(planShot({ target: ':pilot' }, seeded).path).toBe('/build/sheet/pilot/x')
    expect(() => planShot({ target: ':mech' }, seeded)).toThrow('the seed made no mech')
  })

  test('the Play screens derive from the seeded pilot and Game', () => {
    const seeded = {
      email: 'a@b',
      password: 'p',
      pilot: '/build/sheet/pilot/x',
      game: '/build/play/games/g',
    }
    expect(planShot({ target: ':play' }, seeded).path).toBe('/build/play/x')
    expect(planShot({ target: ':mediate' }, seeded).path).toBe('/build/play/game/g')
    expect(() => planShot({ target: ':mediate' }, { email: 'a@b', password: 'p' })).toThrow(
      'the seed made no game'
    )
  })

  test("a /route goes to this checkout's dev server as is", () => {
    expect(planShot({ target: '/chassis/mule/' })).toEqual({
      server: expect.objectContaining({ name: 'dev', port: portFor() }),
      path: '/chassis/mule/',
    })
  })

  test('app:/route is an app route under its base, on the same signed-out server', () => {
    const { server, path } = planShot({ target: 'app:/starter' })
    expect(path).toBe(`${APP_BASE}/starter`)
    expect(server).toEqual(planShot({ target: '/' }).server)
    expect(server.cmd).toEqual(['bun', 'ssg/dev.ts'])
    expect(server.cwd.endsWith('apps/web')).toBe(true)
    expect(server.env).toEqual({ VITE_CONVEX_URL: NO_BACKEND })
    expect(planShot({ target: 'app:/' }).path).toBe(`${APP_BASE}/`)
  })
})

test('only a server naming this checkout is reused', () => {
  expect(isOwnServer(CHECKOUT_ROOT)).toBe(true)
  expect(isOwnServer('/somewhere/else')).toBe(false)
  expect(isOwnServer(null)).toBe(false)
})

test('fileName slugs the target and marks the width', () => {
  expect(fileName({ target: '/chassis/mule/', width: 'column' })).toBe('chassis-mule-column.png')
  expect(fileName({ target: '/', width: 'page' })).toBe('home-page.png')
  expect(fileName({ target: 'app:/starter', width: 'page' })).toBe('app-starter-page.png')
})

describe('the dev server', () => {
  const servers: ReturnType<typeof Bun.serve>[] = []
  afterEach(() => {
    for (const server of servers.splice(0)) server.stop(true)
  })

  /** A local server whose checkout header is `checkout` (none when null). */
  function serve(checkout: string | null): number {
    const server = Bun.serve({
      port: 0,
      hostname: 'localhost',
      fetch: () =>
        new Response('ok', { headers: checkout === null ? {} : { [CHECKOUT_HEADER]: checkout } }),
    })
    servers.push(server)
    return server.port ?? 0
  }

  /** A port nothing listens on: one a server held, then let go. */
  function closedPort(): number {
    const server = Bun.serve({ port: 0, hostname: 'localhost', fetch: () => new Response() })
    const port = server.port ?? 0
    server.stop(true)
    return port
  }

  const quietly = () => spyOn(console, 'error').mockImplementation(() => undefined)

  test('a server with no command is reused, never started', async () => {
    const port = closedPort()
    await expect(
      ensureServer({ name: 'dev:backend', port, cmd: [], cwd: CHECKOUT_ROOT })
    ).rejects.toThrow(`nothing answers on :${port}: start it with \`bun run dev:backend\``)
  })

  test('probe reads the checkout a server names: undefined for nothing, null for none', async () => {
    expect(await probe(serve(CHECKOUT_ROOT))).toBe(CHECKOUT_ROOT)
    expect(await probe(serve(null))).toBeNull()
    expect(await probe(closedPort())).toBeUndefined()
  })

  test("reuses this checkout's server and leaves it running", async () => {
    const log = quietly()
    try {
      const port = serve(CHECKOUT_ROOT)
      const stop = await ensureServer({ name: 'srd', port, cmd: ['false'], cwd: CHECKOUT_ROOT })
      stop()
      expect(await probe(port)).toBe(CHECKOUT_ROOT)
      expect(String(log.mock.calls[0]?.[0])).toContain(`reusing the srd server on :${port}`)
    } finally {
      log.mockRestore()
    }
  })

  test.each([
    ['/somewhere/else', 'the srd server of /somewhere/else'],
    [null, 'a server that does not name its checkout'],
  ])('refuses a server from %p', async (checkout, said) => {
    const port = serve(checkout)
    const server: Server = { name: 'srd', port, cmd: ['false'], cwd: CHECKOUT_ROOT }
    await expect(ensureServer(server)).rejects.toThrow(`:${port} is answered by ${said}`)
  })

  test(
    'starts one when nothing answers, on the probed port, and stops it',
    async () => {
      const log = quietly()
      try {
        const port = closedPort()
        // Answers as this checkout on the PORT it is given, with the env it is given.
        const script = `Bun.serve({ port: Number(process.env.PORT), hostname: 'localhost', fetch: () => new Response('ok', { headers: { '${CHECKOUT_HEADER}': process.env.SHOT_TEST_ROOT } }) })`
        const stop = await ensureServer({
          name: 'fake',
          port,
          cmd: [process.execPath, '-e', script],
          cwd: CHECKOUT_ROOT,
          env: { SHOT_TEST_ROOT: CHECKOUT_ROOT },
        })
        expect(await probe(port)).toBe(CHECKOUT_ROOT)
        stop()
        let after = await probe(port)
        for (let i = 0; i < 40 && after !== undefined; i++) {
          await Bun.sleep(50)
          after = await probe(port)
        }
        expect(after).toBeUndefined()
        expect(String(log.mock.calls[0]?.[0])).toContain(`starting fake`)
      } finally {
        log.mockRestore()
      }
    },
    { timeout: 30_000 }
  )

  test(
    'gives up on a server that never answers, stopping it even when its group cannot be signalled',
    async () => {
      const log = quietly()
      // Every clock read lands 91 s after the last, so the 90 s deadline passes at once.
      const start = Date.now()
      let reads = 0
      const clock = spyOn(Date, 'now').mockImplementation(() => start + 91_000 * reads++)
      const realKill = process.kill.bind(process)
      const killed: number[] = []
      const kill = spyOn(process, 'kill').mockImplementation(((pid: number, signal?: string) => {
        killed.push(pid)
        if (pid < 0) throw new Error('ESRCH')
        return realKill(pid, signal)
      }) as typeof process.kill)
      try {
        const port = closedPort()
        const server: Server = {
          name: 'silent',
          port,
          cmd: [process.execPath, '-e', 'setTimeout(() => {}, 30_000)'],
          cwd: CHECKOUT_ROOT,
        }
        await expect(ensureServer(server)).rejects.toThrow(
          `silent did not answer on :${port} within 90s`
        )
        // The group signal was tried first and refused; the fallback killed the child itself.
        expect(killed[0]).toBeLessThan(0)
      } finally {
        clock.mockRestore()
        kill.mockRestore()
        log.mockRestore()
      }
    },
    { timeout: 30_000 }
  )

  test(
    'reports a server that exits before it answers, with its stderr',
    async () => {
      const log = quietly()
      try {
        const server: Server = {
          name: 'broken',
          port: closedPort(),
          cmd: [process.execPath, '-e', 'console.error("no config"); process.exit(3)'],
          cwd: CHECKOUT_ROOT,
        }
        await expect(ensureServer(server)).rejects.toThrow(
          /broken exited \(3\) before answering:\nno config/
        )
      } finally {
        log.mockRestore()
      }
    },
    { timeout: 30_000 }
  )
})

describe('main', () => {
  const tree = fixtureTrees('shot-main')

  /** A stand-in browser recording each page call; `status` is what the page answers. */
  function fakeBrowser(status = 200) {
    const calls: string[] = []
    const page = {
      goto: async (url: string) => {
        calls.push(`goto ${url}`)
        return { ok: () => status < 400, status: () => status }
      },
      evaluate: async (script: string | ((arg: unknown) => unknown), arg?: unknown) => {
        if (typeof script === 'function') {
          const g = globalThis as { __appTestSignIn?: unknown }
          g.__appTestSignIn = async (...a: unknown[]) => calls.push(`sign in ${a.join(' ')}`)
          await script(arg)
          delete g.__appTestSignIn
          return
        }
        calls.push(`evaluate ${script.slice(0, 20)}`)
      },
      addInitScript: async (script: string) => {
        calls.push(`init ${script.slice(0, 22)}`)
      },
      waitForFunction: async () => {
        calls.push('seam')
      },
      waitForTimeout: async () => {
        calls.push('wait')
      },
      getByRole: (_role: string, { name }: { name: string }) => ({
        first: () => ({
          waitFor: async () => {
            calls.push(`attached ${name}`)
          },
        }),
      }),
      waitForLoadState: async () => {
        calls.push('settle')
      },
      screenshot: async ({ path }: { path: string }) => {
        calls.push(`screenshot ${path}`)
      },
    }
    const browser = {
      newPage: async ({ viewport }: { viewport: { width: number } }) => {
        calls.push(`page ${viewport.width}`)
        return page
      },
      close: async () => {
        calls.push('close')
      },
    }
    const launch = (async () => browser) as unknown as typeof launchBrowser
    return { calls, launch }
  }
  const run = async (argv: string[], deps: Parameters<typeof main>[1]) => {
    const out: string[] = []
    const err: string[] = []
    const code = await main(argv, {
      log: (l) => out.push(l),
      error: (l) => err.push(l),
      ...deps,
    })
    return { code, out, err }
  }

  test('a bad argument exits 2 before any server starts', async () => {
    let started = false
    const r = await run(['/x', '--width', 'huge'], {
      ensure: async () => {
        started = true
        return () => {}
      },
    })
    expect(r.code).toBe(2)
    expect(r.err).toHaveLength(1)
    expect(started).toBe(false)
  })

  test('a server that cannot start exits 2 with its reason', async () => {
    const r = await run(['/x'], {
      ensure: async () => {
        throw new Error('srd did not answer on :1 within 90s')
      },
    })
    expect(r).toMatchObject({ code: 2, err: ['[shot] srd did not answer on :1 within 90s'] })
  })

  test('shoots the route at the width, scrolls lazy art in, prints the file and cleans up', async () => {
    const out = tree({})
    const { calls, launch } = fakeBrowser(404)
    let stopped = 0
    const r = await run(['/chassis/mule/', '--width', 'phone', '--out', out], {
      ensure: async () => () => stopped++,
      launch,
    })
    expect(r.code).toBe(0)
    const file = `${out}/chassis-mule-phone.png`
    expect(r.out).toEqual([file])
    const url = `http://localhost:${portFor()}/chassis/mule/`
    expect(r.err).toEqual([`[shot] warning: ${url} answered 404`])
    expect(calls[0]).toBe('page 390')
    expect(calls[1]).toBe('init Object.defineProperty(')
    expect(calls[2]).toBe(`goto ${url}`)
    expect(calls).toContain('settle')
    expect(calls.slice(-2)).toEqual([`screenshot ${file}`, 'close'])
    expect(stopped).toBe(1)
  })

  test('--signed-in signs the seeded account in on the running server, then shoots', async () => {
    const out = tree({})
    const { calls, launch } = fakeBrowser()
    let asked: Server | undefined
    const r = await run([':game', '--signed-in', '--out', out], {
      ensure: async (server) => {
        asked = server
        return () => {}
      },
      readSeed: () => ({ email: 'a@b', password: 'pw', game: '/build/play/games/g' }),
      launch,
    })
    expect(r.code).toBe(0)
    // Never started: only the dev:backend server has a backend to sign in to.
    expect(asked).toMatchObject({ name: 'dev:backend', cmd: [] })
    const base = `http://localhost:${portFor()}`
    expect(calls.slice(2, 7)).toEqual([
      `goto ${base}${APP_BASE}/`,
      'seam',
      'sign in a@b pw signIn',
      'attached Games',
      `goto ${base}/build/play/games/g`,
    ])
    expect(calls).toContain('wait')
    expect(r.out).toEqual([`${out}/game-page.png`])
  })

  test('--signed-in with no seed exits 2 saying how to make one', async () => {
    const r = await run([':game', '--signed-in'], {
      readSeed: () => readSeedFile(tree({})),
    })
    expect(r).toMatchObject({
      code: 2,
      err: [expect.stringContaining('run `bun run dev:backend` first')],
    })
    const root = tree({ '.dev-backend/seed.json': '{"email":"e","password":"p"}' })
    expect(readSeedFile(root)).toEqual({ email: 'e', password: 'p' })
  })

  test('a browser that fails still stops the server it started', async () => {
    let stopped = 0
    await expect(
      run(['/x'], {
        ensure: async () => () => stopped++,
        launch: (async () => {
          throw new Error('no chrome')
        }) as unknown as typeof launchBrowser,
      })
    ).rejects.toThrow('no chrome')
    expect(stopped).toBe(1)
  })
})
