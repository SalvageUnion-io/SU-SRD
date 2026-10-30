import type { Page } from '@playwright/test'
import type { DesignContext } from './_designTable'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * Hierarchy at render (hard rule R55): what the eye ranks, read off the page.
 * Each fault is `<rule>: <detail>`, its rule one of
 *
 * - `type-ladder` (§4.8): a drawn font size that is no `--text-*` rung;
 * - `title-size` (E24): an entity title, index name, Mini name or band title
 *   off its form's rung; `slab-size` (§4.9): a Slab stamp off body (14px), a
 *   Mini Slab's off caption (13px);
 * - `heading-skip` (E25): a heading more than one level under the one before
 *   it; `heading-depth`: a heading at or above the level of the section that
 *   holds it;
 * - `stray-head` (R53): a heading that is no band title, Slab, entity title
 *   or screen-reader label; `nested-slab`: a Slab section in a Slab section,
 *   not Mini;
 * - `make-rust` (§3.13): a "+ New…" control not rust; `stamp-twin`: a button
 *   painted like a read stamp beside it on its line;
 * - `tool-title-clip` (C12): a TitledBox's title clipped to "…";
 * - `measure` (§1.10): a Reference or Manage band title off the page measure's
 *   left edge; `first-screen`: a phone page whose first content starts below
 *   its first screen.
 */

type Context = { context: DesignContext; phone: boolean }

/** The ladder (`--text-*`, ruleset §4.8), in px. */
const LADDER = [11, 12, 13, 14, 16, 17, 22, 31, 38, 64]

