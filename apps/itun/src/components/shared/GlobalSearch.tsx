/**
 * GlobalSearch — ITUN's reference search, in the Union bar (ruleset §3.11,
 * board 05: "Search · ⌘K", right side, before the account control). It used to
 * be a floating button in the bottom-right corner; that button covered content
 * at phone width and duplicated the bar, so it is gone.
 *
 * Two triggers, one search. `variant="bar"` is the desktop control (the bar's
 * `search` slot, shown from `lg`); `variant="icon"` is the phone's icon button
 * (the bar's mobile cluster, as the SRD's). Their `open` state is lifted to the
 * root, so they share it, and only the trigger that is on screen at the current
 * width opens the panel — a Base UI Popover, non-modal, hanging under its
 * trigger. Escape or a press outside closes it, focus back on the trigger.
 *
 * The combobox logic (debounce, category+entity blending, keyboard
 * selection, ARIA wiring) lives in component-lib's useSearchCombobox — shared
 * with srd's SearchIsland (audit item 11). This shell owns what's
 * ITUN-specific:
 *
 * - **Results hang below the input**, best match first; ↓ moves down the list.
 * - **Opening a result.** An entity opens ITUN's canonical detail affordance —
 *   component-lib's useDetailModal — and the panel collapses. Category rows
 *   (schema matches) have no in-app destination, so they open the SRD site's
 *   schema index in a new tab and leave the panel open.
 * - **Cmd/Ctrl+K** toggles the panel from anywhere and focuses the input; the
 *   `variant="bar"` instance (`shortcut`) owns the listener.
 * - **Game data.** The bar paints before the reference dataset has loaded
 *   (GameDataReady is a sibling below it), so the combobox is told when it is
 *   `ready` and holds a query typed early until it is.
 */

import { Popover } from '@base-ui/react/popover'
import type { SearchComboboxResult } from 'component-lib'
import {
  buttonVariants,
  cn,
  EmptyState,
  EntityExternalLinkProvider,
  SearchField,
  tokens,
  useDetailModal,
  useSearchCombobox,
} from 'component-lib'
import { Search } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { deepLinkToSchema } from '../../lib/srd-deep-link'
import { srdEntityExternalLink } from '../contextual/srdEntityExternalLink'
import { useGameDataLoaded } from './GameDataReady'

/** The button's name, the panel's and the input's: one thing, one name. */
const LABEL = 'Search the rules'

/** The bar shows the desktop trigger from here (`lg`, 64rem). */
const DESKTOP_QUERY = '(min-width: 64rem)'

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

const TRIGGER_BAR = {
  alignItems: 'center',
  background: 'transparent',
  borderColor: tokens.color.paper60,
  borderRadius: tokens.radius.card,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  color: tokens.color.paper,
  cursor: 'pointer',
  display: 'inline-flex',
  flexShrink: 0,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.caption,
  fontWeight: tokens.weight.bold,
  gap: tokens.space[8],
  height: 36,
  letterSpacing: tokens.tracking.capsSnug,
  paddingInline: tokens.space[12],
  textTransform: 'uppercase',
} satisfies CSSProperties

const KEY_HINT = {
  color: tokens.color.paper60,
  fontFamily: tokens.font.body,
  fontWeight: tokens.weight.medium,
  letterSpacing: 0,
} satisfies CSSProperties

const POSITIONER = { zIndex: 60 } satisfies CSSProperties

const PANEL = {
  backgroundColor: tokens.color.paper,
  borderColor: tokens.color.ink,
  borderRadius: tokens.radius.panel,
  borderStyle: 'solid',
  borderWidth: tokens.borderWidth.chrome,
  boxSizing: 'border-box',
  color: tokens.color.ink,
  maxWidth: 'calc(100vw - 2rem)',
  outline: 'none',
  width: '28rem',
} satisfies CSSProperties

function subscribeDesktop(onChange: () => void) {
  if (typeof window.matchMedia !== 'function') return () => undefined
  const query = window.matchMedia(DESKTOP_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

/** Whether the viewport is wide enough for the bar's desktop trigger. */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => typeof window.matchMedia !== 'function' || window.matchMedia(DESKTOP_QUERY).matches,
    () => true
  )
}

/** "⌘K" where there is a Command key, else "Ctrl K". */
function shortcutHint(): string {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
  return mac ? '⌘K' : 'Ctrl K'
}

