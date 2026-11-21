import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * The cut-out law at render: every paper cut-out stands flush on its strip's
 * foot, notched into the body under it, never floated over the strip's paint
 * (ruleset, the cut-out law; ledger.md L2). It reads each strip that wears
 * cut-outs and the cut-outs on it:
 *
 * - a Ledger's head: its title tab and each column's label;
 * - a sheet table's painted head: its title tab and each column's label;
 * - a section's band (`.su-rule-head`): its label, where the label is paper
 *   (a guide's phase is a plain ruled label, no cut-out);
 * - the home's slideshow: the site's name hangs from its top edge, a slide's
 *   plate stands on its foot.
 *
 * Each fault is `foot: <what> "<label>" <n>px off its strip's foot`. A
 * section band's cut-out also wears the ground of the body it heads (R45):
 * paper over a paper panel, the page's ground over cards or words that stand
 * on it; a mismatch is `ground: band "<label>" <cut> over a <body> body`.
 * `findCutouts` reads the page; `findCutoutFaults`, pure, judges what it read
 * (`e2e/__tests__/cutouts.test.ts`).
 */

export type CutoutRead = {
  /** What the cut-out is: `ledger tab`, `ledger col`, `table tab`, `table col`, `band`, `home`. */
  what: string
  /** Its words, as drawn (cut short). */
  label: string
  /** Its strip's edge less its own (px): 0 when flush. */
  off: number
  /** A band's cut-out: its paint and its body's ground, which must be one. */
  ground?: { cut: string; body: string }
}

/** A cut-out within a pixel of its strip's edge is flush (sub-pixel layout rounds). */
const TOLERANCE = 1

/** The fix every fault prints: where a cut-out's foot is set. */
export const CUTOUT_FIX =
  'stand it on the foot: bottom-align its cell (vertical-align: bottom) or flex item ' +
  "(align-self at the strip's foot), with no baseline, padding or margin under it; " +
  'a band wraps upward (wrap-reverse), never under its label'

/** The fix a ground fault prints. */
const CUTOUT_GROUND_FIX =
  "a cut-out wears its body's ground (R45): `--su-head-cut` follows `--su-ground`; " +
  'a body that is paper on the page sets the strip paper, cards on the ground leave it'

/** Every cut-out off its strip's foot, or off its body's ground, with the fix. */
export function findCutoutFaults(reads: readonly CutoutRead[]): string[] {
  const faults: string[] = []
  for (const r of reads) {
    if (Math.abs(r.off) > TOLERANCE)
      faults.push(
        `foot: ${r.what} "${r.label}" ${r.off.toFixed(1)}px off its strip's foot (${CUTOUT_FIX})`
      )
    if (r.ground && r.ground.cut !== r.ground.body)
      faults.push(
        `ground: ${r.what} "${r.label}" ${r.ground.cut} over a ${r.ground.body} body (${CUTOUT_GROUND_FIX})`
      )
  }
  return faults
}

function readCutouts(page: Page): Promise<CutoutRead[]> {
  return page.evaluate(() => {
    const out: CutoutRead[] = []
    const shown = (e: Element) => {
      const s = getComputedStyle(e)
      const r = e.getBoundingClientRect()
      return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 2 && r.height > 2
    }
    const words = (e: Element) => (e.textContent ?? '').trim().slice(0, 24)
    const clear = (c: string) => c === '' || c === 'transparent' || c === 'rgba(0, 0, 0, 0)'
    // The paint an element shows: its own, or the first painted ancestor's.
    const groundOf = (e: Element | null): string => {
      for (let at = e; at; at = at.parentElement) {
        const c = getComputedStyle(at).backgroundColor
        if (!clear(c)) return c
      }
      return ''
    }
    const foot = (strip: Element, cut: Element, what: string) => {
      if (!shown(strip) || !shown(cut)) return
      const off = strip.getBoundingClientRect().bottom - cut.getBoundingClientRect().bottom
      out.push({ what, label: words(cut), off })
    }
    for (const head of document.querySelectorAll('.su-ledger__head')) {
      for (const tab of head.querySelectorAll(':scope > th:first-child .su-entity-compact__notch'))
        foot(head, tab, 'ledger tab')
      for (const col of head.querySelectorAll(
        ':scope > th:not(:first-child) .su-badge--stamp-solid'
      ))
        foot(head, col, 'ledger col')
    }
    for (const row of document.querySelectorAll('table.su-open:not(.su-open--sub) > thead > tr')) {
      for (const tab of row.querySelectorAll('.su-open__title > .su-rule-head__label'))
        foot(row, tab, 'table tab')
      for (const col of row.querySelectorAll('.su-open__col-tab')) foot(row, col, 'table col')
    }
    for (const band of document.querySelectorAll('.su-rule-head:not(.su-rule-head--sub)')) {
      if (band.closest('thead')) continue
      for (const label of band.querySelectorAll(':scope > .su-rule-head__label')) {
        const paper = getComputedStyle(label).backgroundColor
        if (clear(paper)) continue
        foot(band, label, 'band')
        const body = band.nextElementSibling
        const ground = body && !body.matches('.su-rule-head') && shown(body) ? groundOf(body) : ''
        if (ground && shown(label))
          out.push({
            what: 'band',
            label: words(label),
            off: 0,
            ground: { cut: paper, body: ground },
          })
      }
    }
    const show = document.querySelector('.su-front__show')
    if (show) {
      const edge = show.getBoundingClientRect()
      const name = document.querySelector('.su-front__show-name')
      if (name && shown(name))
        out.push({
          what: 'home',
          label: words(name),
          off: name.getBoundingClientRect().top - edge.top,
        })
      for (const plate of document.querySelectorAll('.su-front__show-copy')) {
        // Only the slide in view: the others are faded out.
        const slide = plate.closest('.su-front__show-slide')
        if (!slide || getComputedStyle(slide).visibility === 'hidden' || !shown(plate)) continue
        out.push({
          what: 'home',
          label: words(plate),
          off: edge.bottom - plate.getBoundingClientRect().bottom,
        })
      }
    }
    return out
  })
}

/** Every cut-out on the page off its strip's foot. */
export async function findCutouts(page: Page): Promise<Finding[]> {
  return fromFaults(findCutoutFaults(await readCutouts(page)))
}
