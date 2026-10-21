// The whole-site review pass behind the "SalvageUnion.io 4.0 review" deck
// (tools/review-deck/README.md). Run by `review.config.ts` only, never by the
// suite. Every screen type at 1440 and 390, viewport shots at several scroll
// depths, each view checked against the canon's gates (rule violations) and
// for blind spots (possible issues), marked on the shot.
import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Page } from '@playwright/test'
import { nameToSlug } from 'salvageunion-reference'
import { at } from '../_base'
import { seedDesignAccount, walkDesignRoutes } from '../_designRoutes'
import type { DesignRoute } from '../_designTable'
import { designRoutes } from '../_designTable'
import { test as signedIn } from '../fixtures'

const OUT = process.env.REVIEW_OUT ?? '/tmp/site-review'
const ONLY = process.env.REVIEW_ONLY
const MAX_SHOTS = { page: 6, phone: 8 } as const

// Chromium in the sandbox cannot watch the network (netlink), so it believes it is offline.
const test = signedIn.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      Object.defineProperty(Navigator.prototype, 'onLine', { get: () => true, configurable: true })
    })
    // Art comes through Node's fetch, which takes the sandbox's egress proxy.
    await context.route('https://assets.salvageunion.io/**', async (route) => {
      try {
        const r = await fetch(route.request().url())
        await route.fulfill({
          status: r.status,
          headers: {
            'content-type': r.headers.get('content-type') ?? 'application/octet-stream',
            'access-control-allow-origin': '*',
            'cache-control': 'max-age=3600',
          },
          body: Buffer.from(await r.arrayBuffer()),
        })
      } catch (e) {
        appendFileSync(join(OUT, 'errors.txt'), `route ${route.request().url()}: ${e}\n`)
        await route.abort()
      }
    })
    await use(context)
  },
})

const BOTH = ['page', 'phone'] as const
const ref = (path: string, family: DesignRoute['family'] = 'reference-page'): DesignRoute => ({
  family,
  path,
  widths: BOTH,
})

const OUTLIERS = [
  '/chassis/mazona/',
  '/chassis/big-brother/',
  '/chassis/mule/',
  '/chassis/cranium-bio-mech/',
  '/systems/salvaging-drill/',
  '/systems/50-cal-machine-gun/',
  '/systems/aerosolised-nerve-gas-sprayer/',
  '/modules/survey-scanner/',
  '/classes/hacker/',
  '/classes/fabricator/',
  '/bio-titans/tyrant/',
  '/npcs/saboteur/',
  '/drones/pest-drone/',
  '/vehicles/fighting-box-wheel/',
  '/crawler-bays/armoury/',
  '/creatures/irradiated-scorpion/',
  '/abilities/mass-field-maintenance/',
  '/roll-tables/core-mechanic/',
  '/roll-tables/mechapult/',
  '/roll-tables/callsign-table/',
  '/guides/heat/',
]

/** Schemas whose rows render inside their owners' pages, never on their own. */
const META = new Set(['actions', 'ability-tree-requirements', 'catalog-categories'])

/**
 * The SRD's screens: every index, every guide, and three show pages of each
 * other kind (its shortest, middle and longest entry by data size), the
 * patterns, and the pages with no data behind them.
 */
function siteRoutes(): DesignRoute[] {
  const dir = join(import.meta.dirname, '../../../../packages/salvageunion-reference/data')
  const routes: DesignRoute[] = [
    ref('/', 'reference-index'),
    ref('/about/'),
    ref('/changelog/'),
    ref('/api/'),
    ref('/discord/'),
    ref('/no-such-page/'),
    { family: 'listing', path: '/drill/', widths: BOTH },
  ]
  for (const file of readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()) {
    const schema = file.replace(/\.json$/, '')
    if (META.has(schema)) continue
    const rows = JSON.parse(readFileSync(join(dir, file), 'utf8')) as { name?: string }[]
    const named = rows.filter((r) => typeof r.name === 'string')
    if (named.length === 0) continue
    routes.push(ref(`/${schema}/`, 'reference-index'))
    const bySize = [...named].sort((a, b) => JSON.stringify(a).length - JSON.stringify(b).length)
    const picks =
      schema === 'guides'
        ? named
        : [...new Set([0, Math.floor(bySize.length / 2), bySize.length - 1])].map((i) => bySize[i]!)
    for (const row of picks) routes.push(ref(`/${schema}/${nameToSlug(row.name as string)}/`))
  }
  routes.push(
    ref('/chassis/mazona/pattern/buzzard/'),
    ref('/chassis/mule/pattern/crusher/'),
    ref('/bio-titans/typhon/pattern/hill-worm/')
  )
  // Known outliers: the pages the layout gates hold (`chip-strips.e2e.ts`)
  // and those earlier reviews turned up (long names, many chips, art-less).
  for (const path of OUTLIERS) if (!routes.some((r) => r.path === path)) routes.push(ref(path))
  return routes
}

