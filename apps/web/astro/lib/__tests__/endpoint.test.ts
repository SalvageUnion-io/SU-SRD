/**
 * Endpoints are files, not directories: an `astro/pages/**.ts` route is
 * written at its own path (`schema/chassis.json`), never as a
 * `schema/chassis.json/index.html` directory, and the module it wraps names
 * that same path as its `pattern`.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { EndpointModule } from '../../../src/reference/types'
import { renderEndpoint } from '../endpoint'
import { outputs } from './emitted'

const PAGES = join(import.meta.dir, '../../pages')
const MODULE_IMPORT = /import \{ (\w+) as module \} from '([^']+)'/

describe('endpoint routes', () => {
  it('each sit at the path their module’s pattern names', async () => {
    const misplaced: string[] = []
    for (const file of new Bun.Glob('**/*.ts').scanSync(PAGES)) {
      const [, name = '', from = ''] =
        MODULE_IMPORT.exec(readFileSync(join(PAGES, file), 'utf-8')) ?? []
      const imported = (await import(join(PAGES, dirname(file), from))) as Record<string, unknown>
      const { pattern } = imported[name] as EndpointModule<never, never>
      // `_redirects` is a param route: Astro skips a page file whose name starts with `_`.
      const routed = file === '[redirects].ts' ? '_redirects' : file.replace(/\.ts$/, '')
      if (pattern !== routed) misplaced.push(`${file} wraps ${pattern}`)
    }
    expect(misplaced).toEqual([])
  })

  it('emit only files', () => {
    const paths = [...outputs.keys()]
    expect(paths.length).toBeGreaterThan(0)
    for (const path of paths) {
      expect(path).not.toContain('index.html')
      expect(path.startsWith('/')).toBe(false)
      expect(path.endsWith('/')).toBe(false)
      // `_redirects` is the one dotless output: Workers Static Assets reads it
      // by that exact name.
      if (path !== '_redirects') expect(path).toMatch(/\.(json|txt)$/)
    }
    // The dotted shapes, named so a pattern regression is a readable diff.
    expect(paths).toContain('llms.txt')
    expect(paths).toContain('_redirects')
    expect(paths).toContain('search-index.json')
    expect(paths).toContain('schema/chassis.json')
    expect(paths).toContain('schema/chassis.schema.json')
    expect(paths.some((path) => /^schema\/chassis\/item\/[^/]+\.json$/.test(path))).toBe(true)
  })

  it('hand an endpoint a slash-free pathname, so its URL is a file too', async () => {
    const module: EndpointModule<Record<string, string>, undefined> = {
      pattern: 'llms.txt',
      contentType: 'text/plain',
      body: (ctx) => ctx.pathname,
    }
    const response = renderEndpoint(module, {}, undefined)
    expect(await response.text()).toBe('/llms.txt')
    expect(response.headers.get('Content-Type')).toBe('text/plain')
  })
})
