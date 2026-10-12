import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import { WIDTH_PRESETS } from 'catalog/src/catalogRoute'
import { fileName, parseArgs, planShot, WIDTHS } from '../shot'

/**
 * `tools/shot.ts` — argument parsing and the target → server/path/file plan.
 * The browser and dev-server halves are exercised by running it.
 */

describe('parseArgs', () => {
  test('defaults to the page width, light, .shots/', () => {
    const args = parseArgs(['atoms--button--primary'])
    expect(args).toMatchObject({ target: 'atoms--button--primary', width: 'page', dark: false })
    expect(args.out.endsWith('.shots')).toBe(true)
  })

  test('reads --width, --dark and --out in either form', () => {
    expect(parseArgs(['/about', '--width', 'phone', '--dark', '--out=tmp/x'])).toEqual({
      target: '/about',
      width: 'phone',
      dark: true,
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
  ])('rejects %p with the usage line', (argv) => {
    expect(() => parseArgs(argv)).toThrow('usage: bun run shot')
  })
})

describe('planShot', () => {
  test('a /route goes to the srd dev server as is', () => {
    expect(planShot({ target: '/schema/chassis/item/mule/', width: 'page' })).toEqual({
      server: { name: 'srd', port: 4321, script: 'dev' },
      path: '/schema/chassis/item/mule/',
    })
  })

  test('anything else is a story, canvas-only at the preset width', () => {
    const { server, path } = planShot({ target: 'atoms--button--primary', width: 'phone' })
    expect(server.port).toBe(61000)
    expect(path).toBe('/?story=atoms--button--primary&mode=canvas&width=phone')
  })
})

test('fileName slugs the target and marks the width and dark', () => {
  expect(fileName({ target: '/schema/chassis/item/mule/', width: 'column', dark: false })).toBe(
    'schema-chassis-item-mule-column.png'
  )
  expect(fileName({ target: '/', width: 'page', dark: true })).toBe('home-page-dark.png')
  expect(fileName({ target: 'atoms--button--primary', width: 'phone', dark: false })).toBe(
    'atoms--button--primary-phone.png'
  )
})

test('the widths match the story catalog presets', () => {
  expect(WIDTHS).toEqual(WIDTH_PRESETS)
})
