/**
 * GlobalSearch — ITUN's reference search: the SRD's content, searched from a
 * floating button in the bottom-right corner of every route (design-review
 * P-2).
 *
 * It used to be a header trigger opening a modal dialog. The masthead now
 * keeps only navigation and the account; search lives in component-lib's
 * `Fab`, which expands into a panel anchored at the button. (The SRD site keeps
 * its own top-of-page search, `SearchIsland`; this is ITUN's only.)
 *
 * The combobox logic (debounce, category+entity blending, keyboard
 * selection, ARIA wiring) lives in component-lib's useSearchCombobox — shared
 * with srd's SearchIsland (audit item 11). This shell owns what's
 * ITUN-specific:
 *
 * - **Results grow upward.** The input sits at the panel's bottom edge, beside
 *   the button, and the results stack ABOVE it with the best match nearest
 *   the input — so they are in DOM order bottom-up, and the arrow keys follow
 *   the screen: ↑ moves away from the input, ↓ back toward it (onto the input
 *   again past the nearest row).
 * - **Opening a result.** An entity opens ITUN's canonical detail affordance —
 *   component-lib's useDetailModal — and the panel collapses. Category rows
 *   (schema matches) have no in-app destination, so they open the SRD site's
 *   schema index in a new tab and leave the panel open.
 * - **Cmd/Ctrl+K** toggles the panel from anywhere and focuses the input.
 *   Escape or a press outside collapses it, focus back on the button (the
 *   `Fab`'s contract).
 * - **Where the button hides.** `fabHidden` — the root passes
 *   `fabCollides(pathname)` (`lib/searchFab.ts`), which names the routes whose
 *   own bottom-right corner it would cover. The shortcut still works there.
 * - ITUN's whole tree renders behind GameDataReady (root layout), so
 *   search() is always safe here (ready defaults to true).
 *
 * Mounted once from the root layout, inside the game-data gate.
 */

import type { SearchComboboxResult } from 'component-lib'
import {
  EmptyState,
  Fab,
  SearchField,
  tokens,
  useDetailModal,
  useSearchCombobox,
} from 'component-lib'
import { Search } from 'lucide-react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { deepLinkToSchema } from '../../lib/srd-deep-link'

/** The button's name, the panel's and the input's: one thing, one name. */
const LABEL = 'Search the rules'

const BODY = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  padding: tokens.space[12],
} satisfies CSSProperties

const HINT = {
  color: tokens.color.wkMuted,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.xs,
  margin: 0,
} satisfies CSSProperties

const LISTBOX = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[4],
  // Room for the whole result budget on a laptop; on a short screen the list
  // scrolls inside the panel rather than pushing it off the top.
  maxHeight: 'min(20rem, 50dvh)',
  overflowY: 'auto',
} satisfies CSSProperties

type GlobalSearchProps = {
  /** Hide the collapsed button on this route; Cmd/Ctrl+K still opens the panel. */
  fabHidden?: boolean
}

export function GlobalSearch({ fabHidden = false }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [detailEntity, setDetailEntity] = useState<SURefEntity | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // ITUN's canonical entity detail affordance. Rendered as a sibling of the
  // panel so it survives the panel collapsing.
  const { control: detailControl, modal: detailModal } = useDetailModal(detailEntity)

  const pick = useCallback(
    (result: SearchComboboxResult) => {
      if (result.kind === 'schema') {
        // No in-app schema listing — open the SRD category page in a new tab.
        window.open(deepLinkToSchema(result.schemaId), '_blank', 'noopener,noreferrer')
        return
      }
      setOpen(false)
      setDetailEntity(result.entity)
      detailControl.onClick?.()
    },
    [detailControl]
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
  } = useSearchCombobox({ onSubmit: pick })

  // Cmd+K / Ctrl+K toggles the panel from any surface (Escape and an outside
  // press are the Fab's).
  useEffect(() => {
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((wasOpen) => !wasOpen)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // The arrow keys follow the screen, and the screen is upside down relative to
  // the result order: the hook's "next result" is one row further UP.
  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      handleKeyDown({
        key: e.key === 'ArrowUp' ? 'ArrowDown' : 'ArrowUp',
        preventDefault: () => e.preventDefault(),
      })
      return
    }
    handleKeyDown(e)
  }

  // A fresh result set starts scrolled to its bottom — the best match, beside
  // the input — and the highlighted row is kept in view as the keys move it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run per result set, not per render
  useLayoutEffect(() => {
    const list = listRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [results])

  useEffect(() => {
    if (selectedIndex < 0) return
    document.getElementById(optionId(selectedIndex))?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex, optionId])

  // Best match LAST, so it sits directly above the input.
  const upward = results.map((result, index) => ({ result, index })).reverse()

  return (
    <>
      <Fab
        label={LABEL}
        icon={<Search size={22} aria-hidden="true" />}
        open={open}
        onOpenChange={setOpen}
        hidden={fabHidden}
        initialFocus={inputRef}
        keyShortcuts="Meta+K Control+K"
      >
        <div style={BODY}>
          <div className="sr-only" aria-live="polite">
            {announcement}
          </div>

          <p style={HINT}>
            &#8593;&#8595; to move &middot; Enter to open &middot; Esc to close &middot; category
            rows open the SRD site in a new tab
          </p>

          {hasSearched &&
            (results.length > 0 ? (
              <div
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Search results"
                style={LISTBOX}
              >
                {upward.map(({ result, index }) => (
                  <button
                    key={result.id}
                    id={optionId(index)}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => submit(result)}
                    className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-card border-chrome px-3 py-2 text-left transition-colors ${
                      index === selectedIndex
                        ? 'border-rust bg-wk-bg-2'
                        : 'border-transparent hover:bg-wk-bg-2'
                    }`}
                  >
                    <span className="min-w-0 truncate font-body text-sm font-medium text-ink">
                      {result.title}
                    </span>
                    <span className="shrink-0 font-cond text-xs font-semibold uppercase tracking-caps-snug text-wk-muted">
                      {result.group}
                      {result.kind === 'schema' && <span aria-hidden="true"> &#8599;</span>}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState variant="quiet" body="No results found" />
            ))}

          <SearchField
            ref={inputRef}
            type="text"
            name="reference-search"
            placeholder="Search chassis, equipment, abilities…"
            autoComplete="off"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={onInputKeyDown}
            {...inputProps}
            aria-label={LABEL}
            aria-expanded={hasSearched && results.length > 0}
          />
        </div>
      </Fab>

      {detailModal}
    </>
  )
}
