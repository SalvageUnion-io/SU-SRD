import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { resolve } from 'node:path'
import { WIDTH_PRESETS } from 'catalog/src/catalogRoute'
import { CHECKOUT_HEADER, CHECKOUT_ROOT, portFor } from 'gates/ports'
import type { Server } from '../shot'
import {
  ensureServer,
  fileName,
  ITUN_BASE,
  isOwnServer,
  NO_BACKEND,
  parseArgs,
  planShot,
  probe,
  WIDTHS,
} from '../shot'

/**
 * `tools/shot.ts` — argument parsing and the target → server/path/file plan.
 * The dev-server half runs against throwaway local servers; the browser half
 * is exercised by running it.
 */

describe('parseArgs', () => {
  test('defaults to the page width and .shots/', () => {
    const args = parseArgs(['atoms--button--primary'])
    expect(args).toMatchObject({ target: 'atoms--button--primary', width: 'page' })
    expect(args.out.endsWith('.shots')).toBe(true)
  })

  test('reads --width and --out in either form', () => {
    expect(parseArgs(['/about', '--width', 'phone', '--out=tmp/x'])).toEqual({
      target: '/about',
      width: 'phone',
      out: resolve('tmp/x'),
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
    [['itun:starter']],
  ])('rejects %p with the usage line', (argv) => {
    expect(() => parseArgs(argv)).toThrow('usage: bun run shot')
  })
})

describe('planShot', () => {
  test("a /route goes to this checkout's srd dev server as is", () => {
    expect(planShot({ target: '/chassis/mule/', width: 'page' })).toEqual({
      server: expect.objectContaining({ name: 'srd', port: portFor('srd') }),
      path: '/chassis/mule/',
    })
  })

  test('itun:/route is an ITUN route under its base, on its own signed-out boot', () => {
    const { server, path } = planShot({ target: 'itun:/starter', width: 'phone' })
    expect(path).toBe(`${ITUN_BASE}/starter`)
    expect(server.port).toBe(portFor('itun'))
    expect(server.cmd).toEqual([
      'bun',
      'x',
      'vite',
      '--port',
      String(portFor('itun')),
      '--strictPort',
    ])
    expect(server.cwd.endsWith('apps/itun')).toBe(true)
    expect(server.env).toEqual({ VITE_CONVEX_URL: NO_BACKEND })
    expect(planShot({ target: 'itun:/', width: 'page' }).path).toBe(`${ITUN_BASE}/`)
  })

  test('anything else is a story, canvas-only at the preset width', () => {
    const { server, path } = planShot({ target: 'atoms--button--primary', width: 'phone' })
    expect(server.port).toBe(portFor('stories'))
    expect(path).toBe('/?story=atoms--button--primary&mode=canvas&width=phone')
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
  expect(fileName({ target: 'itun:/starter', width: 'page' })).toBe('itun-starter-page.png')
  expect(fileName({ target: 'atoms--button--primary', width: 'phone' })).toBe(
    'atoms--button--primary-phone.png'
  )
})

test('the widths match the story catalog presets', () => {
  expect(WIDTHS).toEqual(WIDTH_PRESETS)
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
