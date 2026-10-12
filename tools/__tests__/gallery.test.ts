import { describe, expect, test } from 'bun:test'
import { pageEntity, parseGalleryArgs, resolvePath } from '../gallery'
import type { PullRequest } from '../gallery-pages'
import { publishable, renderIndex } from '../gallery-pages'
import { escapeHtml, renderGallery } from '../lib/galleryHtml'
import { GALLERY_SECTIONS, pageSlug } from '../lib/galleryPages'

describe('parseGalleryArgs', () => {
  test('reads every flag, trimming trailing slashes off the bases', () => {
    const args = parseGalleryArgs([
      '--srd',
      'http://localhost:4321/',
      '--itun=http://localhost:5173',
      '--signed-in',
      '--pr',
      '1344',
      '--sha',
      'abc1234',
      '--linkable',
    ])
    expect(args).toMatchObject({
      srd: 'http://localhost:4321',
      itun: 'http://localhost:5173',
      signedIn: true,
      pr: 1344,
      sha: 'abc1234',
      linkable: true,
    })
  })

  test('refuses a run with no srd, a signed-in run with no itun, and a bad PR', () => {
    expect(() => parseGalleryArgs([])).toThrow('--srd is required')
    expect(() => parseGalleryArgs(['--srd', 'x', '--signed-in'])).toThrow(
      '--signed-in needs --itun'
    )
    expect(() => parseGalleryArgs(['--srd', 'x', '--pr', 'nope'])).toThrow('--pr must be')
    expect(() => parseGalleryArgs(['--srd', 'x', '--what'])).toThrow('unknown argument')
  })
})

describe('pageEntity', () => {
  test("reads an entity's and a pattern's page, and nothing else", () => {
    expect(pageEntity('/schema/chassis/item/mazona/')).toEqual({
      schema: 'chassis',
      item: 'mazona',
    })
    expect(pageEntity('/schema/chassis/item/mazona/pattern/buzzard/')).toEqual({
      schema: 'chassis',
      item: 'mazona',
      pattern: 'buzzard',
    })
    expect(pageEntity('/schema/chassis/')).toBeUndefined()
    expect(pageEntity('/')).toBeUndefined()
  })
})

describe('resolvePath', () => {
  test('a placeholder resolves to what the seed made, or to nothing', () => {
    expect(resolvePath('/pilots/new', {})).toBe('/pilots/new')
    expect(resolvePath(':pilot', { pilot: '/sheet/pilot/1' })).toBe('/sheet/pilot/1')
    expect(resolvePath(':game', {})).toBeUndefined()
  })
})

describe('the page list', () => {
  test('every page has its own file stem', () => {
    const slugs = GALLERY_SECTIONS.flatMap((s) => s.pages).map(pageSlug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('renderGallery', () => {
  const run = {
    sha: 'abcdef1234',
    pr: 7,
    bases: { srd: 'http://localhost:4321', itun: 'http://localhost:5173' },
    linkable: false,
    capturedAt: '2026-10-12 09:00 UTC',
  }

  test('shows only the pages that were shot, escaped, with the failures on top', () => {
    const [first] = GALLERY_SECTIONS[0]?.pages ?? []
    if (!first) throw new Error('no pages')
    const html = renderGallery(
      {
        sections: GALLERY_SECTIONS,
        shot: new Set([pageSlug(first)]),
        og: new Map([[pageSlug(first), { title: '<Contents>', image: true }]]),
        failures: ['srd /x: answered 500'],
      },
      run
    )
    expect(html).toContain('PR #7 gallery')
    expect(html).toContain(`shots/${pageSlug(first)}-desk.jpg`)
    expect(html).toContain('&lt;Contents&gt;')
    expect(html).toContain('1 not captured')
    expect(html).not.toContain('id="itun-edit"')
  })

  test('escapes markup', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;')
  })
})

describe('gallery-pages', () => {
  const pr = (number: number, repo: string | null): PullRequest => ({
    number,
    title: `PR ${number}`,
    head: { sha: 'f00', repo: repo ? { full_name: repo } : null },
    html_url: `https://github.com/o/r/pull/${number}`,
  })

  test("publishes this repository's PRs and never a fork's", () => {
    const prs = [pr(1, 'o/r'), pr(2, 'someone/r'), pr(3, null)]
    expect(publishable(prs, 'o/r').map((p) => p.number)).toEqual([1])
  })

  test('the index lists the newest PR first, escaped', () => {
    const html = renderIndex(
      [
        { number: 3, title: 'Old', sha: 'a', capturedAt: '', url: 'u' },
        { number: 9, title: '<New>', sha: 'b', capturedAt: '', url: 'u' },
      ],
      'o/r'
    )
    expect(html.indexOf('#9')).toBeLessThan(html.indexOf('#3'))
    expect(html).toContain('&lt;New&gt;')
  })
})
