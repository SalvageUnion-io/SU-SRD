/**
 * GlobalSearch — app-wide reference search (design-review P-2).
 *
 * The combobox logic (debounce, category+entity blending, keyboard
 * selection, ARIA wiring) lives in suref-react's useSearchCombobox — shared
 * with suref-web's SearchIsland (audit item 11). This shell owns what's
 * ITUN-specific:
 * - The dropdown-under-input becomes a ModalShell dialog (the Phase-1 dialog
 *   standard) opened by Cmd/Ctrl+K or the AppHeader trigger.
 * - Selecting an entity opens ITUN's canonical detail affordance —
 *   suref-react's useDetailModal — instead of navigating to an SRD page.
 * - Category rows (schema matches) have no in-app destination, so they open
 *   the SRD site's schema index in a new tab.
 * - ITUN's whole tree renders behind GameDataReady (root layout), so
 *   search() is always safe here (ready defaults to true).
 *
 * Mounted once from the root layout so the shortcut works on every surface —
 * including live sheets and snapshots, where AppHeader (the visible trigger)
 * is suppressed.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { ModalShell, useDetailModal, useSearchCombobox } from 'suref-react'
import type { SearchComboboxResult } from 'suref-react'

import { deepLinkToSchema } from '../../lib/suref-web-deep-link'

type GlobalSearchProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [detailEntity, setDetailEntity] = useState<SURefEntity | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)

  // ITUN's canonical entity detail affordance. Rendered as a sibling of the
  // search dialog so it survives the search dialog closing.
  const { control: detailControl, modal: detailModal } = useDetailModal(detailEntity)

  const pick = useCallback(
    (result: SearchComboboxResult) => {
      if (result.kind === 'schema') {
        // No in-app schema listing — open the SRD category page in a new tab.
        window.open(deepLinkToSchema(result.schemaId), '_blank', 'noopener,noreferrer')
        return
      }
      onOpenChange(false)
      setDetailEntity(result.entity as SURefEntity)
      detailControl.onClick()
    },
    [onOpenChange, detailControl]
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

  // Cmd+K / Ctrl+K toggles the search dialog from any surface (Escape and
  // backdrop dismissal are handled by the dialog itself).
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [open, onOpenChange])

  return (
    <>
      <ModalShell
        open={open}
        onOpenChange={onOpenChange}
        title="Search the SRD"
        description="Search Salvage Union reference entities and categories"
        headerBg="bg-su-orange"
        maxWidth="max-w-xl"
        align="top"
        initialFocus={inputRef}
      >
        <div className="flex flex-col gap-3 bg-paper p-4">
          <div className="sr-only" aria-live="polite">
            {announcement}
          </div>

          <input
            ref={inputRef}
            type="text"
            name="reference-search"
            placeholder="Search chassis, equipment, abilities…"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            onKeyDown={handleKeyDown}
            {...inputProps}
            aria-label="Search the SRD"
            role="combobox"
            aria-expanded={hasSearched && results.length > 0}
            aria-controls={listboxId}
            className="w-full rounded-[3px] border-chrome border-ink bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-wk-muted focus:outline-2 focus:outline-offset-2 focus:outline-rust"
          />

          {hasSearched &&
            (results.length > 0 ? (
              <div
                id={listboxId}
                role="listbox"
                aria-label="Search results"
                className="flex max-h-80 flex-col gap-1 overflow-y-auto"
              >
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    id={optionId(index)}
                    type="button"
                    role="option"
                    aria-selected={index === selectedIndex}
                    onClick={() => submit(result)}
                    className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-[3px] border-chrome px-3 py-2 text-left transition-colors ${
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
              <p className="font-body text-sm text-wk-muted">No results found</p>
            ))}

          <p className="font-body text-xs text-wk-muted">
            &#8593;&#8595; to navigate &middot; Enter to open &middot; Esc to close &middot;
            category rows open the SRD site in a new tab
          </p>
        </div>
      </ModalShell>

      {detailModal}
    </>
  )
}
