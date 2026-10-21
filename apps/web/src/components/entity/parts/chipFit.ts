/**
 * A CONTENTFUL MINI'S OVERFLOW (`chips-and-actions.md` C2b, C5, R37): its
 * head is one line, its chips beside the name and
 * never on a line of their own, so they never make the head taller. What
 * does not fit there leaves the head for its body's first row (the body's
 * `[data-chip-overflow]`), left-aligned, in class order; the Tech Level, the
 * cost and the slots after it (C8) never leave. A contentful Mini shows no
 * +MORE: its body has the room.
 *
 * The name keeps at least `min(9rem, 40%)` of the pill (ending in "…" past
 * that, E18's Mini exception); the chips take the rest. The plan is the
 * head's (`overflowPlan`, `chipFill.ts`), and so is the row's drawing
 * (`writeOverflowRow`). Plain DOM, no React: the client entry
 * (`islands.client.ts`) runs it on a static page, and `Mini` on the ones it
 * draws. Until it has run (and with no script) the chips wrap beside the
 * name, every chip whole.
 */

import {
  isFirst,
  isKept,
  isNotChip,
  OUT_ATTRIBUTE,
  overflowPlan,
  watchChipFill,
  watchStaticChipFill,
} from '../../atoms/chipFill'
import { writeOverflowRow } from '../../atoms/chipOverflowRow'

/** A contentful Mini (N3): its head's chips overflow into its body. */
const CONTENTFUL = '.su-entity-mini[data-contentful]'

/** Set once a fit has run: the strip is then one line (CSS). */
const FITTED_ATTRIBUTE = 'data-chip-fitted'

/** The share of the pill the name always keeps, and its cap in rem. */
const NAME_SHARE = 0.4
const NAME_CAP_REM = 9

/** The room the strip may take: the pill's, less the name's floor and what else stands on the line. */
export function stripRoom(
  pill: number,
  others: readonly number[],
  gap: number,
  rem: number
): number {
  const floor = Math.min(NAME_CAP_REM * rem, NAME_SHARE * pill)
  return others.reduce((room, width) => room - width - gap, pill - floor - gap)
}

/** A Mini's strip, its pill and its body's overflow row, or nothing to fit. */
function partsOf(token: HTMLElement) {
  const strip = token.querySelector<HTMLElement>('.su-entity-mini__chips')
  const pill = strip?.closest<HTMLElement>('.su-entity-mini__pill')
  const row = token.querySelector<HTMLElement>(
    ':scope > .su-entity-mini__body > [data-chip-overflow]'
  )
  return strip && pill && row ? { strip, pill, row } : undefined
}

/** The strip's chips, in order: each lane's children (the lanes are `display: contents`). */
function chipsOf(strip: HTMLElement): HTMLElement[] {
  const chips: HTMLElement[] = []
  for (const lane of strip.children) {
    for (const chip of lane.children) {
      if (!(chip instanceof HTMLElement)) continue
      if (isNotChip(chip)) continue
      chips.push(chip)
    }
  }
  return chips
}

const width = (el: Element) => el.getBoundingClientRect().width

/**
 * Fit one contentful Mini: every chip drawn on the strip's one line and
 * measured, then what does not fit beside the name's floor marked out (not
 * drawn in the head) and copied into its body's first row. The same width
 * gives the same result: nothing flickers, nothing feeds back.
 */
export function fitTokenOverflow(token: HTMLElement): void {
  const parts = partsOf(token)
  if (!parts) return
  const { strip, pill, row } = parts
  const chips = chipsOf(strip)
  for (const chip of chips) chip.removeAttribute(OUT_ATTRIBUTE)
  const ps = getComputedStyle(pill)
  const content =
    pill.clientWidth -
    (Number.parseFloat(ps.paddingLeft) || 0) -
    (Number.parseFloat(ps.paddingRight) || 0)
  // Not laid out (a closed tab, a hidden dialog): nothing to measure yet; it
  // fits when it is drawn (its head's width changes).
  if (content <= 0) {
    token.removeAttribute(FITTED_ATTRIBUTE)
    writeOverflowRow(row, [])
    return
  }
  token.setAttribute(FITTED_ATTRIBUTE, '')
  const pillGap = Number.parseFloat(ps.columnGap) || 0
  // What else stands on the line: the note stamp, the tier (not the name's cut-out).
  const others = [...pill.children]
    .filter((el) => el !== strip && !el.classList.contains('su-entity-mini__notch'))
    .map(width)
  const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  const room = stripRoom(content, others, pillGap, rem)
  const gap = Number.parseFloat(getComputedStyle(strip).columnGap) || 0
  const widths = chips.map(width)
  // The strip's width is its chips' and the gaps between them: the plan
  // counts a gap before each, so the name it is given is minus one gap.
  const plan = overflowPlan(
    widths,
    chips.map((chip) => isKept(chip, strip)),
    -gap,
    room,
    gap,
    undefined,
    chips.map((chip) => isFirst(chip, strip))
  )
  const out = chips.filter((_, i) => plan.out[i])
  for (const chip of out) chip.setAttribute(OUT_ATTRIBUTE, '')
  writeOverflowRow(row, out)
}

/**
 * Fit a contentful Mini now and whenever it resizes, a face loads or its
 * chips change (`watchChipFill`'s watch); returns the stop.
 */
export function watchTokenOverflow(token: HTMLElement): () => void {
  if (!partsOf(token)) return () => undefined
  return watchChipFill(token, fitTokenOverflow)
}

/** A static page's contentful Minis (server-rendered, no React): each fits (in turns) and on resize. */
export function watchStaticTokenOverflow(root: ParentNode = document): void {
  watchStaticChipFill(root, CONTENTFUL, fitTokenOverflow)
}
