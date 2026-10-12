import type { SearchComboboxResult } from 'component-lib'
import { Entity, SearchField, useSearchCombobox } from 'component-lib'
import { borderWidth, color, fontSize, radius, space, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getEntitySlug } from 'salvageunion-reference'
import { itemHref, schemaHref } from '../../lib/entityHref'
import { LIFT_SHADOW } from '../../lib/liftShadow'
import { searchCompactIndex } from '../../lib/searchCompactIndex'
import { useSearchIndex } from '../../lib/useSearchIndex'
import { HERO_SEARCH_PLACEHOLDER, HeroSearchForm } from '../HeroSearch'
import { IslandErrorBoundary } from './IslandErrorBoundary'

type SearchIslandProps = {
  /** Injectable navigation function — defaults to window.location.assign.
   *  Override in tests to spy on navigation without happy-dom limitations. */
  navigate?: (url: string) => void
  /**
   * `bar` (default) — the Union bar's compact field. `hero` — the home page's
   * wide field and Search button on the Contents band (board 06), over the
   * same `HeroSearchForm` the page server-renders.
   */
  variant?: 'bar' | 'hero'
}

/** The results column: Rows in link mode. */
const RESULTS: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
  padding: `${space[12]} ${space[8]} ${space[8]}`,
}

/** The dropdown, hung under the field: full width in the hero, 20rem in the bar. */
const LISTBOX = {
  backgroundColor: color.paper,
  borderColor: color.wkFaint,
  borderRadius: radius.panel,
  borderStyle: 'solid',
  borderWidth: borderWidth.hairline,
  boxShadow: LIFT_SHADOW,
  marginTop: space[4],
  maxHeight: '24rem',
  overflowY: 'auto',
  position: 'absolute',
  top: '100%',
  zIndex: 50,
} satisfies CSSProperties

const LISTBOX_HERO = { ...LISTBOX, left: 0, width: '100%' } satisfies CSSProperties

const LISTBOX_BAR = { ...LISTBOX, right: 0, width: '20rem' } satisfies CSSProperties

const SMALL = { fontSize: fontSize.sm, lineHeight: 'calc(1.25 / 0.875)' } satisfies CSSProperties

/** The loading and empty states. */
const STATUS = {
  ...SMALL,
  color: color.wkMuted,
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties

/** A category result; its hover ground is `.srd-search__category` (pages.css). */
const CATEGORY = {
  ...SMALL,
  display: 'block',
  paddingBlock: space[12],
  paddingInline: space[16],
} satisfies CSSProperties

const CATEGORY_TITLE = { color: color.ink, fontWeight: weight.medium } satisfies CSSProperties

const CATEGORY_GROUP = {
  color: color.wkMuted,
  fontSize: fontSize.xs,
  lineHeight: 'calc(1 / 0.75)',
  marginTop: space[2],
} satisfies CSSProperties

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
      // Enter with no highlighted row → the full results page (uncapped), rather
      // than jumping to the first dropdown hit. Arrow-selected Enter still opens
      // that specific result (handled by the shared hook below).
      if (e.key === 'Enter' && selectedIndex < 0) {
        e.preventDefault()
        const term = query.trim()
        if (term) doNavigate(`/search?q=${encodeURIComponent(term)}`)
        return
      }
      handleKeyDown(e)
    },
    [isOpen, results, handleKeyDown, selectedIndex, query, doNavigate]
  )

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

  // Search container — .srd-search treatment via the shared SearchField. The
  // inner input keeps focus:outline-none, so the container carries the
  // visible keyboard-focus indicator via focus-within (WCAG 2.4.7).
  const field = (
    <SearchField
      ref={inputRef}
      type="text"
      // The hero's field shares the server field's name (`HeroSearchStatic`),
      // so the mounter carries what a reader typed there, with focus and
      // caret, onto this one (`mountIsland`).
      name={hero ? 'q' : 'srd-search'}
      placeholder={hero ? HERO_SEARCH_PLACEHOLDER : 'Search the SRD'}
      shortcut="⌘K"
      value={query}
      onChange={(e) => onInput(e.target.value)}
      onKeyDown={onKeyDown}
      onFocus={() => {
        load()
        setDismissedResults(null)
      }}
      // The bar's width is the Union bar's (ITUN's trigger shares it), a class
      // so the mobile sheet can widen it.
      className={hero ? undefined : 'su-union-bar__search-input'}
      containerClassName={hero ? 'srd-hero-search__field' : undefined}
      glyphSize={hero ? 18 : undefined}
      {...inputProps}
      aria-label="Search the SRD"
      role="combobox"
      aria-expanded={isOpen}
      aria-controls={listboxId}
    />
  )

  const listbox = isOpen && (
    <div id={listboxId} role="listbox" style={hero ? LISTBOX_HERO : LISTBOX_BAR}>
      {!ready ? (
        <div style={STATUS}>Loading search index…</div>
      ) : results.length > 0 ? (
        // SEARCH (entity display language §7): every entity result is a Row
        // in link mode, without the lead (E11); a category is a plain link.
        <div style={RESULTS}>
          {results.map((result, index) => {
            const option = {
              id: optionId(index),
              role: 'option',
              'aria-selected': index === selectedIndex,
            } as const
            const model = result.kind === 'entity' ? models.get(result.id) : undefined
            return model ? (
              <Entity
                key={result.id}
                form="row"
                model={model}
                mode={{ kind: 'link', href: resultUrl(result), attrs: option }}
              />
            ) : (
              <a
                key={result.id}
                {...option}
                href={resultUrl(result)}
                className="srd-search__category"
                style={CATEGORY}
              >
                <div style={CATEGORY_TITLE}>{result.title}</div>
                <div style={CATEGORY_GROUP}>{result.group}</div>
              </a>
            )
          })}
        </div>
      ) : (
        <div style={STATUS}>No results found</div>
      )}
    </div>
  )

  if (hero) {
    // The form's own submit — Enter with the listbox closed, or the Search
    // button — opens the full results page, as Enter does in the bar.
    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const term = query.trim()
      if (term) doNavigate(`/search?q=${encodeURIComponent(term)}`)
      else inputRef.current?.focus()
    }
    return (
      <IslandErrorBoundary>
        <HeroSearchForm onSubmit={onSubmit}>
          <div className="srd-hero-search__box" ref={containerRef}>
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