/** The app's screens: every design route, a Peek, the Starter Set's sheets. */
function appRoutes(): DesignRoute[] {
  return [
    ...designRoutes.filter(
      (r) =>
        r.family !== 'reference-page' && r.family !== 'reference-index' && r.family !== 'listing'
    ),
    { family: 'starter-set', path: at('/starter/pilot/starter-pilot-bonesaw'), widths: BOTH },
    { family: 'starter-set', path: at('/starter/mech/starter-mech-mazona'), widths: BOTH },
    { family: 'starter-set', path: at('/starter/crawler/starter-crawler-tenacity'), widths: BOTH },
  ]
}

type Mark = { kind: 'rule' | 'issue'; rule: string; what: string }
type ShotInfo = { tags: string[]; marks: Mark[] }

/**
 * In the page: the blind spots in view (overlapping controls, clipped text, a
 * word broken over lines, broken art), and the chip law's geometry (R37), each
 * outlined on the shot: magenta for a rule, blue for a possible issue.
 */
function measure(): ShotInfo {
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    if (r.width < 3 || r.height < 3) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05
  }
  const inView = (r: DOMRect) =>
    r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
  const text = (el: Element | null) =>
    (el?.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 48)
  for (const el of document.querySelectorAll('[data-review-mark]')) {
    ;(el as HTMLElement).style.outline = ''
    el.removeAttribute('data-review-mark')
  }
  const marks: Mark[] = []
  const mark = (el: Element, m: Mark) => {
    if (!marks.some((x) => x.rule === m.rule && x.what === m.what)) marks.push(m)
    const e = el as HTMLElement
    e.setAttribute('data-review-mark', m.kind)
    e.style.outline = `3px dashed ${m.kind === 'rule' ? '#e0218a' : '#1f6feb'}`
    e.style.outlineOffset = '2px'
  }

  // R37: a strip's chips on more than one line, or off its name's line.
  const STRIP = '.su-entity-stamps,[data-chip-group],.su-entity-tile__chips,.su-entity-token__chips'
  const CHIP =
    '.su-stat-cell,.su-stat-column__cell,.su-badge-stamp,.su-chip-link,.su-cost-edge,.su-cost,.su-chip-more,[data-chip-class] > *'
  const NAME =
    '[data-fill-name],h1,.su-entity-token__name,.su-entity-row__name,.su-entity-tile__name,[class*="__name"],h2,h3,h4'
  const HOST =
    '[data-chip-fill],.su-entity-row__head,.su-entity-token,.su-entity-tile,.su-ec-frame,.su-entity-row__frame,header'
  const strips = [...document.querySelectorAll(STRIP)]
  for (const strip of strips.filter((s) => !strips.some((o) => o !== s && o.contains(s)))) {
    const chips = [...strip.querySelectorAll(CHIP)]
      .filter(visible)
      .filter((c) => !c.parentElement?.closest(CHIP) || c.parentElement === strip)
    const rects = chips.map((c) => c.getBoundingClientRect())
    if (!rects.some(inView)) continue
    const host = strip.closest(HOST) ?? strip.parentElement ?? strip
    const name = NAME.split(',')
      .flatMap((sel) => [...host.querySelectorAll(sel)])
      .find((n) => visible(n) && !strip.contains(n) && !chips.some((c) => c.contains(n)))
    const what = text(name ?? null) || text(chips[0] ?? null)
    const mids = rects.map((r) => (r.top + r.bottom) / 2).sort((a, b) => a - b)
    const lineH = Math.min(...rects.map((r) => r.height))
    let lines = 1
    for (let i = 1; i < mids.length; i++) if (mids[i]! - mids[i - 1]! > lineH * 0.6) lines++
    if (lines > 1)
      mark(host, { kind: 'rule', rule: 'R37 chips', what: `${what}: chips on ${lines} lines` })
    else if (name) {
      const n = name.getBoundingClientRect()
      const off = rects.filter(
        (r) => (r.top + r.bottom) / 2 < n.top - 4 || (r.top + r.bottom) / 2 > n.bottom + 4
      )
      if (off.length > 0)
        mark(host, {
          kind: 'rule',
          rule: 'R37 chips',
          what: `${what}: ${off.length} chip(s) off the name's line`,
        })
    }
  }
  for (const el of document.querySelectorAll('[data-fill-out]')) {
    if (!visible(el) || !inView(el.getBoundingClientRect())) continue
    mark(el.closest(HOST) ?? el, {
      kind: 'rule',
      rule: 'R37 chips',
      what: `"${text(el)}" drawn in the head and its first row`,
    })
  }

  // Possible issues. Overlap: two controls or labels that cover each other.
  const ITEMS =
    'a,button,input,select,textarea,.su-stat-cell,.su-badge-stamp,.su-chip-link,h1,h2,h3,h4,[data-fill-name]'
  const items = [...document.querySelectorAll(ITEMS)].filter(
    (e) => visible(e) && inView(e.getBoundingClientRect())
  )
  const boxes = items.map((e) => e.getBoundingClientRect())
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i]!
      const b = items[j]!
      if (a.contains(b) || b.contains(a)) continue
      const ra = boxes[i]!
      const rb = boxes[j]!
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left)
      const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top)
      if (w <= 2 || h <= 2) continue
      const small = Math.min(ra.width * ra.height, rb.width * rb.height)
      if ((w * h) / small < 0.25) continue
      // A sticky bar scrolling over content is not an overlap.
      const fixed = (e: Element) => {
        for (let p: Element | null = e; p; p = p.parentElement) {
          const pos = getComputedStyle(p).position
          if (pos === 'fixed' || pos === 'sticky') return true
        }
        return false
      }
      if (fixed(a) !== fixed(b)) continue
      mark(b, { kind: 'issue', rule: 'Overlap', what: `"${text(a)}" and "${text(b)}" overlap` })
    }
  }
  // Clipped text: a box that cuts its own words off without an ellipsis.
  for (const el of document.querySelectorAll('body *')) {
    if (el.childElementCount > 3 || !visible(el)) continue
    const s = getComputedStyle(el)
    if (!/(hidden|clip)/.test(s.overflowX + s.overflowY)) continue
    if (
      s.textOverflow === 'ellipsis' ||
      (s as unknown as { webkitLineClamp: string }).webkitLineClamp !== 'none'
    )
      continue
    const e = el as HTMLElement
    if (!text(e) || !inView(e.getBoundingClientRect())) continue
    if (e.scrollWidth > e.clientWidth + 2 || e.scrollHeight > e.clientHeight + 2)
      mark(e, { kind: 'issue', rule: 'Clipped text', what: `"${text(e)}" is cut off` })
  }
  // A word broken over two lines in a title or name.
  const range = document.createRange()
  for (const el of document.querySelectorAll('h1,h2,h3,[data-fill-name],[class*="__name"]')) {
    if (!visible(el) || !inView(el.getBoundingClientRect())) continue
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const m of (node.textContent ?? '').matchAll(/\S{2,}/g)) {
        range.setStart(node, m.index)
        range.setEnd(node, m.index + m[0].length)
        const lines = new Set([...range.getClientRects()].map((r) => Math.round(r.top)))
        if (lines.size > 1)
          mark(el, { kind: 'issue', rule: 'Word broken', what: `"${m[0]}" breaks across lines` })
      }
    }
  }
  // Art that did not load.
  for (const img of document.images) {
    if (!inView(img.getBoundingClientRect()) || !img.complete || img.naturalWidth > 0) continue
    mark(img, {
      kind: 'issue',
      rule: 'Broken image',
      what: img.alt || img.currentSrc || 'an image',
    })
  }

  const count = (sel: string) =>
    [...document.querySelectorAll(sel)].filter(
      (e) => visible(e) && inView(e.getBoundingClientRect())
    ).length
  const tags: string[] = []
  const tag = (n: number, label: string) => n > 0 && tags.push(`${n} ${label}`)
  tag(count('.su-chip-more'), '+MORE')
  tag(count('[data-chip-overflow]'), 'overflow row')
  tag(count('.su-entity-token'), 'Token')
  tag(count('.su-entity-row'), 'Row')
  tag(count('.su-entity-tile'), 'Tile')
  tag(count('.su-ec-frame'), 'card')
  tag(count('[data-peek-popup]'), 'Peek')
  return { tags, marks }
}

