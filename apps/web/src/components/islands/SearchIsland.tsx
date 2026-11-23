/**
 * The site's one search: the reference pages hydrate it as an island (the
 * Union bar's field, the 404's hero), and the app renders the same
 * component in its bar. One engine, the build-time compact index
 * (`/search-index.json`, `searchCompactIndex`); one panel, hung under the
 * field; Cmd/Ctrl+K focuses it. Every result is a reference page, followed in
 * the same tab. Enter with no row highlighted, the list's "See all N results"
 * or the hero's Search opens the page of every result (`/search/?q=`,
 * `SearchResultsIsland`, r5 E3); a list of one result opens it (r8 G2).
 *
 * The hero, and the bar on the Reference page, open on the address's `?q=`: the
 * retired search page's address lands on the Reference page with it
 * (`retiredSitePage`, `lib/redirects.ts`), as does the 404 hero's
 * no-JavaScript form, and the island mounts at once for it (`mountNow.ts`).
 */
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEntitySlug, suggestSearchQuery } from 'salvageunion-reference'
import { layer, space } from '../../design/tokens'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { HERO_SEARCH_PLACEHOLDER } from '../../lib/heroSearch'
import { aboveFloor, searchCompactIndex } from '../../lib/searchCompactIndex'
import {
  markAtContent,
  RESULTS_PAGE,
  resultsHref,
  SEARCH_PAGE,
  searchQuery,
} from '../../lib/searchHref'
import { isSearchShortcut } from '../../lib/searchShortcut'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { islandsCopy } from '../../messages/components-islands'
import { clientSwap } from '../../runtime/clientSwap'
import { InlineRef } from '../atoms/InlineRef'
import { POPUP_SURFACE } from '../atoms/popupSurface'
import { SearchListbox } from '../compositions/SearchListbox'
import { HeroSearchForm } from '../HeroSearch'
import type { SearchComboboxResult } from '../index'
import { SearchField, useModKeyHint, useSearchCombobox } from '../index'
import { DocumentLinks } from './DocumentLinks'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type SearchIslandProps = {
  /** Injectable navigation function — defaults to window.location.assign.
   *  Override in tests to spy on navigation without happy-dom limitations. */
  navigate?: (url: string) => void
  /**
   * `bar` (default) — the Union bar's compact field. `hero` — the 404's wide
   * field and Search button on its band, over the
   * same `HeroSearchForm` the page server-renders.
   */
  variant?: 'bar' | 'hero'
}

/**
 * The dropdown, hung under the field: full width in the hero; in the bar as
 * wide as a name with its kind beside it needs (a 20rem list wrapped
 * "Chimerium Salvaging Tools" over three lines), never past the screen.
 */
const LISTBOX = {
  ...POPUP_SURFACE.paper,
  marginTop: space[4],
  // Room for its first rows, a thumb's height each (ten, then "Show more"):
  // at 24rem a phone hid the tenth under a scroll with no cue (RR2-17). It
  // scrolls where the screen is shorter than its rows, or the list lengthened.
  maxHeight: 'min(33rem, calc(100dvh - 7rem))',
  overflowY: 'auto',
  position: 'absolute',
  top: '100%',
  zIndex: layer.overlay,
} satisfies CSSProperties

const LISTBOX_HERO = { ...LISTBOX, left: 0, width: '100%' } satisfies CSSProperties

const LISTBOX_BAR = {
  ...LISTBOX,
  minWidth: '100%',
  right: 0,
  // A reading width, never wider than the screen less its gutters.
  maxWidth: '92vw',
  width: '34rem',
} satisfies CSSProperties

const RELATIVE = { position: 'relative' } satisfies CSSProperties

/** An empty result's next step, under its line. */
const NEXT = { margin: 0 } satisfies CSSProperties

/** Where an empty result leads when nothing is close: the book's Contents, and its rules. */
const LISTINGS_HREF = '/reference/'
const RULES_HREF = '/rules/'

/** Site URL for a combobox result: category listing or entity item page. */
function resultUrl(result: SearchComboboxResult): string {
  if (result.kind === 'schema') return schemaHref(result.schemaId)
  // "See all N results": the page of every result (r8 G2).
  if (result.kind === 'more') return resultsHref(result.query)
  return result.page?.href ?? itemHref(result.schemaId, getEntitySlug(result.entity))
}

