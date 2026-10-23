/**
 * Every entity page prints its record: each string the data carries for an
 * entity (its prose, its actions' prose and names, its table's name, its
 * sections) appears in that entity's page, as a reader sees it.
 *
 * A field the card has no branch for, a block type a renderer skips, or a
 * name a resolver cannot find is dropped without a sound: the page still
 * builds. This walks the record and the rendered page side by side so a drop
 * fails here, by path, instead of in a player's screenshot.
 *
 * The page is the SSG's own render of the item and pattern routes, plus the
 * static card for an entity whose card is an island (`EntityView`: the island
 * is not server-rendered, and it draws this same card).
 *
 * What a page deliberately does not print is named in `NOT_PRINTED` with its
 * reason; a stale entry fails too, so the list cannot outlive the gap.
 */

import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityCardStatic } from '../../components/EntityCardStatic'
import { cardNeedsHydration } from '../../lib/cardNeedsHydration'
import { SITE_URL } from '../../lib/constants'
import { beginIslandCollection, endIslandCollection } from '../../runtime/Island'
import { patternPage } from '../pages/[schemaId]/[itemId]/pattern/[patternId].page'
import { itemPage } from '../pages/[schemaId]/[itemId].page'

/** Keys that are identity, provenance or enums the page spells its own way. */
const NOT_TEXT = new Set([
  'id',
  'source',
  'sources',
  'additionalSources',
  'page',
  'slug',
  'formerSlugs',
  'hasArtwork',
  'actionSource',
  'choiceId',
  'indexable',
  'schema',
  'schemaName',
  'kind',
  'type',
  'damageType',
  'range',
  'actionType',
  'mechActionType',
  'lifetime',
  'guideType',
  // Machine-applied rules data (ADR-029): the app applies it, the prose states it.
  'contributions',
  'appliedEffects',
  // A guide step's catalogue filter and layout: configuration, not text.
  'filters',
  'entityLayout',
  // A pattern prints on its own page, walked there.
  'patterns',
])

/**
 * Paths a page does not print, by `<schema> <record path>`, each with why.
 * A record path is the walk's: `.content[].value`, `.actions>.choices[].name`.
 */
const NOT_PRINTED: Record<string, string> = {
  // Choices are the builder's prompts ("The name of your Auto-Turret."): the
  // Reference is read-only and prints the rule, not the form.
  'abilities .actions>.choices[].name': 'builder prompt',
  'abilities .actions>.choices[].content[].value': 'builder prompt',
  'equipment .choices[].name': 'builder prompt',
  'equipment .choices[].content[].value': 'builder prompt',
  'equipment .actions>.choices[].content[].value': 'builder prompt',
  'systems .actions>.choices[].name': 'builder prompt',
  'systems .actions>.choices[].content[].value': 'builder prompt',
  'modules .actions>.choices[].content[].value': 'builder prompt',
  'crawler-bays .npc.choices[].name': 'builder prompt',
  'crawler-bays .npc.choices[].content[].value': 'builder prompt',
  'crawlers .npc.choices[].name': 'builder prompt',
  'crawlers .npc.choices[].content[].value': 'builder prompt',
  // The ability's cost line comes from its action ("1 AP"); `Variable` is an index tag.
  'abilities .activationCurrency': 'the action prints the cost',
  // The ability's paragraph is its self-action's three, merged; the page prints those.
  'abilities .content[].value': 'merged copy of the self-action prose',
  // A homebrew pattern's credit is a link: its URL is the href, not the text.
  'chassis .origin': 'the credit link',
  // Known gaps, kept loud: a pattern's chosen weapon ("Mech Melee Armament:
  // Blade") is read by nothing yet, and a source's edition and store link have
  // no place on its page.
  'chassis .systems[].preselectedChoices.*': 'known gap: not read by any surface',
  'sources .purchaseLink': 'known gap: no store link on a source page',
  'sources .version': 'known gap: no edition on a source page',
}

type Found = { path: string; text: string }

const fold = (s: string) =>
  s
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** A record name less its host ("Armour Plating (Scylla)"): the page drops the host. */
const bare = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '')

