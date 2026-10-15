import { afterAll, describe, expect, spyOn, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { GalleryPage } from 'gates/lib/galleryPages'
import { GALLERY_SECTIONS, pageSlug } from 'gates/lib/galleryPages'
import type { GalleryArgs } from '../gallery'
import {
  capturedAtStamp,
  failureLine,
  fetchOgImage,
  ogSource,
  pageEntity,
  parseGalleryArgs,
  resolvePath,
  rootOf,
  routeOf,
  signedInTargets,
  signedOutTargets,
  writeGallery,
} from '../gallery'
import type { GallerySource, PullRequest } from '../gallery-pages'
import {
  buildSite,
  githubSource,
  isMainTour,
  main,
  publishable,
  readGalleryMeta,
  readTourMeta,
  renderIndex,
} from '../gallery-pages'

const root = mkdtempSync(join(tmpdir(), 'gallery-test-'))
afterAll(() => rmSync(root, { recursive: true, force: true }))

const ALL_PAGES = GALLERY_SECTIONS.flatMap((s) => s.pages)

const warn = spyOn(console, 'warn').mockImplementation(() => {})
afterAll(() => warn.mockRestore())

/** A zip holding `files` uncompressed (method 0), enough for `unzip`. */
function storedZip(files: Record<string, string>): Uint8Array {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name)
    const d = enc.encode(text)
    const crc = Bun.hash.crc32(d)
    const local = new DataView(new ArrayBuffer(30))
    local.setUint32(0, 0x04034b50, true)
    local.setUint16(4, 20, true)
    local.setUint32(14, crc, true)
    local.setUint32(18, d.length, true)
    local.setUint32(22, d.length, true)
    local.setUint16(26, n.length, true)
    const central = new DataView(new ArrayBuffer(46))
    central.setUint32(0, 0x02014b50, true)
    central.setUint16(4, 20, true)
    central.setUint16(6, 20, true)
    central.setUint32(16, crc, true)
    central.setUint32(20, d.length, true)
    central.setUint32(24, d.length, true)
    central.setUint16(28, n.length, true)
    central.setUint32(42, offset, true)
    locals.push(new Uint8Array(local.buffer), n, d)
    centrals.push(new Uint8Array(central.buffer), n)
    offset += 30 + n.length + d.length
  }
  const cdSize = centrals.reduce((sum, b) => sum + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, Object.keys(files).length, true)
  end.setUint16(10, Object.keys(files).length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  return new Uint8Array(Buffer.concat([...locals, ...centrals, new Uint8Array(end.buffer)]))
}

describe('parseGalleryArgs', () => {
  test('reads every flag, trimming trailing slashes off the bases', () => {
    const args = parseGalleryArgs([
      '--srd',
      'http://localhost:4321/',
      '--cantina=http://localhost:5173',
      '--signed-in',
      '--pr',
      '1344',
      '--sha',
      'abc1234',
      '--linkable',
    ])
    expect(args).toMatchObject({
      srd: 'http://localhost:4321',
      cantina: 'http://localhost:5173',
      signedIn: true,
      pr: 1344,
      sha: 'abc1234',
      linkable: true,
    })
  })

  test('refuses a run with no srd, a signed-in run with no cantina, and a bad PR', () => {
    expect(() => parseGalleryArgs([])).toThrow('--srd is required')
    expect(() => parseGalleryArgs(['--srd', 'x', '--signed-in'])).toThrow(
      '--signed-in needs --cantina'
    )
    expect(() => parseGalleryArgs(['--srd', 'x', '--pr', 'nope'])).toThrow('--pr must be')
    expect(() => parseGalleryArgs(['--srd', 'x', '--what'])).toThrow('unknown argument')
  })
})

