/**
 * classContents — a class Page's "On this page": the anchors its sections
 * land on and the entries that link them, drawn as the Page's own line
 * (`ClassContents`) and the band's menu (`PageContentsMenu`).
 */

import type { RefClass, RefEntity } from 'salvageunion-reference'
import { resolveClassPlan } from '../lib/rules/classPaths'
import { componentsCopy } from '../messages/components'
import { treeAnchor } from './referenceEntity/card/abilityTreeRelations'

/** Where the contents land: the sections that are no tree (a tree's is `treeAnchor`). */
export const TRAINING_ID = 'training'
export const ABILITIES_ID = 'abilities'
export const REQUIRED_ID = 'required-trees'
/** A Hybrid Class's path card on a Core class's page: `path-fabricator`. */
export const pathAnchor = (name: string) => `path-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

/** The class (core trees) or advanced class (hybrid) whose ability tree a card carries. */
export function classOf(item: RefEntity): RefClass | undefined {
  if ('coreTrees' in item && Array.isArray(item.coreTrees)) return item
  if ('hybrid' in item && item.hybrid === true) return item
  return undefined
}

/** One "On this page" entry: the anchor it lands on (no `#`) and its words. */
export type PageContentsEntry = { href: string; label: string }

/**
 * A class Page's sections, in reading order: Training, its Core trees, then
 * every path it advances along (a Hybrid's own Abilities and Required trees).
 * Every entry lands on a heading the page has.
 */
export function classContentsEntries(classEntity: RefClass): PageContentsEntry[] {
  const plan = resolveClassPlan(classEntity)
  if (plan.kind === 'none') return []
  const entries: PageContentsEntry[] = [{ href: TRAINING_ID, label: componentsCopy('training') }]
  if (plan.kind === 'hybrid') {
    entries.push({ href: ABILITIES_ID, label: componentsCopy('abilities') })
    if (plan.branches.some((branch) => branch.group))
      entries.push({ href: REQUIRED_ID, label: componentsCopy('requiredTrees') })
  } else {
    for (const group of plan.coreTrees)
      entries.push({ href: treeAnchor(group.tree), label: group.tree })
    const paths = [...plan.paths].sort(
      (a, b) => Number(Boolean(a.hybrid)) - Number(Boolean(b.hybrid))
    )
    for (const path of paths) {
      if (path.hybrid) {
        entries.push({ href: pathAnchor(path.hybrid.name), label: path.hybrid.name })
        continue
      }
      entries.push({ href: treeAnchor(path.advanced.tree), label: path.advanced.tree })
      if (path.legendary)
        entries.push({ href: treeAnchor(path.legendary.tree), label: path.legendary.tree })
    }
  }
  return entries
}

/** A Page's sections where its entity is a class (`classOf`), else none. */
export function classContentsFor(item: RefEntity): PageContentsEntry[] | undefined {
  const classEntity = classOf(item)
  return classEntity ? classContentsEntries(classEntity) : undefined
}