function walk(x: unknown, path: string, out: Found[], seen: Set<unknown>): void {
  if (x == null || seen.has(x)) return
  if (typeof x === 'string') {
    if (x.trim().length >= 3) out.push({ path, text: x })
    return
  }
  if (typeof x !== 'object') return
  seen.add(x)
  if (Array.isArray(x)) {
    for (const v of x) walk(v, `${path}[]`, out, seen)
    return
  }
  for (const [key, value] of Object.entries(x)) {
    if (NOT_TEXT.has(key)) continue
    // The record's own name is the page's title, outside the card.
    if (path === '' && key === 'name') continue
    if (key === 'actions' && Array.isArray(value) && value.every((v) => typeof v === 'string')) {
      for (const name of value as string[]) {
        const action = SalvageUnionReference.Actions.getByName(name)
        if (!action) out.push({ path: `${path}.actions(unresolved)`, text: name })
        // A hidden action is play's (Meld Form's attack), never a card.
        else if (!('hidden' in action && action.hidden)) walk(action, `${path}.actions>`, out, seen)
      }
      continue
    }
    // A nested table opens from its name (its rows are its Peek's): the name must print.
    if (key === 'tableName' && typeof value === 'string') {
      out.push({ path: `${path}.tableName`, text: value })
      continue
    }
    const keyPath = /^[0-9a-f]{8}-/.test(key) ? `${path}.*` : `${path}.${key}`
    walk(value, keyPath, out, seen)
  }
}

function pageText(children: ReactNode, item: RefEntity, pattern?: RefObjectAnyPattern): string {
  beginIslandCollection()
  let html: string
  try {
    html = renderToStaticMarkup(children)
  } finally {
    endIslandCollection()
  }
  if (cardNeedsHydration(item, pattern)) {
    html += renderToStaticMarkup(<EntityCardStatic item={item} pattern={pattern} />)
  }
  return fold(
    html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
  )
}

type Route = {
  params: Record<string, string>
  props: { item?: RefEntity; host?: RefEntity; pattern?: RefObjectAnyPattern }
}
type RouteModule = {
  getStaticPaths?: () => Route[]
  page: (ctx: never) => { children: ReactNode }
}

/** Every string a page drops, as `<schema> <path>` → the pages and text. */
function drops(): Map<string, string[]> {
  const missing = new Map<string, string[]>()
  const run = (module: RouteModule, isPattern: boolean) => {
    for (const route of module.getStaticPaths?.() ?? []) {
      const { schemaId, itemId, patternId } = route.params
      const pathname = `/${schemaId}/${itemId}/${isPattern ? `pattern/${patternId}/` : ''}`
      const item = (isPattern ? route.props.host : route.props.item) as RefEntity
      const pattern = isPattern ? route.props.pattern : undefined
      const ctx = {
        params: route.params,
        props: route.props,
        url: new URL(pathname, SITE_URL),
        pathname,
        builtAssets: {},
      }
      const text = pageText(module.page(ctx as never).children, item, pattern)
      const found: Found[] = []
      walk(pattern ?? item, '', found, new Set())
      for (const { path, text: value } of found) {
        // `[(CHASSIS)]` prints as the host's name, article and all ("The E-Boat"):
        // each run of text around it must print.
        const runs = value.split('[(CHASSIS)]').map(fold)
        if (runs.every((run) => text.includes(run)) || text.includes(fold(bare(value)))) continue
        const key = `${schemaId} ${path}`
        missing.set(key, [...(missing.get(key) ?? []), `${pathname}: ${value.slice(0, 80)}`])
      }
    }
  }
  run(itemPage as unknown as RouteModule, false)
  run(patternPage as unknown as RouteModule, true)
  return missing
}

describe('every entity page prints its record', () => {
  const missing = drops()

  test('no field is dropped but those NOT_PRINTED names', () => {
    const unexplained = [...missing.entries()]
      .filter(([key]) => !(key in NOT_PRINTED))
      .map(([key, where]) => `${key}\n    ${where.slice(0, 3).join('\n    ')}`)
    expect(unexplained).toEqual([])
  })

  test('every NOT_PRINTED entry still names a real gap', () => {
    const stale = Object.keys(NOT_PRINTED).filter((key) => !missing.has(key))
    expect(stale).toEqual([])
  })
})
