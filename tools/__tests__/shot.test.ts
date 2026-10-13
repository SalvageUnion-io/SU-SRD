import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { WIDTH_PRESETS } from 'catalog/src/catalogRoute'
import { CHECKOUT_ROOT, portFor } from 'gates/ports'
import { fileName, ITUN_BASE, isOwnServer, NO_BACKEND, parseArgs, planShot, WIDTHS } from '../shot'

/**
 * `tools/shot.ts` — argument parsing and the target → server/path/file plan.
 * The browser and dev-server halves are exercised by running it.
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