/** Runs in the page; returns plain data. */
function scan({ ladder, context, phone }: Context & { ladder: number[] }): string[] {
  const out: string[] = []
  const px = (el: Element) => Number.parseFloat(getComputedStyle(el).fontSize)
  const near = (a: number, b: number) => Math.abs(a - b) < 0.3
  const drawn = (el: Element) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width >= 2 && r.height >= 2 && s.visibility !== 'hidden' && Number(s.opacity) > 0
  }
  const name = (el: Element) => {
    const cls = [...el.classList].filter((c) => c.startsWith('su-'))[0]
    const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 28)
    return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} "${text}"`
  }
  // A link preview card draws at its own sizes (K12).
  const inPreview = (el: Element) => el.closest('[data-og-card]') !== null

  // type-ladder: every element that owns drawn text.
  const seen = new Set<Element>()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || seen.has(el) || !n.textContent?.trim()) continue
    seen.add(el)
    if (!drawn(el) || inPreview(el)) continue
    const size = px(el)
    if (!ladder.some((r) => near(r, size))) out.push(`type-ladder: ${size}px ${name(el)}`)
  }

  // title-size: each form's title on its rung (E24).
  const titles: [string, number[]][] = [
    ['.su-chapter-band__title', phone ? [38] : [64]],
    ['.su-entity-compact__title', [22, 31]],
    ['.su-entity-index__name', [22]],
    ['.su-entity-mini__name', [13]],
  ]
  for (const [sel, rungs] of titles) {
    for (const el of document.querySelectorAll(sel)) {
      if (!drawn(el)) continue
      const size = px(el)
      if (!rungs.some((r) => near(r, size)))
        out.push(`title-size: ${size}px, not ${rungs.join(' or ')}px, ${name(el)}`)
    }
  }

  // slab-size and nested-slab.
  for (const slab of document.querySelectorAll('[data-slab]')) {
    const stamp = slab.querySelector('.su-poster-stamp')
    if (!stamp || !drawn(stamp)) continue
    const section = slab.closest('.su-slab-section')
    const mini = section?.classList.contains('su-slab-section--mini') ?? false
    const want = mini ? 13 : 14
    if (!near(px(stamp), want)) out.push(`slab-size: ${px(stamp)}px, not ${want}px, ${name(stamp)}`)
    const outer = section?.parentElement?.closest('.su-slab-section')
    if (section && outer && !mini) out.push(`nested-slab: ${name(stamp)} in a Slab section`)
  }

  // Headings.
  const srOnly = (el: Element) => el.getBoundingClientRect().width <= 1
  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(
    (h) => getComputedStyle(h).display !== 'none' && !h.closest('[hidden],[aria-hidden="true"]')
  )
  const level = (h: Element) => Number(h.tagName[1])
  let prev = 0
  for (const h of headings) {
    if (prev && level(h) > prev + 1) out.push(`heading-skip: h${prev} then h${level(h)} ${name(h)}`)
    prev = level(h)
    // The section that holds it: the nearest Slab section, not its own.
    let section = h.closest('.su-slab-section')
    while (section?.querySelector(':scope > [data-slab]')?.contains(h))
      section = section.parentElement?.closest('.su-slab-section') ?? null
    const head = section?.querySelector(
      ':scope > [data-slab] h1, :scope > [data-slab] h2, :scope > [data-slab] h3, :scope > [data-slab] h4'
    )
    if (head && level(h) <= level(head))
      out.push(`heading-depth: h${level(h)} in an h${level(head)} section ${name(h)}`)
    const known =
      h.tagName === 'H1' ||
      srOnly(h) ||
      h.closest('[data-slab]') ||
      h.matches(
        '.su-chapter-band__title, .su-entity-compact__title, .su-entity-index__name, .su-entity-mini__name, .su-play-bar__notch'
      )
    if (!known && drawn(h)) out.push(`stray-head: ${name(h)}`)
  }

  // make-rust and stamp-twin.
  const probe = document.createElement('span')
  probe.style.color = 'var(--color-rust)'
  document.body.append(probe)
  const rust = getComputedStyle(probe).color
  probe.remove()
  const controls = [...document.querySelectorAll('button, a.su-btn, a[class*="su-button"]')].filter(
    drawn
  )
  for (const c of controls) {
    const text = (c.textContent ?? '').trim()
    if (/^\+\s*New\b/i.test(text) && getComputedStyle(c).backgroundColor !== rust)
      out.push(`make-rust: ${name(c)}`)
  }
  const fill = (el: Element) => getComputedStyle(el).backgroundColor
  const dark = (rgb: string) => {
    const [r = 255, g = 255, b = 255, a = 1] = (rgb.match(/[\d.]+/g) ?? []).map(Number)
    return a > 0.5 && 0.2126 * r + 0.7152 * g + 0.0722 * b < 96
  }
  // Ink stamps, a chip strip's own controls aside: those are its chips (C8).
  const stamps = [...document.querySelectorAll('[class*="su-badge"], .su-poster-stamp')].filter(
    (s) => drawn(s) && !s.closest('button, a') && dark(fill(s))
  )
  for (const c of controls) {
    if (c.closest('.su-entity-compact__head, .su-entity-mini, .su-step-btn')) continue
    const cr = c.getBoundingClientRect()
    const cFill = fill(c)
    if (cFill === 'rgba(0, 0, 0, 0)') continue
    const twin = stamps.find((s) => {
      const sr = s.getBoundingClientRect()
      const sameLine = Math.abs(sr.top + sr.height / 2 - (cr.top + cr.height / 2)) < 4
      const close = Math.min(Math.abs(sr.left - cr.right), Math.abs(cr.left - sr.right)) < 48
      return (
        sameLine &&
        close &&
        fill(s) === cFill &&
        getComputedStyle(s).color === getComputedStyle(c).color
      )
    })
    if (twin) out.push(`stamp-twin: ${name(c)} beside ${name(twin)}`)
  }

  // tool-title-clip: a clipped title whose head names no entity.
  for (const t of document.querySelectorAll('.su-entity-compact__title')) {
    if (!drawn(t) || t.scrollWidth <= t.clientWidth + 1) continue
    // A TitledBox is the one non-entity that wears a Compact's head (`su-box`).
    if (t.closest('.su-entity-compact')?.classList.contains('su-box'))
      out.push(`tool-title-clip: ${name(t)}`)
  }

  // measure and first-screen.
  const band = document.querySelector('.su-chapter-band__title')
  if (band && (context === 'reference' || context === 'manage')) {
    const measure =
      Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--page-measure')
      ) * 16
    const left = band.getBoundingClientRect().left
    const want = Math.max(0, (document.documentElement.clientWidth - measure) / 2)
    if (left + 1 < want)
      out.push(
        `measure: the band title starts at ${Math.round(left)}px, the measure at ${Math.round(want)}px`
      )
  }
  if (phone && band) {
    const foot =
      band.closest('header, [class*="chapter-band"]')?.getBoundingClientRect().bottom ?? 0
    // The first text that is content: no control, field or section stamp.
    let first: number | undefined
    const main = document.querySelector('main') ?? document.body
    const texts = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let n = texts.nextNode(); n; n = texts.nextNode()) {
      const el = n.parentElement
      if (!el || !n.textContent?.trim() || !drawn(el)) continue
      if (
        el.closest('button, a.su-btn, input, select, label, [role="search"], [data-slab], header')
      )
        continue
      const top = el.getBoundingClientRect().top + scrollY
      if (top >= foot) {
        first = top
        break
      }
    }
    if (first !== undefined && first > innerHeight)
      out.push(
        `first-screen: the first content starts at ${Math.round(first)}px, under a ${innerHeight}px screen`
      )
  }
  return out
}

/** Every hierarchy fault on the page as it stands (R55). */
export async function findHierarchy(page: Page, at: Context): Promise<Finding[]> {
  return fromFaults(await page.evaluate(scan, { ...at, ladder: LADDER }))
}
