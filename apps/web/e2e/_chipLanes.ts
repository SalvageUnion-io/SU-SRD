import type { Page } from '@playwright/test'

/**
 * Hard rule R2 (`chips-and-actions.md` C6, C7) as the rendered page draws it:
 * in a list, every chip class is a column. A LIST is the lines that share a
 * parent: each a Compact or Mini (with the wrappers it sits in alone, its `li`)
 * whose head carries a chip strip (`[data-chip-group]`), compared down each
 * column (the lines on one left and right edge). In a list whose lines have
 * room (a Compact `PACK_AT` wide, a Mini past a phone; short of it each line
 * packs right, C6), every class that two lines carry starts on one left
 * edge in both. `findChipLaneFaults` returns
 * one line per class off its column:
 *
 * - **lanes** `<first line>… <class> left edges <x>,<x>` — the class's first
 *   chip in each line, left to right down the list.
 */

/** The pack breakpoint (`.su-chips` in `entity-forms.css`): 40rem, the ladder's `sm`. */
const PACK_AT = 640

/** Runs in the page; returns plain data. */
function scan({ packAt }: { packAt: number }): string[] {
  const describe = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    return r.width >= 4 && r.height >= 4
  }
  // Each line's strip: the outermost `Chips` in a Compact's head. A Mini holds
  // no lanes: its chips pack as far right as they go (C6, owner 2026-10-19).
  const strips = [...document.querySelectorAll('[data-chip-group]')].filter(
    (strip) =>
      !strip.parentElement?.closest('[data-chip-group]') &&
      strip.closest('.su-entity-compact__head') &&
      visible(strip)
  )
  const lists = new Map<Element, { line: Element; strip: Element }[]>()
  for (const strip of strips) {
    // A Card's head is no line (`chipLanes.ts`), even inside a Compact-drawn frame.
    const own = strip.closest('.su-entity-compact, .su-entity-mini, .su-ec-outer, .su-ec-frame')
    if (!own || own.matches('.su-ec-outer, .su-ec-frame')) continue
    let line: Element = own
    // Up through the wrappers a line sits in alone (a grid cell, a `div`).
    while (line.parentElement && line.parentElement.childElementCount === 1) {
      line = line.parentElement
    }
    const list = line.parentElement
    if (!list) continue
    const lines = lists.get(list) ?? []
    lines.push({ line, strip })
    lists.set(list, lines)
  }
  const faults: string[] = []
  // A column of a list: its lines on one left and one right edge (a grid's
  // cells side by side, a fit list's lines sized to their names, are not one).
  const columns: { line: Element; strip: Element }[][] = []
  for (const lines of lists.values()) {
    const byEdges = new Map<string, { line: Element; strip: Element }[]>()
    for (const entry of lines) {
      const r = entry.line.getBoundingClientRect()
      // A Compact packs below `packAt` (a container query).
      if (r.width < packAt) continue
      const key = `${Math.round(r.left)}:${Math.round(r.right)}`
      byEdges.set(key, [...(byEdges.get(key) ?? []), entry])
    }
    columns.push(...byEdges.values())
  }
  for (const wide of columns) {
    if (wide.length < 2) continue
    // Each class's first chip's left edge, line by line.
    const edges = new Map<string, number[]>()
    for (const { strip } of wide) {
      const seen = new Set<string>()
      for (const lane of strip.querySelectorAll('[data-chip-class]')) {
        const cls = lane.getAttribute('data-chip-class') ?? ''
        if (seen.has(cls)) continue
        const chips = [...lane.children].filter(visible)
        if (chips.length === 0) continue
        seen.add(cls)
        const left = Math.min(...chips.map((chip) => chip.getBoundingClientRect().left))
        edges.set(cls, [...(edges.get(cls) ?? []), Math.round(left)])
      }
    }
    const where = `${describe(wide[0]?.line as Element)}…`
    for (const [cls, lefts] of edges) {
      if (lefts.length < 2) continue
      if (Math.max(...lefts) - Math.min(...lefts) > 1) {
        faults.push(`lanes: ${where} ${cls} left edges ${lefts.join(',')}`)
      }
    }
  }
  return faults
}

/** Every list whose chip classes are off their columns, as the page stands. */
export async function findChipLaneFaults(page: Page): Promise<string[]> {
  return page.evaluate(scan, { packAt: PACK_AT })
}
