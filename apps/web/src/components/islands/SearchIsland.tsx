/**
 * The site's one search: the reference pages hydrate it as an island (the
 * Union bar's field, the home and 404 hero), and the app renders the same
 * component in its bar. One engine, the build-time compact index
 * (`/search-index.json`, `searchCompactIndex`); one panel, hung under the
 * field, which is the whole search (there is no results page, EDL "Which
 * form, where"); Cmd/Ctrl+K focuses it. Every result is a reference page,
 * followed in the same tab; Enter with no row highlighted opens the first.
 *
 * The hero, and the bar on the home page, open on the address's `?q=`: the
 * retired search page's address lands on the home page with it
 * (`retiredSitePage`, `lib/redirects.ts`), as does the 404 hero's
 * no-JavaScript form, and the island mounts at once for it (`mountNow.ts`).
 */
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import { layer, space } from '../../design/tokens'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { HERO_SEARCH_PLACEHOLDER } from '../../lib/heroSearch'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import { useSearchIndex } from '../../lib/useSearchIndex'
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

/** The dropdown, hung under the field: full width in the hero, 20rem in the bar. */
const LISTBOX = {
  ...POPUP_SURFACE.paper,
  marginTop: space[4],
  maxHeight: '24rem',
  overflowY: 'auto',
  position: 'absolute',
  top: '100%',
  zIndex: layer.overlay,
} satisfies CSSProperties

const LISTBOX_HERO = { ...LISTBOX, left: 0, width: '100%' } satisfies CSSProperties

const LISTBOX_BAR = { ...LISTBOX, right: 0, width: '20rem' } satisfies CSSProperties

const RELATIVE = { position: 'relative' } satisfies CSSProperties

/** Site URL for a combobox result: category listing or entity item page. */
function resultUrl(result: SearchComboboxResult): string {
  if (result.kind === 'schema') return schemaHref(result.schemaId)
  return itemHref(result.schemaId, getEntitySlug(result.entity))
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
  const searchFn = useMemo(
    () => (options: Parameters<typeof searchCompactIndex>[1]) => searchCompactIndex(index, options),
    [index]
  )
  // Dropdown-open is DERIVED: open while a search has run, unless the user
  // dismissed THIS results set (Escape/outside click). A new search run
  // produces a fresh results reference, which re-opens automatically —
  // mirroring the pre-hook behavior without a setState-in-effect.
  const [dismissedResults, setDismissedResults] = useState<unknown>(null)
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
    submit,
    listboxId,
    optionId,
    inputProps,
    announcement,
  } = useSearchCombobox({
    ready,
    onSubmit: (result) => doNavigate(resultUrl(result)),
    searchFn,
  })

  const onInput = useCallback(
    (value: string) => {
      load()
      handleInput(value)
    },
    [load, handleInput]
  )

  const isOpen = hasSearched && dismissedResults !== results

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        setDismissedResults(results)
        inputRef.current?.blur()
        return
      }
      // Arrows move the highlight; Enter opens it, or the first result.
      handleKeyDown(e)
    },
    [isOpen, results, handleKeyDown]
  )

  // The hero, and the bar on the home page, open on the address's query
  // (`/?q=mule`), once, as if typed.
  const prefilled = useRef(false)
  useEffect(() => {
    if (prefilled.current || !(hero || window.location.pathname === '/')) return
    prefilled.current = true
    const term = new URLSearchParams(window.location.search).get('q')?.trim()
    if (!term) return
    load()
    handleInput(term)
    inputRef.current?.focus()
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

  // Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  const live = (
    <div className="su-sr-only" aria-live="polite">
      {announcement}
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
      // so the mounter carries what a reader typed there, with focus and
      // caret, onto this one (`mountIsland`).
      name={hero ? 'q' : 'srd-search'}
      placeholder={hero ? HERO_SEARCH_PLACEHOLDER : 'Search the Reference'}
      shortcut={shortcut}
      value={query}
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => {
        load()
        setDismissedResults(null)
      }}
      // The bar's width is the Union bar's (The app's trigger shares it), a class
      // so the mobile sheet can widen it.
      className={hero ? undefined : 'su-union-bar__search-input'}
      containerClassName={hero ? 'su-hero-search__field' : undefined}
      glyph={hero ? 'full' : undefined}
      {...inputProps}
      aria-label="Search the Reference"
      role="combobox"
      aria-expanded={isOpen}
      aria-controls={listboxId}
    />
  )

  // HEADER SEARCH (entity display language, "Which form, where"): every
  // entity result is a Token in link mode, one a line; a category is a plain
  // link.
  const listbox = isOpen && (
    <DocumentLinks>
      <SearchListbox
        id={listboxId}
        form="token"
        ready={ready}
        results={results}
        selectedIndex={selectedIndex}
        optionId={optionId}
        modelOf={(result) => models.get(result.id)}
        target={{ href: resultUrl }}
        style={hero ? LISTBOX_HERO : LISTBOX_BAR}
      />
    </DocumentLinks>
  )

  if (hero) {
    // The form's own submit — Enter with the listbox closed, or the Search
    // button — opens the first result, as Enter does in the bar; with none,
    // the field takes focus and its panel shows what the search found.
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const first = query.trim() ? results[0] : undefined
      if (first) {
        submit(first)
        return
      }
      setDismissedResults(null)
      inputRef.current?.focus()
    }
    return (
      <IslandErrorBoundary>
        <HeroSearchForm onSubmit={onSubmit}>
          <div className="su-hero-search__box" ref={containerRef}>
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
      <div style={RELATIVE} ref={containerRef}>
        {live}
        {field}
        {listbox}
      </div>
    </IslandErrorBoundary>
  )
}
