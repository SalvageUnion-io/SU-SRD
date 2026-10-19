import type { Page } from '@playwright/test'
import { NESTING_SELECTORS } from './_nestingDepth'

/**
 * A Page's rhythm (hard rule R17; ruleset §1.7, §4.6, §7.1) as the rendered
 * page draws it. `findRhythmFindings` reads every Page body on the page (an
 * SRD show page's, the app's detail dialog's) and returns each place it breaks:
 *
 * - **start** the body's first block more than `start` px under the band: the
 *   body starts under the band at any length, so a short page is never
 *   centred in the window.
 * - **gap** a block whose nearest block above it (the one with the lowest foot
 *   above its top, across its width) is not `gap` px away: level-1 blocks sit
 *   one 12px gap apart, a Slab and the block it heads included.
 * - **stat-frame** a stat column value cell whose frame is not 1px (§7.1).
 * - **stat-label** a stat column label not set at 14px (§1.3, §4.6).
 *
 * A block is what the Page stacks at level 1: a headed frame no other frame
 * holds (a Card, a Row, a Box: a pattern row, a class's path), a Token list or
 * lone Token no frame holds, a Slab no frame holds, and the page's own parts:
 * the art, the stat column, a pattern's opening, the table, a Legendary
 * track's "or", a Hybrid Class's trees line, a guide step's table and a
 * phone's "On this page" list, and the prose's text, its
 * run of paragraphs one block. A block inside another block is the outer one's.
 */
export type RhythmFinding = {
  rule: 'start' | 'gap' | 'stat-frame' | 'stat-label'
  /** What breaks it, `The Armoury (TitledBox) 20px under the prose`. */
  detail: string
}

export type RhythmSelectors = {
  /** A Page's body, under its band. */
  body: string
  /** The band a body starts under. */
  band: string
  head: string
  frame: string
  title: string
  token: string
  tokenList: string
  slab: string
  /** The page parts that are blocks in their own right. */
  parts: string
  /** The prose column (a Page's, a guide step's body): its text children run as one block. */
  prose: string
  statValue: string
  statLabel: string
  /** The most the first block may sit under the band. */
  start: number
  /** The gap between blocks. */
  gap: number
  /** How far off a measure may be, for sub-pixel layout. */
  tolerance: number
}

export const RHYTHM_SELECTORS: RhythmSelectors = {
  body: '.su-entity__body, .su-entity-dialog__body',
  band: '.su-chapter-band',
  head: NESTING_SELECTORS.head,
  frame: NESTING_SELECTORS.frame,
  title: NESTING_SELECTORS.title,
  token: '.su-entity-token',
  tokenList: '.su-entity-token-list',
  slab: '[data-slab]',
  parts:
    '.su-entity-page__art, .su-entity-page__stats, .su-entity-page__opening, .su-entity-page__table, .su-ability-track__or, .su-class-brief__trees, .su-guide__table, .su-guide__toc-block .su-guide__toc',
  prose: '.su-entity-page__prose, .su-guide__body, .su-guide__ladder-prose',
  statValue: '.su-entity-page__stats .su-stat-column__stat',
  statLabel: '.su-entity-page__stats .su-stat-column__stat > .su-stat-plate--label',
  start: 24,
  gap: 12,
  tolerance: 1,
}

/**
 * Runs in the page and returns plain data, so it closes over nothing: every
 * helper is declared inside it, and the selectors come in as its argument.
 */