describe('pageEntity', () => {
  test("reads an entity's and a pattern's page, and nothing else", () => {
    expect(pageEntity('/chassis/mazona/')).toEqual({
      schema: 'chassis',
      item: 'mazona',
    })
    expect(pageEntity('/chassis/mazona/pattern/buzzard/')).toEqual({
      schema: 'chassis',
      item: 'mazona',
      pattern: 'buzzard',
    })
    expect(pageEntity('/chassis/')).toBeUndefined()
    expect(pageEntity('/bot/terms/')).toBeUndefined()
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

describe('parseGalleryArgs, defaults and values', () => {
  test('a bare run is signed out, unlinkable, sha "local", written to .gallery', () => {
    expect(parseGalleryArgs(['--srd', 'http://a'])).toEqual({
      srd: 'http://a',
      cantina: undefined,
      signedIn: false,
      out: resolve('.gallery'),
      sha: 'local',
      pr: undefined,
      linkable: false,
    })
  })

  test('--out resolves its directory; a flag with no value is refused', () => {
    expect(parseGalleryArgs(['--srd=http://a', '--out', 'shots-here']).out).toBe(
      resolve('shots-here')
    )
    expect(() => parseGalleryArgs(['--srd'])).toThrow('--srd needs a value')
    expect(() => parseGalleryArgs(['--srd', 'x', '--pr', '0'])).toThrow('--pr must be')
    expect(() => parseGalleryArgs(['--srd', 'x', '--pr', '1.5'])).toThrow('--pr must be')
  })

  test('every trailing slash is trimmed', () => {
    expect(parseGalleryArgs(['--srd', 'http://a///']).srd).toBe('http://a')
  })
})

describe('signedOutTargets', () => {
  test('srd alone shoots only the srd pages, each on its base', () => {
    const targets = signedOutTargets({ srd: 'http://srd' })
    expect(targets.length).toBe(ALL_PAGES.filter((p) => p.site === 'srd').length)
    for (const t of targets) {
      expect(t.page.site).toBe('srd')
      expect(t.base).toBe('http://srd')
      expect(t.url).toBe(`http://srd${t.page.path}`)
      expect(t.slug).toBe(pageSlug(t.page))
    }
  })

  test('with cantina it adds the signed-out Cantina pages, never a signed-in one', () => {
    const targets = signedOutTargets({ srd: 'http://srd', cantina: 'http://cantina' })
    const cantina = targets.filter((t) => t.page.site === 'cantina')
    expect(cantina.length).toBe(ALL_PAGES.filter((p) => p.site === 'cantina' && !p.signedIn).length)
    expect(cantina.map((t) => t.url)).toContain('http://cantina/starter')
    expect(targets.some((t) => t.page.signedIn)).toBe(false)
  })
})

describe('signedInTargets', () => {
  const signedIn = ALL_PAGES.filter((p) => p.signedIn)

  test('a full seed resolves every placeholder and fails nothing', () => {
    const { targets, failures } = signedInTargets('http://cantina', {
      pilot: '/sheet/pilot/p1',
      mech: '/sheet/mech/m1',
      crawler: '/sheet/crawler/c1',
      game: '/games/g1',
    })
    expect(failures).toEqual([])
    expect(targets.length).toBe(signedIn.length)
    const urls = targets.map((t) => t.url)
    expect(urls).toContain('http://cantina/sheet/pilot/p1')
    expect(urls).toContain('http://cantina/games/g1')
    expect(urls).toContain('http://cantina/pilots/new')
    expect(
      targets.every((t) => t.base === 'http://cantina' && t.slug.startsWith('cantina-in-'))
    ).toBe(true)
  })

  test('a failed seed still shoots the fixed paths and names each missing entity', () => {
    const { targets, failures } = signedInTargets('http://cantina', {})
    expect(targets.map((t) => t.page.path)).toEqual(
      signedIn.filter((p) => !p.path.startsWith(':')).map((p) => p.path)
    )
    expect(failures).toEqual([
      'cantina :pilot: the seed made no such entity',
      'cantina :mech: the seed made no such entity',
      'cantina :crawler: the seed made no such entity',
      'cantina :game: the seed made no such entity',
    ])
  })
})

describe('ogSource', () => {
  const srdPage = (path: string): GalleryPage => ({ site: 'srd', path, name: 'x', note: '' })

  test('an srd entity page renders its own card, whatever og:image the build emitted', () => {
    expect(
      ogSource(srdPage('/chassis/mazona/'), 'http://srd', 'https://salvageunion.io/og.png')
    ).toEqual({ kind: 'card', entity: { schema: 'chassis', item: 'mazona' } })
  })

  test('any other page fetches the og:image path from the build it was shot from', () => {
    expect(
      ogSource(srdPage('/chassis/'), 'http://srd', 'https://salvageunion.io/og/default.png')
    ).toEqual({
      kind: 'file',
      url: 'http://srd/og/default.png',
    })
    const cantinaPage: GalleryPage = {
      site: 'cantina',
      path: '/chassis/x/',
      name: 'x',
      note: '',
    }
    expect(ogSource(cantinaPage, 'http://cantina', 'https://salvageunion.io/og.png')).toEqual({
      kind: 'file',
      url: 'http://cantina/og.png',
    })
    // The Cantina's --cantina carries its base (ADR-048); the image's path already does too.
    expect(
      ogSource(cantinaPage, 'http://localhost:5173/build', 'https://salvageunion.io/build/og/x.png')
    ).toEqual({ kind: 'file', url: 'http://localhost:5173/build/og/x.png' })
  })

  test('a page with no og:image and no card has no preview', () => {
    expect(ogSource(srdPage('/'), 'http://srd', undefined)).toBeUndefined()
  })
})

describe('routeOf', () => {
  test("takes the Cantina's base off a path the app rendered, and leaves anything else", () => {
    const cantina = 'http://localhost:5173/build'
    expect(routeOf(cantina, '/build/sheet/pilot/x')).toBe('/sheet/pilot/x')
    expect(routeOf(cantina, '/build/games/g1')).toBe('/games/g1')
    expect(routeOf(cantina, 'https://example.com/a')).toBe('https://example.com/a')
    expect(routeOf('http://localhost:5173', '/sheet/pilot/x')).toBe('/sheet/pilot/x')
  })
})

describe('rootOf', () => {
  test("opens the Cantina's root with its trailing slash, based or not", () => {
    expect(rootOf('http://localhost:5173/build')).toBe('http://localhost:5173/build/')
    expect(rootOf('http://localhost:5173')).toBe('http://localhost:5173/')
  })
})

describe('failureLine and capturedAtStamp', () => {
  test('a failure keeps only the first line of its error', () => {
    expect(failureLine('srd /x', new Error('timed out\n  at stack'))).toBe('srd /x: timed out')
    expect(failureLine('cantina seed', 'plain')).toBe('cantina seed: plain')
  })

  test('the stamp is to the minute, in UTC', () => {
    expect(capturedAtStamp(new Date('2026-10-12T09:41:27.123Z'))).toBe('2026-10-12 09:41 UTC')
  })
})

describe('writeGallery', () => {
  const args = (out: string, extra: Partial<GalleryArgs> = {}): GalleryArgs => ({
    srd: 'http://srd',
    signedIn: false,
    out,
    sha: 'abcdef1234',
    linkable: false,
    ...extra,
  })
  const log = spyOn(console, 'log').mockImplementation(() => {})
  afterAll(() => log.mockRestore())

  test('writes the page and its manifest, and exits 0 when everything was shot', () => {
    const out = join(root, 'clean')
    const home = pageSlug({ site: 'srd', path: '/' })
    const code = writeGallery(
      args(out, { pr: 12 }),
      { shot: new Set([home]), og: new Map(), failures: [] },
      '2026-10-12 09:00 UTC'
    )
    expect(code).toBe(0)
    expect(readFileSync(join(out, 'index.html'), 'utf8')).toContain('PR #12 gallery')
    expect(JSON.parse(readFileSync(join(out, 'gallery.json'), 'utf8'))).toEqual({
      pr: 12,
      sha: 'abcdef1234',
      capturedAt: '2026-10-12 09:00 UTC',
      pages: 1,
      failures: [],
    })
  })

  test('a failure exits 1 and is recorded; a run with no PR records null', () => {
    const out = join(root, 'failed')
    const code = writeGallery(
      args(out),
      { shot: new Set(), og: new Map(), failures: ['srd /x: answered 500'] },
      'now'
    )
    expect(code).toBe(1)
    const manifest = JSON.parse(readFileSync(join(out, 'gallery.json'), 'utf8'))
    expect(manifest).toMatchObject({ pr: null, pages: 0, failures: ['srd /x: answered 500'] })
    expect(log).toHaveBeenCalledWith('  ✗ srd /x: answered 500')
  })
})

describe('gallery-pages, building the site', () => {
  const pr = (number: number, repo = 'o/r'): PullRequest => ({
    number,
    title: `PR ${number}`,
    head: { sha: `sha${number}`, repo: { full_name: repo } },
    html_url: `https://github.com/o/r/pull/${number}`,
  })

  test('readGalleryMeta takes the sha and time from gallery.json, else from the PR', () => {
    const dir = join(root, 'meta')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'gallery.json'),
      JSON.stringify({ pr: 5, sha: 'abc', capturedAt: 'then' })
    )
    expect(readGalleryMeta(dir, pr(5))).toEqual({
      number: 5,
      title: 'PR 5',
      sha: 'abc',
      capturedAt: 'then',
      url: 'https://github.com/o/r/pull/5',
    })
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ pr: 5, sha: 7 }))
    expect(readGalleryMeta(dir, pr(5))).toMatchObject({ sha: 'sha5', capturedAt: '' })
  })

  test('readGalleryMeta refuses another PR, a string number, unreadable JSON and no file', () => {
    const dir = join(root, 'meta-bad')
    mkdirSync(dir, { recursive: true })
    expect(readGalleryMeta(dir, pr(5))).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ pr: 6 }))
    expect(readGalleryMeta(dir, pr(5))).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ pr: '5' }))
    expect(readGalleryMeta(dir, pr(5))).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), '{not json')
    expect(readGalleryMeta(dir, pr(5))).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), 'null')
    expect(readGalleryMeta(dir, pr(5))).toBeUndefined()
  })

  test('rebuilds the site: same-repo PRs with a valid gallery in, everything else out', async () => {
    const site = join(root, 'site')
    mkdirSync(join(site, '99'), { recursive: true })
    writeFileSync(join(site, '99', 'stale.html'), 'closed PR')
    const unpacked: number[] = []
    const source: GallerySource = {
      openPrs: async () => [pr(1), pr(2), pr(3), pr(4), pr(5, 'fork/r')],
      async unpack(p, dir) {
        unpacked.push(p.number)
        if (p.number === 2) return false // no artifact
        const meta =
          p.number === 3 ? { pr: 30 } : { pr: p.number, sha: `g${p.number}`, capturedAt: 't' }
        writeFileSync(join(dir, 'gallery.json'), JSON.stringify(meta))
        writeFileSync(join(dir, 'index.html'), `gallery ${p.number}`)
        return true
      },
      unpackTour: async () => false,
    }
    const { published, open, tour } = await buildSite(site, 'o/r', source)
    expect(tour).toBeUndefined()
    expect(existsSync(join(site, 'tour'))).toBe(false)
    expect(open).toBe(4)
    expect(unpacked).toEqual([1, 2, 3, 4])
    expect(published.map((e) => e.number)).toEqual([1, 4])
    expect(existsSync(join(site, '99'))).toBe(false)
    expect(existsSync(join(site, '2'))).toBe(false)
    expect(existsSync(join(site, '3'))).toBe(false)
    expect(existsSync(join(site, '5'))).toBe(false)
    expect(readFileSync(join(site, '1', 'index.html'), 'utf8')).toBe('gallery 1')
    expect(existsSync(join(site, '.nojekyll'))).toBe(true)
    const index = readFileSync(join(site, 'index.html'), 'utf8')
    expect(index.indexOf('<strong>#4</strong>')).toBeLessThan(index.indexOf('<strong>#1</strong>'))
    expect(warn).toHaveBeenCalledWith('[gallery-pages] #3: gallery.json names another PR; skipped')
  })

  test('with no open PR the index says so', async () => {
    const site = join(root, 'site-empty')
    const { published } = await buildSite(site, 'o/r', {
      openPrs: async () => [],
      unpack: async () => true,
      unpackTour: async () => false,
    })
    expect(published).toEqual([])
    expect(readFileSync(join(site, 'index.html'), 'utf8')).toContain(
      'No open pull request has a gallery yet.'
    )
  })
})

