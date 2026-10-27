/**
 * `/_redirects` — the 301s Workers Static Assets serves (ADR-033), generated so
 * the data can carry its own.
 *
 * Two kinds of rule:
 *
 * - **The fixed moves** (`FIXED_MOVES` in `lib/redirects.ts`, the table every
 *   301 reads): `sitemap.xml` to the index the build emits.
 * - **Former slugs** (ADR-043, decision 4: a published slug never dies). A row
 *   that became a pattern of another — "Hill Worm Pattern Typhon", now
 *   Typhon's "Hill Worm" — keeps its old URL answering: the page 301s to the
 *   pattern's page (with and without the trailing slash, since a hand-typed
 *   link may have either, and under both the legacy `/schema/…/item/` grammar
 *   and the current one), and the item's `.json` to its host's, which carries
 *   the pattern, under `/schema/` and `/api/v1/` alike. Its `.og.png` unfurl image 301s to the pattern's, under
 *   both grammars too.
 *
 * - **Action pages.** Actions had pages once, `/actions/<slug>/`; now an
 *   action renders on the entity that has it. Each action exactly one entity
 *   lists sends its old page to that entity's. An action several entities
 *   share has no one place to go: the Worker sends it to the search
 *   (`formerSitePath`), as it does any action this file has no rule for.
 *
 * The bulk move of every page out of `/schema/…/item/` is NOT here: that is one
 * pattern, not a rule per page, and the Worker answers it (`lib/redirects.ts`).
 *
 * It replaces a hand-written `public/_redirects`: an endpoint is written after
 * Vite copies `public/`, so a second copy there would be overwritten silently.
 */

import { formerSlugsIn, nameToSlug } from 'salvageunion-reference'
import { apiV1ItemPath } from '../../lib/apiV1Paths'
import { itemHref } from '../../lib/entityHref'
import { getEntitySchemas, getModel, getReferenceEntityData } from '../../lib/gameData'
import { ogImagePath } from '../../lib/ogCard'
import { srdPatternHref } from '../../lib/patternHref'
import { FIXED_MOVES, legacyItemHref } from '../../lib/redirects'
import type { EndpointModule } from '../types'
import { itemJsonPath } from './itemJson'

/** Each `from → to` pair, in output order. */
export function redirectRules(): Array<{ from: string; to: string }> {
  const rules = [...FIXED_MOVES]
  for (const schema of getEntitySchemas()) {
    for (const { slug, host, pattern } of formerSlugsIn(schema.id)) {
      const page = srdPatternHref(host, pattern)
      // The page as it was published (the `/schema/…/item/` grammar) and as the
      // current grammar spells it, each in one hop rather than through the
      // Worker's legacy 301 and then this one.
      for (const oldPage of [legacyItemHref(schema.id, slug), itemHref(schema.id, slug)]) {
        rules.push({ from: oldPage, to: page }, { from: oldPage.slice(0, -1), to: page })
      }
      // Its unfurl image, which Discord embeds and link previews still fetch:
      // the Worker's legacy 301 would land it on a slug with no image.
      const patternImage = `${page.slice(0, -1)}.og.png`
      for (const oldImage of [
        `${legacyItemHref(schema.id, slug).slice(0, -1)}.og.png`,
        ogImagePath(schema.id, slug),
      ]) {
        rules.push({ from: oldImage, to: patternImage })
      }
      // The item's data, under the unversioned grammar and under v1.
      const hostSlug = getReferenceEntityData(host).slug
      rules.push(
        { from: itemJsonPath(schema.id, slug), to: itemJsonPath(schema.id, hostSlug) },
        { from: apiV1ItemPath(schema.id, slug), to: apiV1ItemPath(schema.id, hostSlug) }
      )
    }
  }
  rules.push(...actionMoves())
  return rules
}

/** Each action's old page → the page of the one entity that lists it. */
export function actionMoves(): Array<{ from: string; to: string }> {
  const hosts = new Map<string, Set<string>>()
  for (const schema of getEntitySchemas()) {
    for (const entity of getModel(schema.id)?.all() ?? []) {
      if (!('id' in entity) || !entity.id) continue
      const page = itemHref(schema.id, getReferenceEntityData(entity).slug)
      for (const name of actionNamesIn(entity)) {
        const pages = hosts.get(name) ?? new Set<string>()
        pages.add(page)
        hosts.set(name, pages)
      }
    }
  }
  const bySlug = new Map<string, string | null>()
  for (const action of getModel('actions')?.all() ?? []) {
    const pages = hosts.get(action.name)
    const slug = nameToSlug(action.name)
    // Two actions whose names slug alike share an old page: neither owns it.
    const page = pages?.size === 1 && !bySlug.has(slug) ? [...pages][0] : null
    bySlug.set(slug, page ?? null)
  }
  return [...bySlug]
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([slug, to]) => ({ from: `/actions/${slug}/`, to }))
}

/** The names in every `actions` list of a record, its patterns' and modules' included. */
function actionNamesIn(value: unknown, names = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) actionNamesIn(item, names)
  } else if (typeof value === 'object' && value !== null) {
    for (const [key, field] of Object.entries(value)) {
      if (key === 'actions' && Array.isArray(field)) {
        for (const name of field) if (typeof name === 'string') names.add(name)
      }
      actionNamesIn(field, names)
    }
  }
  return names
}

function body(): string {
  const lines = redirectRules().map(({ from, to }) => `${from}  ${to}  301`)
  return `# Generated by src/reference/endpoints/redirects.ts — edit there, not in dist.\n${lines.join('\n')}\n`
}

export const redirectsEndpoint: EndpointModule = {
  pattern: '_redirects',
  contentType: 'text/plain; charset=utf-8',
  body,
}