type GlobalSearchProps = {
  /** `bar` — the desktop "Search · ⌘K" trigger; `icon` — the phone's icon button. */
  variant?: 'bar' | 'icon'
  /** Whether the panel is open. Lifted to the root so the two triggers share it. */
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Binds Cmd/Ctrl+K to toggle the panel. One instance owns it; the bar's by default. */
  shortcut?: boolean
}

export function GlobalSearch({
  variant = 'bar',
  open,
  onOpenChange,
  shortcut = variant === 'bar',
}: GlobalSearchProps) {
  const [detailEntity, setDetailEntity] = useState<SURefEntity | undefined>(undefined)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const desktop = useIsDesktop()
  const ready = useGameDataLoaded()
  // Only the trigger on screen at this width shows the panel.
  const shown = open && (variant === 'bar') === desktop

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
      onOpenChange(false)
      setDetailEntity(result.entity)
      detailControl.onClick?.()
    },
    [detailControl, onOpenChange]
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
  } = useSearchCombobox({ onSubmit: pick, ready })

  // Cmd+K / Ctrl+K toggles the panel from any surface (Escape and an outside
  // press are the Popover's).
  useEffect(() => {
    if (!shortcut) return
    const handleGlobalKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [shortcut, open, onOpenChange])

  // Reopening keeps the last query, a quick way back to it, but selected, so
  // typing replaces it instead of appending ("bionic" + "mech"). The Popover
  // moves focus into the panel after it opens, so the selection is made when
  // that focus lands (a later click into the field places a caret as usual).
  const selectOnFocus = useRef(false)
  useEffect(() => {
    if (!shown) return
    const field = inputRef.current
    if (field !== null && document.activeElement === field) field.select()
    else selectOnFocus.current = true
  }, [shown])

  // Keep the highlighted row in view as the keys move it.
  useEffect(() => {
    if (selectedIndex < 0) return
    document.getElementById(optionId(selectedIndex))?.scrollIntoView?.({ block: 'nearest' })
  }, [selectedIndex, optionId])

  const trigger =
    variant === 'bar' ? (
      <button
        type="button"
        aria-label={LABEL}
        aria-keyshortcuts="Meta+K Control+K"
        className="su-union-bar__search"
        style={TRIGGER_BAR}
      >
        <Search size={16} aria-hidden="true" />
        <span aria-hidden="true">Search</span>
        <span aria-hidden="true" style={KEY_HINT}>
          {shortcutHint()}
        </span>
      </button>
    ) : (
      <button
        type="button"
        aria-label={LABEL}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'iconOnly' }),
          'size-11 rounded-panel border-transparent text-paper hover:bg-paper/15'
        )}
      >
        <Search size={22} aria-hidden="true" />
      </button>
    )

  return (
    <>
      <Popover.Root open={shown} onOpenChange={(next) => onOpenChange(next)}>
        <Popover.Trigger render={trigger} />
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={16}
            style={POSITIONER}
          >
            <Popover.Popup aria-label={LABEL} style={PANEL} initialFocus={inputRef}>
              <div style={BODY}>
                <div className="sr-only" aria-live="polite">
                  {announcement}
                </div>

                <SearchField
                  ref={inputRef}
                  type="text"
                  name="reference-search"
                  placeholder="Search chassis, equipment, abilities…"
                  autoComplete="off"
                  value={query}
                  onChange={(e) => handleInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={(e) => {
                    if (!selectOnFocus.current) return
                    selectOnFocus.current = false
                    e.currentTarget.select()
                  }}
                  {...inputProps}
                  aria-label={LABEL}
                  aria-expanded={hasSearched && results.length > 0}
                />

                {hasSearched &&
                  (results.length > 0 ? (
                    <div
                      ref={listRef}
                      id={listboxId}
                      role="listbox"
                      aria-label="Search results"
                      style={LISTBOX}
                    >
                      {results.map((result, index) => (
                        <button
                          key={result.id}
                          id={optionId(index)}
                          type="button"
                          role="option"
                          aria-selected={index === selectedIndex}
                          onClick={() => submit(result)}
                          className={`flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-card border-chrome px-3 py-2 text-left transition-colors ${
                            index === selectedIndex
                              ? 'border-ink bg-wk-bg-2'
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

                <p style={HINT}>
                  &#8593;&#8595; to move &middot; Enter to open &middot; Esc to close &middot;
                  category rows open the SRD site in a new tab
                </p>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>

      {/* The bar sits outside GameDataReady, so the detail modal brings the
          cross-link provider that gate would otherwise have supplied. */}
      <EntityExternalLinkProvider value={srdEntityExternalLink}>
        {detailModal}
      </EntityExternalLinkProvider>
    </>
  )
}
