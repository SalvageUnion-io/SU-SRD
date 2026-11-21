/**
 * NO DEAD ANCHORS. The corpus-wide scan runs in the build (`./site`) and as
 * the `page-anchors` gate (`tools/check-page-anchors.ts`); this suite covers
 * how one page's in-page links are read and judged.
 */

import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  assertNoDeadAnchors,
  deadAnchorReport,
  deadAnchorsOn,
  findDeadAnchors,
  fragmentLinks,
  pageIds,
} from '../deadAnchors'

describe('the fragment links a page carries', () => {
  it('are its own (#id) and another page of the site’s (/path/#id), decoded', () => {
    const html =
      '<a href="#training">t</a><a href="/classes/hacker/#tree-advanced-hacking">a</a>' +
      '<a href="/rules/?q=x#heat%20cap">h</a><a href="https://example.com/#x">x</a>' +
      '<a href="//cdn.example/#y">y</a><a href="/chassis/mule/">m</a><a href="#">top</a>'
    expect(fragmentLinks(html)).toEqual([
      { path: '', id: 'training' },
      { path: '/classes/hacker/', id: 'tree-advanced-hacking' },
      { path: '/rules/', id: 'heat cap' },
    ])
  })

  it('never a text directive, which names no element', () => {
    expect(fragmentLinks('<a href="/guides/heat/#:~:text=Heat">h</a>')).toEqual([])
  })
})

describe('the targets a page offers', () => {
  it('are every id, and a named anchor', () => {
    const html = '<h2 id="training">T</h2><section id=\'core\'></section><a name="old">o</a>'
    expect(pageIds(html)).toEqual(new Set(['training', 'core', 'old']))
  })

  it('never an id inside a script or a template’s JSON', () => {
    const html =
      '<script type="application/json">{"html":"<p id=\\"ghost\\">"}</script><p id="real">'
    expect(pageIds(html).has('real')).toBe(true)
  })
})

describe('a page’s dead anchors', () => {
  const pages: Record<string, string> = {
    '/classes/hacker/': '<h2 id="training">T</h2><a href="#training">ok</a><a href="#kit">dead</a>',
    '/abilities/worm/':
      '<a href="/classes/hacker/#training">ok</a><a href="/classes/hacker/#gone">dead</a>' +
      '<a href="/build/#pilots">the app’s</a><a href="/nowhere/#x">no page</a>',
  }
  const site = {
    idsOf: (path: string) => (path in pages ? pageIds(pages[path] as string) : undefined),
  }

  it('an in-page link with no element of that id', () => {
    expect(deadAnchorsOn('/classes/hacker/', pages['/classes/hacker/'] as string, site)).toEqual([
      '#kit',
    ])
  })

  it('a link to another built page’s missing id; a page the build did not write is not judged here', () => {
    expect(deadAnchorsOn('/abilities/worm/', pages['/abilities/worm/'] as string, site)).toEqual([
      '/classes/hacker/#gone',
    ])
  })
})

describe('a built site, scanned whole', () => {
  /** A site of pages under a fresh directory: `chassis/mule/index.html` → its HTML. */
  function site(pages: Record<string, string>): string {
    const dir = mkdtempSync(join(tmpdir(), 'dead-anchors-'))
    for (const [file, html] of Object.entries(pages)) {
      mkdirSync(join(dir, file, '..'), { recursive: true })
      writeFileSync(join(dir, file), html)
    }
    return dir
  }

  it('holds when every in-page link lands, on its own page or another', async () => {
    const dir = site({
      'index.html': '<a href="#top">t</a><a href="/classes/hacker/#tree">h</a><p id="top">',
      'classes/hacker/index.html': '<h2 id="tree">Tree</h2><a href="/#top">home</a>',
      // A page addressed by its file, and one whose path is percent-encoded.
      '404.html': '<a href="/classes/hacker/index.html#tree">h</a>',
      'bio titans/index.html': '<p id="x">',
      'guides/index.html': '<a href="/bio%20titans/#x">b</a>',
    })
    try {
      expect(await findDeadAnchors(dir)).toEqual([])
      await assertNoDeadAnchors(dir)
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('finds a link whose target is missing, on the page or across pages', async () => {
    const dir = site({
      'index.html': '<a href="#gone">g</a><a href="/classes/hacker/#nope">n</a>',
      'classes/hacker/index.html': '<h2 id="tree">Tree</h2><a href="/classes/hacker/#nope">n</a>',
    })
    try {
      const dead = await findDeadAnchors(dir)
      expect(dead.map(({ page, href }) => `${page} ${href}`).sort()).toEqual([
        'classes/hacker/index.html /classes/hacker/#nope',
        'index.html #gone',
        'index.html /classes/hacker/#nope',
      ])
      await expect(assertNoDeadAnchors(dir)).rejects.toThrow(/2 in-page link\(s\) land on nothing/)
    } finally {
      rmSync(dir, { recursive: true })
    }
  })

  it('judges neither the app’s shell nor a link into it, a page the build did not write, nor a path that cannot be decoded', async () => {
    const dir = site({
      // The app's shell: what stands at its anchors is drawn in the browser.
      'build/index.html': '<a href="#pilots">p</a>',
      'index.html':
        '<a href="/build/#pilots">p</a><a href="/games/#mediators-kit">k</a>' +
        '<a href="/not-built/#x">x</a><a href="/bad%E0%A4%A/#x">bad</a>',
    })
    try {
      expect(await findDeadAnchors(dir)).toEqual([])
    } finally {
      rmSync(dir, { recursive: true })
    }
  })
})

describe('the failure’s words', () => {
  it('name each dead href once with the pages that carry it, three at most', () => {
    const report = deadAnchorReport([
      ...['a.html', 'b.html', 'c.html', 'd.html', 'e.html'].map((page) => ({
        page,
        href: '/rules/#heat',
      })),
      { page: 'a.html', href: '#gone' },
    ])
    expect(report).toStartWith('2 in-page link(s) land on nothing.\n')
    expect(report).toContain('  /rules/#heat\n    from a.html, b.html, c.html (+2)')
    expect(report).toContain('  #gone\n    from a.html\n')
    expect(report).not.toContain('more')
  })

  it('show twenty and count the rest', () => {
    const report = deadAnchorReport(
      Array.from({ length: 23 }, (_, i) => ({ page: 'a.html', href: `#h${i}` }))
    )
    expect(report).toContain('#h19')
    expect(report).not.toContain('#h20')
    expect(report).toContain('...and 3 more')
  })
})
