/**
 * `public/_headers` — what the browser is told it may cache, and for how long.
 *
 * Three properties, each one a way a returning visitor gets stuck on an old
 * file:
 *
 * - `immutable` belongs to content-hashed URLs only, and srd's only hashed
 *   path is `/assets/*`. A fixed name marked immutable (the old `/*.png` …
 *   `/*.svg` rules) can never be updated in a browser that has it.
 * - Every path gets ONE Cache-Control. Cloudflare applies every matching rule
 *   and joins a repeated header with a comma, so overlapping rules produce
 *   `public, max-age=31536000, immutable, public, max-age=3600, …` — measured
 *   on production for the doubled-immutable case.
 * - No rule gives an HTML page a lifetime: pages take the platform default,
 *   `max-age=0, must-revalidate`.
 *
 * The matcher follows Cloudflare's documented `_headers` syntax: `*` is a splat
 * that matches anything, slashes included; `:name` matches one path segment.
 */

import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const PUBLIC_DIR = fileURLToPath(new URL('../../public', import.meta.url))

type Rule = { pattern: string; matcher: RegExp; headers: Map<string, string> }

function compile(pattern: string): RegExp {
  const source = pattern
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part) => {
      if (part === '*') return '.*'
      if (part.startsWith(':')) return '[^/]+'
      return part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('')
  return new RegExp(`^${source}$`)
}

function parseHeaders(text: string): Rule[] {
  const rules: Rule[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '' || line.trim().startsWith('#')) continue
    if (line.startsWith('/')) {
      const pattern = line.trim()
      rules.push({ pattern, matcher: compile(pattern), headers: new Map() })
      continue
    }
    const colon = line.indexOf(':')
    const rule = rules.at(-1)
    if (rule && colon > 0) {
      rule.headers.set(line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim())
    }
  }
  return rules
}

const RULES = parseHeaders(readFileSync(join(PUBLIC_DIR, '_headers'), 'utf-8'))

/** Every Cache-Control value Cloudflare would join together for `path`. */
function cacheControlsFor(path: string): string[] {
  return RULES.filter((rule) => rule.matcher.test(path)).flatMap((rule) => {
    const value = rule.headers.get('cache-control')
    return value === undefined ? [] : [value]
  })
}

/** URL paths of every image shipped from `public/` — all fixed names. */
function publicImages(dir = PUBLIC_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) return publicImages(full)
    if (!/\.(png|jpe?g|webp|svg|gif|avif)$/i.test(entry.name)) return []
    return [`/${relative(PUBLIC_DIR, full).split(sep).join('/')}`]
  })
}

describe('immutable is for content-hashed URLs only', () => {
  test('no rule but /assets/* says immutable', () => {
    const immutable = RULES.filter((rule) =>
      rule.headers.get('cache-control')?.includes('immutable')
    ).map((rule) => rule.pattern)
    expect(immutable).toEqual(['/assets/*'])
  })

  test.each([
    '/assets/eldridge-coast-map-BzRW_gBE.webp',
    '/assets/islands-D109A2bT.js',
    '/assets/styles-Cu7r9SFx.css',
    '/assets/barlow-latin-400-normal-qiz4-Cze.woff2',
    '/assets/some-icon-AbC123.svg',
    '/assets/some-image-AbC123.png',
  ])('%s gets exactly one Cache-Control, immutable', (path) => {
    expect(cacheControlsFor(path)).toEqual(['public, max-age=31536000, immutable'])
  })
})

describe('fixed-name images can change under a returning visitor', () => {
  const images = publicImages()

  test('the scan found the public images', () => {
    // A scan that silently found nothing would pass every assertion below.
    expect(images).toContain('/og-image.png')
    expect(images.length).toBeGreaterThanOrEqual(10)
  })

  test.each(publicImages())('%s is never immutable, and is never double-headed', (path) => {
    const values = cacheControlsFor(path)
    expect(values.length).toBeLessThanOrEqual(1)
    for (const value of values) expect(value).not.toContain('immutable')
  })

  test.each([
    '/og-image.png',
    '/web-app-manifest-512x512.png',
    '/favicons/su/favicon.svg',
    '/schema/chassis/item/mule.og.png',
    '/schema/chassis/item/mule/pattern/hauler.og.png',
  ])('%s is short-lived with revalidation', (path) => {
    expect(cacheControlsFor(path)).toEqual(['public, max-age=3600, stale-while-revalidate=86400'])
  })
})

describe('pages', () => {
  test.each(['/', '/about/', '/schema/chassis/item/mule/'])(
    '%s takes the platform default (max-age=0, must-revalidate)',
    (path) => {
      expect(cacheControlsFor(path)).toEqual([])
    }
  )
})
