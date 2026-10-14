/**
 * Build-time page-reference index: for each Workshop Manual page an entity's
 * rules text cites ("see p. 249"), the entities printed on that page. The card
 * resolves each reference against it (component-lib `resolvePageRef`) and
 * draws the ones that resolve as links to the page that covers them.
 *
 * Built here, from the full dataset the build preloads, and handed to the
 * island as a prop holding only the pages this entity cites — so the browser
 * resolves a reference without loading another schema.
 */
import type { PageRefCandidate, PageRefIndex } from 'component-lib'
import { findPageRefs } from 'component-lib'
import type { SURefEntity } from 'salvageunion-reference'
import { getEntitySlug, isSchemaName } from 'salvageunion-reference'
import { getEntitySchemas, SalvageUnionReference } from './gameData'

/** The book the rules text's page numbers are in. */
const WORKSHOP_MANUAL = 'Salvage Union Workshop Manual'

let byPage: Map<number, PageRefCandidate[]> | undefined

/** Every entity with a Workshop Manual page, by that page (built once). */
function workshopManualPages(): Map<number, PageRefCandidate[]> {
  if (byPage) return byPage
  byPage = new Map()
  for (const schema of getEntitySchemas()) {
    const schemaName = schema.id
    if (!isSchemaName(schemaName)) continue
    const noun = (schema.displayName || schemaName).toLowerCase()
    for (const entity of SalvageUnionReference.findAllIn(schemaName, () => true)) {
      if (!('id' in entity) || !entity.id) continue
      if (!('source' in entity) || entity.source !== WORKSHOP_MANUAL) continue
      if (!('page' in entity) || typeof entity.page !== 'number') continue
      const candidate: PageRefCandidate = {
        ref: { schemaName, id: entity.id, slug: getEntitySlug(entity), name: entity.name },
        noun,
        ...(schemaName === 'guides' ? { guide: true } : {}),
      }
      const list = byPage.get(entity.page) ?? []
      list.push(candidate)
      byPage.set(entity.page, list)
    }
  }
  return byPage
}

/**
 * The index for the pages `item`'s text cites, less `item` itself, or
 * `undefined` when it cites none.
 */
export function pageRefIndexFor(item: SURefEntity): PageRefIndex | undefined {
  const pages = new Set(findPageRefs(JSON.stringify(item)).map((m) => m.page))
  if (pages.size === 0) return undefined
  const all = workshopManualPages()
  const index: PageRefIndex = {}
  for (const page of pages) {
    const candidates = (all.get(page) ?? []).filter((c) => c.ref.id !== item.id)
    if (candidates.length > 0) index[page] = candidates
  }
  return Object.keys(index).length > 0 ? index : undefined
}

/**
 * The page references a show page links: none in a guide's prose, whose "see
 * p. 212" pointers stay plain text, as every guide's other pointers are (a
 * guide cites the book; it does not send the reader across the site
 * mid-procedure). Any other entity's resolve through `pageRefIndexFor`.
 */
export function pageRefsFor(schemaId: string, item: SURefEntity): PageRefIndex | undefined {
  return schemaId === 'guides' ? undefined : pageRefIndexFor(item)
}