/**
 * A result followed from the list: its page opens at its top, the next Tab
 * in its content (`markAtContent`, r8 G3). The page of every result is not one.
 */
function markFollowed(event: React.MouseEvent): void {
  const href = (event.target as Element).closest?.('a[href]')?.getAttribute('href')
  if (href && !href.startsWith(RESULTS_PAGE)) markAtContent(href)
}

export function SearchIsland({ navigate, variant = 'bar' }: SearchIslandProps = {}) {
  const hero = variant === 'hero'
  // Deferred: the compact search index doesn't download until first user
  // intent (focusing the input or typing) — keeps it off every page's
  // critical path. Unlike the reference-entity islands, search never
  // preloads the ORM at all — it matches against a small build-time index.
  const { ready, index, load } = useSearchIndex({ defer: true })
  // Each entity result is drawn from the index's slim model (no corpus).
  const models = useMemo(() => new Map(index.map((entry) => [entry.id, entry.model])), [index])
  // The dropdown answers: what only mentions the query is left out once a result names it.
  const searchFn = useMemo(
    () => (options: Parameters<typeof searchCompactIndex>[1]) =>
      aboveFloor(searchCompactIndex(index, options)),
    [index]
  )
  // The page of every result lists every match: "See all" says how many it holds.
  const countAll = useCallback(
    (query: string) => searchCompactIndex(index, { query }).length,
    [index]
  )
  // Dropdown-open is DERIVED: open while a search has run, unless the user
  // dismissed THIS results set (Escape/outside click). A new search run
  // produces a fresh results reference, which re-opens automatically —
  // mirroring the pre-hook behavior without a setState-in-effect.
  const [dismissedResults, setDismissedResults] = useState<unknown>(null)
  // The results page's bar holds its query shut until the field is reached (RR6-02).
  const [quiet, setQuiet] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const doNavigate = useCallback(
    (url: string) => {
      if (navigate) {
        navigate(url)
      } else {
        window.location.assign(url)
      }
    },
    [navigate]
  )

  const {
    query,
    results,
    hasSearched,
    selectedIndex,
    handleInput,
    handleKeyDown,
    listboxId,
    optionId,
    inputProps,
    announcement,
    clear,
  } = useSearchCombobox({
    ready,
    countAll,
    onSubmit: (result) => {
      markAtContent(resultUrl(result))
      doNavigate(resultUrl(result))
    },
    // Enter with no row highlighted, or "See all": the page of every result.
    onSubmitQuery: (term) => doNavigate(resultsHref(term)),
    searchFn,
  })

  const onInput = useCallback(
    (value: string) => {
      load()
      handleInput(value)
    },
    [load, handleInput]
  )

  const isOpen = hasSearched && !quiet && dismissedResults !== results

  // An empty result's next step: the query with its slipped words put right,
  // where that finds something ("Did you mean").
  const names = useMemo(() => index.map((entry) => entry.name), [index])
  const empty = ready && hasSearched && results.length === 0
  const suggestion = useMemo(() => {
    if (!empty) return null
    const guess = suggestSearchQuery(query, names)
    return guess && searchFn({ query: guess, limit: 1 }).length > 0 ? guess : null
  }, [empty, query, names, searchFn])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape ends the lookup: the list closes and the field empties, so the
      // next one starts clean, and the focus stays in it to type it (RR7-08).
      if (e.key === 'Escape' && (isOpen || query)) {
        clear()
        return
      }
      if (!isOpen) return
      // Arrows move the highlight; Enter opens it, or the page of every result.
      handleKeyDown(e)
    },
    [isOpen, query, clear, handleKeyDown]
  )

  // The hero, and the bar on the Reference page, open on the address's query
  // (`/reference/?q=mule`), once, as if typed.
  // The bar on the results page holds what was searched for, its list shut
  // and the focus where it was, to refine it (RR6-02).
  const prefilled = useRef(false)
  useEffect(() => {
    const onResults = !hero && window.location.pathname === RESULTS_PAGE
    if (prefilled.current || !(hero || onResults || window.location.pathname === SEARCH_PAGE))
      return
    prefilled.current = true
    const term = searchQuery(window.location.search)
    if (!term) return
    load()
    handleInput(term)
    if (onResults) setQuiet(true)
    else inputRef.current?.focus()
  }, [hero, load, handleInput])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        e.target instanceof Node &&
        !containerRef.current.contains(e.target)
      ) {
        setDismissedResults(results)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [results])

  // Cmd+K / Ctrl+K, or "/" outside a field, to focus search with what it
  // holds selected: typing replaces the last lookup.
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (!isSearchShortcut(e)) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const live = (
    <div className="su-sr-only" aria-live="polite">
      {/* The results page's held query says nothing: that page says its own count (RR8-15). */}
      {quiet ? null : announcement}
    </div>
  )

  // Search container — the header's compact look, via the shared SearchField. The
  // inner input keeps focus:outline-none, so the container carries the
  // visible keyboard-focus indicator via focus-within (WCAG 2.4.7).
  const shortcut = useModKeyHint()
  const field = (
    <SearchField
      ref={inputRef}
      type="text"
      // The hero's field shares the server field's name (`HeroSearchStatic`),
      // so the swap carries what a reader typed there, with focus and
      // caret, onto this one (`clientSwap`).
      name={hero ? 'q' : 'srd-search'}
      placeholder={hero ? HERO_SEARCH_PLACEHOLDER : islandsCopy('searchTheReference')}
      shortcut={shortcut}
      value={query}
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => {
        load()
        setDismissedResults(null)
        setQuiet(false)
      }}
      // The bar's width is the Union bar's (The app's trigger shares it), a class
      // so the mobile sheet can widen it.
      className={hero ? undefined : 'su-union-bar__search-input'}
      containerClassName={hero ? 'su-hero-search__field' : undefined}
      glyph={hero ? 'full' : undefined}
      {...inputProps}
      aria-label={islandsCopy('searchTheReference')}
      role="combobox"
      aria-expanded={isOpen}
      // Only while the list is there to point at.
      aria-controls={isOpen ? listboxId : undefined}
    />
  )

  // HEADER SEARCH (entity display language, "Which form, where"): every
  // entity result is a Mini in link mode, one a line; a category is a plain
  // link.
  const listbox = isOpen && (
    <DocumentLinks>
      <SearchListbox
        id={listboxId}
        size="mini"
        ready={ready}
        results={results}
        selectedIndex={selectedIndex}
        optionId={optionId}
        modelOf={(result) => models.get(result.id)}
        target={{ href: resultUrl }}
        style={hero ? LISTBOX_HERO : LISTBOX_BAR}
        none={
          suggestion ? (
            <p style={NEXT}>
              {islandsCopy('didYouMean')}{' '}
              <InlineRef onOpen={() => onInput(suggestion)}>{suggestion}</InlineRef>?
            </p>
          ) : (
            // Nothing close: the ways on are the book's Contents and its rules.
            <p style={NEXT}>
              {islandsCopy('searchNoneBrowse')}{' '}
              <InlineRef href={LISTINGS_HREF}>{islandsCopy('searchNoneListings')}</InlineRef>{' '}
              {islandsCopy('searchNoneOr')}{' '}
              <InlineRef href={RULES_HREF}>{islandsCopy('searchNoneRules')}</InlineRef>.
            </p>
          )
        }
      />
    </DocumentLinks>
  )

  if (hero) {
    // The form's own submit — Enter with the listbox closed, or the Search
    // button — opens the page of every result, as Enter does in the bar;
    // with none found, the field takes focus and its panel says so.
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const term = query.trim()
      if (term && !empty) {
        doNavigate(resultsHref(term))
        return
      }
      // Nothing found, something close: Search takes the offer.
      if (suggestion) onInput(suggestion)
      setDismissedResults(null)
      inputRef.current?.focus()
    }
    return (
      <IslandErrorBoundary>
        <HeroSearchForm onSubmit={onSubmit}>
          <div className="su-hero-search__box" ref={containerRef} onClickCapture={markFollowed}>
            {live}
            {field}
            {listbox}
          </div>
        </HeroSearchForm>
      </IslandErrorBoundary>
    )
  }

  return (
    <IslandErrorBoundary>
      <div style={RELATIVE} ref={containerRef} onClickCapture={markFollowed}>
        {live}
        {field}
        {listbox}
      </div>
    </IslandErrorBoundary>
  )
}

/** The island as Astro hydrates it: `SearchIsland` swapped in over its stand-in (`clientSwap`). */
export const SearchIslandClient = clientSwap('SearchIsland', SearchIsland)