describe('gallery-pages, the Preview Tour', () => {
  const tourSource = (meta: unknown): GallerySource => ({
    openPrs: async () => [],
    unpack: async () => false,
    async unpackTour(dir) {
      writeFileSync(join(dir, 'gallery.json'), JSON.stringify(meta))
      writeFileSync(join(dir, 'index.html'), 'tour')
      return true
    },
  })

  test('readTourMeta takes a gallery naming no PR, and refuses one naming a PR, no sha or no file', () => {
    const dir = join(root, 'tour-meta')
    mkdirSync(dir, { recursive: true })
    expect(readTourMeta(dir)).toBeUndefined()
    writeFileSync(
      join(dir, 'gallery.json'),
      JSON.stringify({ pr: null, sha: 'abc', capturedAt: 't' })
    )
    expect(readTourMeta(dir)).toEqual({ sha: 'abc', capturedAt: 't' })
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ pr: null, sha: 'abc' }))
    expect(readTourMeta(dir)).toEqual({ sha: 'abc', capturedAt: '' })
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ pr: 4, sha: 'abc' }))
    expect(readTourMeta(dir)).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ sha: 'abc' }))
    expect(readTourMeta(dir)).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), JSON.stringify({ pr: null }))
    expect(readTourMeta(dir)).toBeUndefined()
    writeFileSync(join(dir, 'gallery.json'), 'null')
    expect(readTourMeta(dir)).toBeUndefined()
  })

  test('buildSite publishes the tour under tour/ and links it first in the index', async () => {
    const site = join(root, 'site-tour')
    const { tour } = await buildSite(
      site,
      'o/r',
      tourSource({ pr: null, sha: 'deadbeef1', capturedAt: 'now' })
    )
    expect(tour).toEqual({ sha: 'deadbeef1', capturedAt: 'now' })
    expect(readFileSync(join(site, 'tour', 'index.html'), 'utf8')).toBe('tour')
    const index = readFileSync(join(site, 'index.html'), 'utf8')
    expect(index).toContain('<a href="./tour/"><strong>Preview tour</strong>')
    expect(index).toContain('deadbee · now')
  })

  test('buildSite drops a tour whose gallery.json names a PR, and says why', async () => {
    const site = join(root, 'site-tour-bad')
    const { tour } = await buildSite(site, 'o/r', tourSource({ pr: 7, sha: 'x' }))
    expect(tour).toBeUndefined()
    expect(existsSync(join(site, 'tour'))).toBe(false)
    expect(readFileSync(join(site, 'index.html'), 'utf8')).not.toContain('./tour/')
    expect(warn).toHaveBeenCalledWith('[gallery-pages] tour: gallery.json is not a tour; skipped')
  })

  test('isMainTour takes only an unexpired artifact from a main run of this repository', () => {
    const art = (expired: boolean, run?: Record<string, unknown>) => ({
      name: 'preview-tour',
      expired,
      archive_download_url: 'x',
      ...(run ? { workflow_run: run } : {}),
    })
    const main = { head_branch: 'main', repository_id: 1, head_repository_id: 1 }
    expect(isMainTour(art(false, main))).toBe(true)
    expect(isMainTour(art(true, main))).toBe(false)
    expect(isMainTour(art(false))).toBe(false)
    expect(isMainTour(art(false, { ...main, head_branch: 'feature' }))).toBe(false)
    expect(isMainTour(art(false, { ...main, head_repository_id: 2 }))).toBe(false)
    expect(isMainTour(art(false, { head_branch: 'main' }))).toBe(false)
  })
})