export function scanRhythm(a: RhythmSelectors): RhythmFinding[] {
  type Block = {
    el: Element | null
    rect: { top: number; bottom: number; left: number; right: number }
    name: string
  }
  const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
  const visible = (el: Element) => {
    if (el.closest('[aria-hidden="true"], [inert]')) return false
    const r = el.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) return false
    const s = getComputedStyle(el)
    return s.visibility !== 'hidden' && s.display !== 'none'
  }
  const round = (n: number) => Math.round(n * 10) / 10
  const found: RhythmFinding[] = []

  for (const body of document.querySelectorAll(a.body)) {
    if (!visible(body)) continue
    const band = body.parentElement?.querySelector(`:scope > ${a.band}`)
    const frames = new Set<Element>()
    for (const head of body.querySelectorAll(a.head)) {
      if (!visible(head)) continue
      const frame = head.closest(a.frame) ?? head
      if (body.contains(frame)) frames.add(frame)
    }
    const inFrame = (el: Element) => [...frames].some((f) => f !== el && f.contains(el))
    const nameOf = (el: Element) => {
      if (el.matches(a.slab)) return `the ${text(el).slice(0, 30)} Slab`
      if (el.matches(a.tokenList))
        return `the Token list (${text(el.querySelector(a.token)).slice(0, 30)}…)`
      if (el.matches(a.token)) return `the ${text(el).slice(0, 30)} Token`
      if (frames.has(el)) {
        const head = el.querySelector(a.head)
        return `the ${text(head?.querySelector(a.title) ?? head).slice(0, 30)} frame`
      }
      const part = [...el.classList].find((c) => c.startsWith('su-entity-page__'))
      return part ? `the ${part.replace('su-entity-page__', '')}` : el.tagName.toLowerCase()
    }

    const candidates: Element[] = [
      ...[...frames].filter((f) => !inFrame(f)),
      ...[...body.querySelectorAll(a.tokenList)].filter((l) => !inFrame(l)),
      ...[...body.querySelectorAll(a.token)].filter(
        (t) => !inFrame(t) && !t.closest(a.tokenList) && !t.parentElement?.closest(a.token)
      ),
      ...[...body.querySelectorAll(a.slab)].filter((s) => !inFrame(s)),
      ...body.querySelectorAll(a.parts),
    ].filter(visible)
    // The prose's text: each run of children that hold no other block is one block.
    const blocks: Block[] = []
    for (const prose of body.querySelectorAll(a.prose)) {
      if (!visible(prose) || inFrame(prose)) continue
      let run: Element[] = []
      const flush = () => {
        if (run.length === 0) return
        const rects = run.map((el) => el.getBoundingClientRect())
        blocks.push({
          el: null,
          rect: {
            top: Math.min(...rects.map((r) => r.top)),
            bottom: Math.max(...rects.map((r) => r.bottom)),
            left: Math.min(...rects.map((r) => r.left)),
            right: Math.max(...rects.map((r) => r.right)),
          },
          name: 'the prose',
        })
        run = []
      }
      for (const child of prose.children) {
        if (!visible(child)) continue
        const block = candidates.some((c) => c === child || child.contains(c) || c.contains(child))
        if (block) flush()
        else run.push(child)
      }
      flush()
    }
    // A block inside another is the outer one's.
    const outer = candidates.filter((c) => !candidates.some((o) => o !== c && o.contains(c)))
    for (const el of new Set(outer)) {
      const r = el.getBoundingClientRect()
      blocks.push({
        el,
        rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
        name: nameOf(el),
      })
    }
    // A prose run inside a block (a pattern row's prose) is that block's.
    const kept = blocks.filter(
      (b) =>
        b.el ||
        !outer.some((o) => {
          const r = o.getBoundingClientRect()
          return (
            r.top <= b.rect.top &&
            r.bottom >= b.rect.bottom &&
            r.left <= b.rect.left &&
            r.right >= b.rect.right
          )
        })
    )
    kept.sort((x, y) => x.rect.top - y.rect.top || x.rect.left - y.rect.left)

    const bandFoot = band?.getBoundingClientRect().bottom ?? body.getBoundingClientRect().top
    const first = kept[0]
    if (first && first.rect.top - bandFoot > a.start + a.tolerance)
      found.push({
        rule: 'start',
        detail: `${first.name} starts ${round(first.rect.top - bandFoot)}px under the band`,
      })
    for (const b of kept) {
      const above = kept.filter(
        (o) =>
          o !== b &&
          o.rect.bottom <= b.rect.top + a.tolerance &&
          Math.min(o.rect.right, b.rect.right) - Math.max(o.rect.left, b.rect.left) > 1
      )
      if (above.length === 0) continue
      const nearest = above.reduce((x, y) => (y.rect.bottom > x.rect.bottom ? y : x))
      const gap = b.rect.top - nearest.rect.bottom
      if (Math.abs(gap - a.gap) > a.tolerance)
        found.push({ rule: 'gap', detail: `${b.name} ${round(gap)}px under ${nearest.name}` })
    }

    for (const v of body.querySelectorAll(a.statValue)) {
      if (!visible(v)) continue
      const w = getComputedStyle(v).borderTopWidth
      if (w !== '1px') found.push({ rule: 'stat-frame', detail: `a stat value framed at ${w}` })
    }
    for (const l of body.querySelectorAll(a.statLabel)) {
      if (!visible(l)) continue
      const size = getComputedStyle(l).fontSize
      if (size !== '14px')
        found.push({ rule: 'stat-label', detail: `the ${text(l)} label at ${size}` })
    }
  }
  return found
}

export function findRhythmFindings(page: Page): Promise<RhythmFinding[]> {
  return page.evaluate(scanRhythm, RHYTHM_SELECTORS)
}

/** One line per distinct finding, with how many times the page draws it. */
export function describeRhythm(where: string, findings: RhythmFinding[]): string[] {
  const counts = new Map<string, number>()
  for (const f of findings) {
    const line = `${where}: ${f.rule} ${f.detail}`
    counts.set(line, (counts.get(line) ?? 0) + 1)
  }
  return [...counts].map(([line, n]) => (n > 1 ? `${line} (×${n})` : line))
}
