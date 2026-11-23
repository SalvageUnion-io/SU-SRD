import type { CSSProperties } from 'react'
import { useMemo } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import { space } from '../../design/tokens'
import { PROSE } from '../../lib/docPageStyles'
import { itemHref } from '../../lib/entityHref'
import { schemaPluralLabel } from '../../lib/schemaLabels'
import type { CompactSearchResult } from '../../lib/searchCompactIndex'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import { markSearchLanding, searchQuery } from '../../lib/searchHref'
import type { CompactSearchEntry } from '../../lib/searchIndexTypes'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { compositionsCopy } from '../../messages/components-compositions'
import { islandsCopy } from '../../messages/components-islands'
import { clientSwap } from '../../runtime/clientSwap'
import { InlineRef } from '../atoms/InlineRef'
import { HeroSearchStatic } from '../HeroSearch'
import type { EntityFormModel, LedgerColumn, LedgerRow } from '../index'
import { Ledger, Pending, Stat } from '../index'
import { DocumentLinks } from './DocumentLinks'
import { IslandErrorBoundary } from './IslandErrorBoundary'

/** Every match is listed up to here, as the search's own count stops (`useSearchCombobox`). */
const LIMIT = 200

/** A pattern's or a told rule's row groups under its kind, not its host's schema. */
const ROW_GROUPS: Record<string, string> = {
  Pattern: islandsCopy('patternsGroup'),
  Rule: islandsCopy('rulesGroup'),
}

/** The kind a result is grouped under: its schema's plural, or a pattern's or rule's own. */
function groupOf(result: CompactSearchResult): string {
  if (!result.pattern) return schemaPluralLabel(result.schemaName)
  const kind = result.pattern.kind.split(' · ')[0] ?? result.pattern.kind
  return ROW_GROUPS[kind] ?? kind
}

/** The results by kind, the kinds in the order their best match ranks. */
export function groupResults(
  results: readonly CompactSearchResult[]
): { kind: string; results: CompactSearchResult[] }[] {
  const groups = new Map<string, CompactSearchResult[]>()
  for (const result of results) {
    const kind = groupOf(result)
    const group = groups.get(kind)
    if (group) group.push(result)
    else groups.set(kind, [result])
  }
  return [...groups].map(([kind, rows]) => ({ kind, results: rows }))
}

/** A result's page: a pattern's or rule's own, else its schema's item page. */
function hrefOf(result: CompactSearchResult): string {
  return result.pattern?.href ?? itemHref(result.schemaName, getEntitySlug(result.entity))
}

/**
 * The dropdown's columns (`SearchListbox`): how far, how hard, what it costs,
 * and a pattern's or a rule's own kind, where the group mixes hosts.
 */
const COLUMNS: readonly LedgerColumn[] = [
  { key: 'kind', label: compositionsCopy('kind'), kind: 'text' },
  {
    key: 'rng',
    label: compositionsCopy('rng'),
    title: compositionsCopy('range'),
    kind: 'text',
    phone: true,
  },
  {
    key: 'dmg',
    label: compositionsCopy('dmg'),
    title: compositionsCopy('damage'),
    kind: 'text',
    phone: true,
  },
  { key: 'cost', label: compositionsCopy('cost'), kind: 'text' },
]

/** A fact's compact value (`Close/Medium`, `4 SP`), or nothing. */
function factOf(model: EntityFormModel, key: string): string {
  const fact = model.facts.find((entry) => entry.key === key)
  return fact ? String(fact.shortValue ?? fact.value) : ''
}

/**
 * A result as the dropdown's line (r7 E2): its name, a rules term's one-line
 * definition under it (ledger L5), its Tech Level and its reach.
 */
function rowOf(result: CompactSearchResult, model: EntityFormModel | undefined): LedgerRow {
  const href = hrefOf(result)
  if (!model) return { id: result.entityId, name: result.entityName, href, cells: [] }
  return {
    id: result.entityId,
    name: model.title,
    under: model.lead,
    entityRef: model.ref,
    href,
    stamp:
      model.techLevel != null ? (
        <Stat label={compositionsCopy('tl')} value={model.techLevel} size="mini" />
      ) : undefined,
    cells: [
      result.pattern?.kind ?? '',
      factOf(model, 'range'),
      factOf(model, 'damage'),
      model.cost ?? '',
    ],
  }
}