/** The canon's gates on the whole view: one line per finding, by rule. */
async function viewRules(page: Page, where: string): Promise<{ rule: string; line: string }[]> {
  const out: { rule: string; line: string }[] = []
  const take = async (rule: string | ((line: string) => string), run: () => Promise<string[]>) => {
    try {
      for (const line of await run())
        out.push({ rule: typeof rule === 'string' ? rule : rule(line), line })
    } catch (e) {
      appendFileSync(join(OUT, 'errors.txt'), `${where}: detector failed: ${e}\n`)
    }
  }
  // The gates are loaded by name: one the branch has dropped or renamed is
  // skipped (and noted), so the shoot runs on any commit.
  // biome-ignore lint/suspicious/noExplicitAny: a gate module's shape is checked by name.
  const gate = async (name: string): Promise<Record<string, any> | null> => {
    try {
      return await import(`../${name}`)
    } catch {
      appendFileSync(join(OUT, 'errors.txt'), `gate ${name} not on this commit\n`)
      return null
    }
  }
  const [strips, frames, nesting, siblings, rhythm, cutouts] = await Promise.all(
    [
      '_chipStrips',
      '_entityFrames',
      '_nestingDepth',
      '_siblingHeights',
      '_pageRhythm',
      '_tokenCutout',
    ].map(gate)
  )
  const call = (m: Record<string, unknown> | null | undefined, ...names: string[]) => {
    const fn = names.map((n) => m?.[n]).find((f) => typeof f === 'function') as
      | ((page: Page) => Promise<unknown[]>)
      | undefined
    return fn ? () => fn(page) : async () => []
  }
  // R37's overflow and +MORE kinds are the canon now, not faults (C2b, C5).
  await take(
    (l) => `R37 chips · ${l.split(':')[0]}`,
    async () =>
      ((await call(strips, 'findChipStripFaults')()) as string[]).filter(
        (l) => !/^(more-contentful|overflow|align):/.test(l)
      )
  )
  await take('R38 frames', async () => (await call(frames, 'findFrameFaults')()) as string[])
  await take(
    (l) => `R39 nesting · ${l.split(' ')[0]}`,
    async () =>
      (
        (await call(nesting, 'findNestingFindings')()) as {
          rule: string
          chain: string
          detail: string
        }[]
      ).map((f) => `${f.rule} ${f.chain}: ${f.detail}`)
  )
  await take('§4.7 sibling heights', async () =>
    (
      (await call(siblings, 'findSiblingMismatches')()) as {
        line: string
        controls: { what: string; height: number }[]
      }[]
    ).map((m) => `${m.line}: ${m.controls.map((c) => `${c.what} ${c.height}px`).join(', ')}`)
  )
  await take('§4.7 tab size', async () => (await call(siblings, 'findTabSizeFaults')()) as string[])
  await take(
    (l) => `Page rhythm · ${l.split(':')[0]}`,
    async () =>
      ((await call(rhythm, 'findRhythmFindings')()) as { rule: string; detail: string }[]).map(
        (f) => `${f.rule}: ${f.detail}`
      )
  )
  await take(
    'Square cut-outs',
    async () => (await call(cutouts, 'findMiniCutoutFaults', 'findTokenCutoutFaults')()) as string[]
  )
  const hscroll = await page.evaluate(() => {
    const doc = document.scrollingElement ?? document.documentElement
    return doc.scrollWidth > innerWidth + 1 ? doc.scrollWidth - innerWidth : 0
  })
  if (hscroll > 0)
    out.push({ rule: 'Horizontal scroll', line: `the page scrolls ${hscroll}px sideways` })
  return out
}

