/**
 * NO DEAD LINKS. The corpus-wide scan runs in the build (`./site`, over every
 * page it wrote); this suite covers how one link resolves, against the app's
 * real route tree.
 */

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { appRouteMatchers, redirectSources, resolves, siteLinks } from '../deadLinks'

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
      '/play/',
      '/play/games/abc/mediate',
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