/** Visible to a screen reader alone: the group's name is its Ledger's tab. */
const SR_ONLY = 'su-sr-only'

const LINE = { ...PROSE, margin: 0 } satisfies CSSProperties

/** The count, then each kind's section, a page's block gap apart (the island is one block). */
const SECTIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[24],
} satisfies CSSProperties

type SearchResultsIslandProps = {
  /** The address's search string; defaults to `location.search`. Tests pass their own. */
  search?: string
}

/**
 * The search page (`/search/?q=shield`, r5 E3): every result for the query,
 * up to the search's count, grouped by kind, each kind a section with its
 * count and its results as link Compacts. It runs the same build-time index
 * as the Union bar's search (`/search-index.json`), on this page alone.
 */
export function SearchResultsIsland({ search }: SearchResultsIslandProps = {}) {
  const query = searchQuery(search ?? (typeof window === 'undefined' ? '' : window.location.search))
  const { ready, index } = useSearchIndex({ defer: !query })
  const results = useMemo(
    () => (ready && query ? searchCompactIndex(index, { query, limit: LIMIT }) : []),
    [ready, index, query]
  )
  const models = useMemo(
    () => new Map<string, CompactSearchEntry['model']>(index.map((e) => [e.id, e.model])),
    [index]
  )

  if (!query) return <p style={LINE}>{islandsCopy('searchForSomething')}</p>
  // What was searched for stays in a field of its own, to refine (RR6-02);
  // on a phone the bar's field is that one (r7 E2, `.su-search-refine`).
  const refine = (
    <div className="su-search-refine">
      <HeroSearchStatic query={query} shortcut="" />
    </div>
  )
  if (!ready)
    return (
      <div style={SECTIONS}>
        {refine}
        <Pending searching />
      </div>
    )

  if (results.length === 0) {
    return (
      <div style={SECTIONS}>
        {refine}
        <p style={LINE}>
          {islandsCopy('nothingCloseTo', { query })}. {islandsCopy('searchNoneBrowse')}{' '}
          <InlineRef href="/reference/">{islandsCopy('searchNoneListings')}</InlineRef>{' '}
          {islandsCopy('searchNoneOr')}{' '}
          <InlineRef href="/rules/">{islandsCopy('searchNoneRules')}</InlineRef>.
        </p>
      </div>
    )
  }

  const count = `${results.length}${results.length >= LIMIT ? '+' : ''}`
  return (
    <IslandErrorBoundary>
      <div style={SECTIONS}>
        {refine}
        <p style={LINE} aria-live="polite">
          {results.length === 1
            ? islandsCopy('oneResultFor', { query })
            : islandsCopy('resultsFor', { count, query })}
        </p>
        {/* A row followed opens its page with the heading in focus (RR7-09). */}
        <div
          onClickCapture={(e) => {
            if (e.target instanceof Element && e.target.closest('a[href]')) markSearchLanding()
          }}
          style={SECTIONS}
        >
          <DocumentLinks>
            {groupResults(results).map((group, i) => {
              const first = models.get(group.results[0]?.entityId ?? '')
              return (
                <section key={group.kind} aria-labelledby={`results-${i}`}>
                  <h2 id={`results-${i}`} className={SR_ONLY}>
                    {group.kind}
                  </h2>
                  <Ledger
                    label={group.kind}
                    nameLabel={group.kind}
                    tone={first?.tone ?? 'ink'}
                    count={group.results.length}
                    columns={COLUMNS}
                    rows={group.results.map((result) => rowOf(result, models.get(result.entityId)))}
                  />
                </section>
              )
            })}
          </DocumentLinks>
        </div>
      </div>
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it (`clientSwap`), over its server-rendered stand-in. */
export const SearchResultsIslandClient = clientSwap('SearchResultsIsland', SearchResultsIsland)
