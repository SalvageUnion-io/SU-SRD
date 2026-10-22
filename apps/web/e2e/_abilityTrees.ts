import type { Page } from '@playwright/test'
import type { Finding } from './_findings'
import { fromFaults } from './_findings'

/**
 * Ability trees as the rendered page draws them (`AbilityTrack`): on a class
 * page, the abilities index's Tree view and the pilot sheet.
 * `findAbilityTrees` returns one `tree` finding per fault:
 *
 * - **across** more than `MAX_ACROSS` trees start on one line of one layout.
 * - **column** a tree's tiers stand further apart than its track's gap (and
 *   `SLACK`): the tier is sitting on a row shared with the trees beside it
 *   rather than stacking in its own column.
 *
 * A Legendary (pick-one) track is not read for `column`: its picks sit in
 * equal rows by design. A tree that is not drawn (a folded section) is not read.
 */
export type AbilityTreeSelectors = {
  track: string
  tier: string
  /** The tree a track belongs to: its slab and track (the outermost box beside its siblings). */
  tree: string
  /** The entity a tier draws: the box whose edges a reader sees. */
  entity: string
}

export const ABILITY_TREE_SELECTORS: AbilityTreeSelectors = {
  track: '.su-ability-track',
  tier: ':scope > .su-ability-track__tier',
  tree: '.su-ability-tree__group, .su-listing__group',
  entity: '.su-entity-mini, .su-entity-compact',
}

/** Never more trees than this side by side. */
export const MAX_ACROSS = 3

/** Sub-pixel rounding and a frame's edge, in CSS px, past the track's gap. */
export const SLACK = 2

/** Runs in the page and returns plain data: everything it needs is declared inside it. */
export function scanAbilityTrees({
  a,
  maxAcross,
  slack,
}: {
  a: AbilityTreeSelectors
  maxAcross: number
  slack: number
}): string[] {
  const faults: string[] = []
  const drawn = (el: Element) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 && r.height > 0
  }
  // A tree's name: its section's label, or its slab's stamp.
  const nameOf = (tree: Element) =>
    (
      tree.getAttribute('aria-label') ??
      tree.querySelector('[data-slab] > :first-child')?.textContent ??
      'a tree'
    )
      .trim()
      .slice(0, 40)
  const lines = new Map<Element, Element[]>()
  for (const track of document.querySelectorAll<HTMLElement>(a.track)) {
    if (!drawn(track)) continue
    const tree = track.closest(a.tree) ?? track
    const parent = tree.parentElement
    if (parent) lines.set(parent, [...(lines.get(parent) ?? []), tree])
    if (track.dataset.track === 'legendary') continue
    const gap = Number.parseFloat(getComputedStyle(track).rowGap) || 0
    const entities = [...track.querySelectorAll(a.tier)].flatMap((tier) => {
      const entity = tier.querySelector(a.entity)
      return entity && drawn(entity) ? [entity] : []
    })
    for (let i = 1; i < entities.length; i++) {
      const above = entities[i - 1]?.getBoundingClientRect()
      const below = entities[i]?.getBoundingClientRect()
      if (!above || !below) continue
      const step = below.top - above.bottom
      if (step > gap + slack) {
        faults.push(
          `column: ${nameOf(tree)}'s tier ${i + 1} stands ${Math.round(step)}px under tier ${i}, past its ${Math.round(gap)}px gap`
        )
      }
    }
  }
  for (const trees of lines.values()) {
    const rows: { top: number; names: string[] }[] = []
    for (const tree of new Set(trees)) {
      const top = tree.getBoundingClientRect().top
      const row = rows.find((r) => Math.abs(r.top - top) <= slack)
      if (row) row.names.push(nameOf(tree))
      else rows.push({ top, names: [nameOf(tree)] })
    }
    for (const row of rows) {
      if (row.names.length > maxAcross) {
        faults.push(`across: ${row.names.length} trees on one line (${row.names.join(', ')})`)
      }
    }
  }
  return faults
}

/** Every ability tree's layout fault on the page, each a `tree` finding. */
export async function findAbilityTrees(page: Page): Promise<Finding[]> {
  const faults = await page.evaluate(scanAbilityTrees, {
    a: ABILITY_TREE_SELECTORS,
    maxAcross: MAX_ACROSS,
    slack: SLACK,
  })
  return fromFaults(faults, 'tree')
}
