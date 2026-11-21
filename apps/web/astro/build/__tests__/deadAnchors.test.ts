/**
 * NO DEAD ANCHORS. The corpus-wide scan runs in the build (`./site`) and as
 * the `page-anchors` gate (`tools/check-page-anchors.ts`); this suite covers
 * how one page's in-page links are read and judged.
 */

import { describe, expect, it } from 'bun:test'
import { deadAnchorsOn, fragmentLinks, pageIds } from '../deadAnchors'

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
