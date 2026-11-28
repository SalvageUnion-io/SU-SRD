/**
 * NO DEAD LINKS. The corpus-wide scan runs in the build (`./site`, over every
 * page it wrote); this suite covers how one link resolves, against the app's
 * real route tree.
 */

import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appRouteMatchers,
  assertNoDeadLinks,
  redirectSources,
  resolves,
  siteLinks,
} from '../deadLinks'

const routeTree = readFileSync(new URL('../../../src/routeTree.gen.ts', import.meta.url), 'utf-8')

const site = {
  wrote: (path: string) => ['/', '/abilities/mech-gyver/', '/favicon.ico'].includes(path),
  redirects: redirectSources('# a comment\n/titans/  /bio-titans/  301\n'),
  appRoutes: appRouteMatchers(routeTree),
}

describe('a link resolves', () => {
  it('to a page or file the build wrote, or a path _redirects moves', () => {
    expect(resolves('/abilities/mech-gyver/', site)).toBe(true)
    expect(resolves('/favicon.ico', site)).toBe(true)
    expect(resolves('/titans/', site)).toBe(true)
    expect(resolves('/abilities/nope/', site)).toBe(false)
  })

  it('to an app route, with or without its trailing slash, its params any one segment', () => {
    for (const path of [
      '/build/',
      '/build/sign-in',
      '/build/patterns/',
      '/build/starter',
      '/build/starter/pilot/starter-pilot-bonesaw',
      '/build/mechs/new',
      '/games/',
      '/games/abc/mediate',
    ]) {
      expect(resolves(path, site)).toBe(true)
    }
  })

  it('never to an SRD path under the app, which its shell answers with Page Not Found', () => {
    expect(resolves('/build/abilities/mech-gyver', site)).toBe(false)
    expect(resolves('/build/chassis/mule/', site)).toBe(false)
    expect(resolves('/build/build/mechs/new', site)).toBe(false)
    expect(resolves('/build/starter/pilot/x/y', site)).toBe(false)
  })
})

describe('the links a page carries', () => {
  it('are its root-relative hrefs and srcs, up to the query or hash; never another host', () => {
    const html =
      '<a href="/chassis/mule/#top">m</a><img src="/logos/a.svg"><a href="//cdn.example/x">x</a>' +
      '<a href="https://salvageunion.io/x">y</a><a href="/build/mechs/new?mode=guided">z</a>'
    expect(siteLinks(html)).toEqual(['/chassis/mule/', '/logos/a.svg', '/build/mechs/new'])
  })
})

describe('a built site, scanned whole', () => {
  function built(pages: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'dead-links-'))
    for (const [file, text] of Object.entries(pages)) {
      mkdirSync(join(dir, file, '..'), { recursive: true })
      writeFileSync(join(dir, file), text)
    }
    return dir
  }

  it('holds when every link opens a file, a page, a redirect or an app route', async () => {
    const dir = built({
      _redirects: '/titans/  /bio-titans/  301\n',
      'favicon.ico': '',
      'index.html':
        '<link href="/favicon.ico"><a href="/chassis/mule/">m</a><a href="/titans/">t</a>' +
        '<a href="/build/mechs/new">n</a><a href="/chassis/mule/#stats">s</a>' +
        '<a href="https://example.com/nope">x</a>',
      'chassis/mule/index.html': '<a href="/">home</a><a href="/chassis/mule/">self</a>',
    })
    try {
      await assertNoDeadLinks(dir, routeTree)
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('refuses a site with a link that opens nothing, naming it and its pages', async () => {
    const dir = built({
      _redirects: '',
      'index.html':
        '<a href="/chassis/nope/">n</a><a href="/build/no-such-route">r</a>' +
        '<img src="/art/gone.png"><a href="/bad%E0%A4%A/">bad</a>',
      'chassis/index.html': '<a href="/chassis/nope/">n</a><a href="/">home</a>',
    })
    try {
      const refusal = await assertNoDeadLinks(dir, routeTree).then(
        () => null,
        (error: Error) => error.message
      )
      expect(refusal).toContain('4 link target(s) open nothing')
      expect(refusal).toContain('  /build/no-such-route\n    from index.html')
      expect(refusal).toContain('  /art/gone.png\n    from index.html')
      expect(refusal).toMatch(
        / {2}\/chassis\/nope\/\n {4}from (index\.html, chassis\/index\.html|chassis\/index\.html, index\.html)/
      )
      // A directory with no index.html is not a page.
      expect(refusal).not.toContain('  /\n')
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('shows fifteen targets and counts the rest', async () => {
    const dir = built({
      _redirects: '',
      'index.html': Array.from({ length: 17 }, (_, i) => `<a href="/gone-${i}/">g</a>`).join(''),
    })
    try {
      await expect(assertNoDeadLinks(dir, routeTree)).rejects.toThrow(/\.\.\.and 2 more/)
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('a route tree that names no routes is refused outright', () => {
    expect(() => appRouteMatchers('export const routeTree = {}')).toThrow(/names no routes/)
  })
})