/** The issue rules (blind spots), as against the canon's. */
const ISSUE_RULES = new Set(['Horizontal scroll'])

async function shootView(page: Page, base: string, phone: boolean, where: string, family: string) {
  const vh = page.viewportSize()?.height ?? 900
  const measureTotal = () =>
    page.evaluate(() => {
      for (const el of document.querySelectorAll('[data-review-scroller]'))
        el.removeAttribute('data-review-scroller')
      const doc = document.scrollingElement ?? document.documentElement
      if (doc.scrollHeight > innerHeight + 40) return doc.scrollHeight
      let best: Element | null = null
      for (const el of document.querySelectorAll('*')) {
        const st = getComputedStyle(el)
        if (!/(auto|scroll)/.test(st.overflowY)) continue
        if (el.scrollHeight <= el.clientHeight + 40 || el.clientHeight < innerHeight * 0.4) continue
        if (!best || el.scrollHeight > best.scrollHeight) best = el
      }
      if (!best) return doc.scrollHeight
      best.setAttribute('data-review-scroller', '')
      return best.scrollHeight - best.clientHeight + innerHeight
    })
  await page.waitForTimeout(800)
  const rules = await viewRules(page, where)
  let total = await measureTotal()
  const max = phone ? MAX_SHOTS.phone : MAX_SHOTS.page
  const step = () => Math.max(Math.round(vh * 0.85), Math.ceil((total - vh) / (max - 1)))
  let k = 0
  for (let y = 0, last = false; !last; y = Math.min(y + step(), Math.max(0, total - vh))) {
    await page.evaluate((y) => {
      const sc = document.querySelector('[data-review-scroller]')
      if (sc) sc.scrollTop = y
      else window.scrollTo(0, y)
    }, y)
    await page.waitForTimeout(250)
    await page.evaluate(async () => {
      const pending = () =>
        [...document.images].some((i) => {
          const r = i.getBoundingClientRect()
          return r.bottom > 0 && r.top < innerHeight && r.width > 0 && !i.complete
        })
      for (let t = 0; t < 40 && pending(); t++) await new Promise((r) => setTimeout(r, 125))
    })
    total = Math.max(total, await measureTotal())
    last = y >= total - vh - 2 || k + 1 >= max
    const info = await page.evaluate(measure)
    const file = `${base}-${String(k).padStart(2, '0')}.jpg`
    await page.screenshot({ path: join(OUT, file), type: 'jpeg', quality: 70 })
    const entry = {
      file,
      key: file.replace(/^\d+-/, ''),
      where,
      family,
      width: page.viewportSize()?.width,
      depth: `${Math.round((y / Math.max(1, total)) * 100)}%`,
      scroll: y,
      pageHeight: total,
      url: new URL(page.url()).pathname,
      tags: info.tags,
      rules: [
        ...rules.filter((r) => !ISSUE_RULES.has(r.rule)),
        ...info.marks.filter((m) => m.kind === 'rule').map((m) => ({ rule: m.rule, line: m.what })),
      ],
      issues: [
        ...rules.filter((r) => ISSUE_RULES.has(r.rule)),
        ...info.marks
          .filter((m) => m.kind === 'issue')
          .map((m) => ({ rule: m.rule, line: m.what })),
      ],
    }
    appendFileSync(join(OUT, 'manifest.jsonl'), `${JSON.stringify(entry)}\n`)
    k++
  }
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[data-review-mark]')) {
      ;(el as HTMLElement).style.outline = ''
      el.removeAttribute('data-review-mark')
    }
    const sc = document.querySelector('[data-review-scroller]')
    if (sc) sc.scrollTop = 0
    window.scrollTo(0, 0)
  })
}

test('site review shots', async ({ page }) => {
  test.setTimeout(240 * 60_000)
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, 'manifest.jsonl'), '')
  page.on('console', (m) => {
    if (m.type() === 'error')
      appendFileSync(join(OUT, 'console.txt'), `${m.text().slice(0, 300)}\n`)
  })
  const all = [...siteRoutes(), ...appRoutes()]
  const routes = ONLY ? all.filter((r) => ONLY.split(',').some((o) => r.path.includes(o))) : all
  writeFileSync(
    join(OUT, 'routes.json'),
    JSON.stringify(
      routes.map((r) => r.path),
      null,
      2
    )
  )
  const seed = await seedDesignAccount(page)
  let i = 0
  await walkDesignRoutes(
    page,
    seed,
    async ({ where, width, family }) => {
      i++
      const slug = `${String(i).padStart(3, '0')}-${where
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase()
        .slice(0, 80)}`
      await shootView(page, slug, `${width}`.includes('phone'), where, family).catch((e) =>
        appendFileSync(join(OUT, 'errors.txt'), `${where}: ${e}\n`)
      )
      return []
    },
    routes
  )
})