describe('the network edges, against a stubbed fetch', () => {
  type Reply = { status?: number; body?: string | Uint8Array; type?: string; json?: unknown }
  const stub = (routes: Record<string, Reply>) => {
    const calls: { url: string; headers: Record<string, string> }[] = []
    const spy = spyOn(globalThis, 'fetch').mockImplementation((async (
      input: string | URL | Request,
      init?: RequestInit
    ) => {
      const url = String(input)
      calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> })
      const r = routes[url] ?? { status: 404 }
      const body = r.json !== undefined ? JSON.stringify(r.json) : (r.body ?? null)
      return new Response(body, {
        status: r.status ?? 200,
        headers: r.type ? { 'content-type': r.type } : {},
      })
    }) as typeof fetch)
    return { calls, restore: () => spy.mockRestore() }
  }

  test('fetchOgImage writes an image and refuses anything else', async () => {
    const net = stub({
      'http://srd/og.png': { body: 'PNG', type: 'image/png' },
      'http://srd/page': { body: '<html>', type: 'text/html' },
    })
    try {
      const file = join(root, 'og.png')
      expect(await fetchOgImage('http://srd/og.png', file)).toBe(true)
      expect(readFileSync(file, 'utf8')).toBe('PNG')
      expect(await fetchOgImage('http://srd/page', join(root, 'page.png'))).toBe(false)
      expect(await fetchOgImage('http://srd/missing.png', join(root, 'missing.png'))).toBe(false)
      expect(existsSync(join(root, 'page.png'))).toBe(false)
    } finally {
      net.restore()
    }
  })

  const API = 'https://api.github.com/repos/o/r'
  const artifacts = (n: number) => `${API}/actions/artifacts?name=gallery-${n}&per_page=5`
  const tours = `${API}/actions/artifacts?name=preview-tour&per_page=20`
  const pr = (number: number): PullRequest => ({
    number,
    title: 't',
    head: { sha: 's', repo: { full_name: 'o/r' } },
    html_url: 'u',
  })

  test("githubSource lists main's open PRs with the token", async () => {
    const net = stub({ [`${API}/pulls?state=open&base=main&per_page=100`]: { json: [pr(1)] } })
    try {
      expect((await githubSource('o/r', 'tok').openPrs()).map((p) => p.number)).toEqual([1])
      expect(net.calls[0]?.headers.authorization).toBe('Bearer tok')
    } finally {
      net.restore()
    }
  })

  test('githubSource: an API error throws; no unexpired artifact, a failed download or a bad zip unpacks nothing; a good one unpacks', async () => {
    const net = stub({
      [artifacts(2)]: {
        json: { artifacts: [{ name: 'gallery-2', expired: true, archive_download_url: 'x' }] },
      },
      [artifacts(3)]: {
        json: {
          artifacts: [{ name: 'gallery-3', expired: false, archive_download_url: 'http://dl/3' }],
        },
      },
      'http://dl/3': { status: 410 },
      [artifacts(4)]: {
        json: {
          artifacts: [{ name: 'gallery-4', expired: false, archive_download_url: 'http://dl/4' }],
        },
      },
      'http://dl/4': { body: 'not a zip' },
      [artifacts(5)]: {
        json: {
          artifacts: [{ name: 'gallery-5', expired: false, archive_download_url: 'http://dl/5' }],
        },
      },
      'http://dl/5': { body: storedZip({ 'gallery.json': '{"pr":5}', 'index.html': 'five' }) },
    })
    try {
      const source = githubSource('o/r', 'tok')
      await expect(source.unpack(pr(1), join(root, 'u1'))).rejects.toThrow('→ 404')
      expect(await source.unpack(pr(2), join(root, 'u2'))).toBe(false)
      expect(await source.unpack(pr(3), join(root, 'u3'))).toBe(false)
      expect(warn).toHaveBeenCalledWith('[gallery-pages] #3: download → 410')
      const dir = join(root, 'u4')
      mkdirSync(dir, { recursive: true })
      expect(await source.unpack(pr(4), dir)).toBe(false)
      expect(warn).toHaveBeenCalledWith('[gallery-pages] #4: unzip failed')
      expect(existsSync(`${dir}.zip`)).toBe(false)
      const five = join(root, 'u5')
      mkdirSync(five, { recursive: true })
      expect(await source.unpack(pr(5), five)).toBe(true)
      expect(readFileSync(join(five, 'index.html'), 'utf8')).toBe('five')
      expect(readGalleryMeta(five, pr(5))).toMatchObject({ number: 5 })
      expect(existsSync(`${five}.zip`)).toBe(false)
    } finally {
      net.restore()
    }
  })

  test('main: refuses a run without a site dir, token or repository', async () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await main([], { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' })).toBe(2)
      expect(await main([join(root, 'm')], { GITHUB_REPOSITORY: 'o/r' })).toBe(2)
      expect(await main([join(root, 'm')], { GITHUB_TOKEN: 't' })).toBe(2)
      expect(error).toHaveBeenCalledTimes(3)
    } finally {
      error.mockRestore()
    }
  })

  test("githubSource.unpackTour skips a PR-branch or fork artifact and unpacks main's newest", async () => {
    const fromMain = { head_branch: 'main', repository_id: 1, head_repository_id: 1 }
    const net = stub({
      [tours]: {
        json: {
          artifacts: [
            {
              name: 'preview-tour',
              expired: false,
              archive_download_url: 'http://dl/pr',
              workflow_run: { ...fromMain, head_branch: 'sneaky' },
            },
            {
              name: 'preview-tour',
              expired: false,
              archive_download_url: 'http://dl/fork',
              workflow_run: { ...fromMain, head_repository_id: 9 },
            },
            {
              name: 'preview-tour',
              expired: false,
              archive_download_url: 'http://dl/tour',
              workflow_run: fromMain,
            },
          ],
        },
      },
      'http://dl/tour': {
        body: storedZip({ 'gallery.json': '{"pr":null,"sha":"abc"}', 'index.html': 'tour' }),
      },
    })
    try {
      const dir = join(root, 'tour-dl')
      mkdirSync(dir, { recursive: true })
      expect(await githubSource('o/r', 'tok').unpackTour(dir)).toBe(true)
      expect(readFileSync(join(dir, 'index.html'), 'utf8')).toBe('tour')
      expect(readTourMeta(dir)).toEqual({ sha: 'abc', capturedAt: '' })
      expect(net.calls.map((c) => c.url)).not.toContain('http://dl/pr')
      expect(net.calls.map((c) => c.url)).not.toContain('http://dl/fork')
    } finally {
      net.restore()
    }
  })

  test('githubSource.unpackTour with no tour from main unpacks nothing and says so', async () => {
    const net = stub({ [tours]: { json: { artifacts: [] } } })
    try {
      expect(await githubSource('o/r', 'tok').unpackTour(join(root, 'tour-none'))).toBe(false)
      expect(warn).toHaveBeenCalledWith('[gallery-pages] tour: no unexpired preview-tour from main')
    } finally {
      net.restore()
    }
  })

  test('main: builds the site from GitHub and reports the count', async () => {
    const net = stub({
      [`${API}/pulls?state=open&base=main&per_page=100`]: { json: [] },
      [tours]: { json: { artifacts: [] } },
    })
    const log = spyOn(console, 'log').mockImplementation(() => {})
    try {
      const site = join(root, 'main-site')
      expect(await main([site], { GITHUB_TOKEN: 't', GITHUB_REPOSITORY: 'o/r' })).toBe(0)
      expect(existsSync(join(site, 'index.html'))).toBe(true)
      expect(log).toHaveBeenCalledWith('[gallery-pages] 0 of 0 open PRs published')
      expect(log).toHaveBeenCalledWith('[gallery-pages] preview tour: none')
    } finally {
      log.mockRestore()
      net.restore()
    }
  })
})
