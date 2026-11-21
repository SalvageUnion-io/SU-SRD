import { readFileSync } from 'node:fs'
import { join } from 'node:path'
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

/**
 * A sheet's dashboard (`PilotDash`) draws its class's trees as the class page
 * does (R48): under its Abilities group, each tree is its own track under a
 * stamp naming it (`.su-ability-tree__group` in `.su-pilot-trees`), never more
 * than `MAX_ACROSS` side by side, and lists every ability the dataset puts in
 * that tree as a Mini, and none from another. `findDashTrees` returns one
 * `dash-tree` finding per fault.
 */
export const DASH_TREE_SELECTORS = {
  group: 'section',
  heading: 'h2',
  tree: '.su-pilot-trees > .su-ability-tree__group',
  title: ':scope > .su-slab-section__head > :first-child',
  name: '.su-entity-mini__name',
}

/** Runs in the page: each tree's name, its abilities and where it starts. */
function scanDashTrees(a: typeof DASH_TREE_SELECTORS) {
  // What a reader sees: the screen-reader-only words (a Mini's kind) left out.
  const text = (el: Element | null) => {
    const copy = el?.cloneNode(true) as Element | undefined
    for (const hidden of copy?.querySelectorAll('.su-sr-only') ?? []) hidden.remove()
    return (copy?.textContent ?? '').replace(/\s+/g, ' ').trim()
  }
  const group = [...document.querySelectorAll(a.group)].find(
    (s) => text(s.querySelector(a.heading)) === 'Abilities'
  )
  if (!group) return undefined
  return [...group.querySelectorAll(a.tree)].map((tree) => {
    const r = tree.getBoundingClientRect()
    return {
      tree: text(tree.querySelector(a.title)),
      names: [...tree.querySelectorAll(a.name)].map((n) => text(n)),
      top: r.top,
      drawn: r.width > 0 && r.height > 0,
    }
  })
}

/** Every ability's tree, from the reference data. */
function abilityTrees(): Map<string, string[]> {
  const file = join(
    import.meta.dirname,
    '../../../packages/salvageunion-reference/data/abilities.json'
  )
  const abilities = JSON.parse(readFileSync(file, 'utf8')) as { name: string; tree: string }[]
  const trees = new Map<string, string[]>()
  for (const ability of abilities) {
    trees.set(ability.tree, [...(trees.get(ability.tree) ?? []), ability.name])
  }
  return trees
}

/** Every dashboard tree's fault on the page, each a `dash-tree` finding. */
export async function findDashTrees(page: Page): Promise<Finding[]> {
  const read = await page.evaluate(scanDashTrees, DASH_TREE_SELECTORS)
  if (read === undefined)
    return fromFaults(['group: no Abilities group on the dashboard'], 'dash-tree')
  const faults: string[] = []
  const drawn = read.filter((t) => t.drawn)
  if (drawn.length === 0) faults.push('group: the Abilities group draws no tree')
  const data = abilityTrees()
  const lines: { top: number; trees: string[] }[] = []
  for (const t of drawn) {
    const want = data.get(t.tree)
    if (!want) {
      faults.push(`tree: "${t.tree}" is no tree in the dataset`)
      continue
    }
    const missing = want.filter((name) => !t.names.includes(name))
    const strays = t.names.filter((name) => !want.includes(name))
    if (missing.length > 0) faults.push(`tree: ${t.tree} leaves out ${missing.join(', ')}`)
    if (strays.length > 0)
      faults.push(`tree: ${t.tree} lists ${strays.join(', ')}, of another tree`)
    const line = lines.find((l) => Math.abs(l.top - t.top) <= SLACK)
    if (line) line.trees.push(t.tree)
    else lines.push({ top: t.top, trees: [t.tree] })
  }
  for (const line of lines) {
    if (line.trees.length > MAX_ACROSS)
      faults.push(`across: ${line.trees.length} trees on one line (${line.trees.join(', ')})`)
  }
  if (new Set(drawn.map((t) => t.tree)).size !== drawn.length)
    faults.push('group: a tree is drawn more than once')
  return fromFaults(faults, 'dash-tree')
}
