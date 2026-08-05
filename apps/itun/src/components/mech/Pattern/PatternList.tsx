/**
 * PatternList — lists all saved MechPatterns via the patternStore.
 *
 * Each pattern row shows its name, chassisRef, and slot counts, along with an
 * InstantiateFromPattern button.
 *
 * Data fetching: subscribes to usePatternStore (audit item 22) — patterns get
 * the same lazy hydration, cross-tab broadcast, and backup-nudge discipline
 * as every other collection (they previously bypassed the store layer with a
 * one-shot db read into local state).
 *
 * onInstantiated is forwarded from the route so navigation can happen at the
 * route boundary.
 */

import { Badge, EmptyState } from 'component-lib'
import { usePatternStore } from '../../../stores/patternStore'
import { InstantiateFromPattern } from './InstantiateFromPattern'

type PatternListProps = {
  /** Called with the new mech id when a pattern is instantiated. */
  onInstantiated: (mechId: string) => void
}

export function PatternList({ onInstantiated }: PatternListProps) {
  // Subscribing keeps the list live — saves from this tab (or another tab,
  // via broadcast) appear without a refetch. list() lazily hydrates.
  const patterns = usePatternStore((s) => s.mechPatterns)
  const isLoading = !usePatternStore((s) => s.hydrated)
  usePatternStore.getState().list()

  function handleInstantiated(mechId: string) {
    onInstantiated(mechId)
  }

  if (isLoading) {
    return (
      <p className="text-sm text-wk-muted" aria-live="polite">
        Loading patterns…
      </p>
    )
  }

  if (patterns.length === 0) {
    return (
      <EmptyState
        headline="No Patterns Yet"
        body="Use “Save as pattern” from the mech builder to save a reusable template."
      />
    )
  }

  return (
    <ul
      className="grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3"
      aria-label="Saved mech patterns"
    >
      {patterns.map((pattern) => (
        <li
          key={pattern.id}
          className="rounded-card border-chrome border-ink p-4 flex items-start justify-between gap-4"
          data-testid="pattern-list-item"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="truncate font-cond text-sm font-bold uppercase text-ink">
              {pattern.name}
            </span>
            <span className="text-xs text-wk-muted">
              Chassis: {pattern.chassisRef} &mdash; {pattern.systems.length} system
              {pattern.systems.length !== 1 ? 's' : ''}, {pattern.modules.length} module
              {pattern.modules.length !== 1 ? 's' : ''}, {pattern.cargoLots.length} cargo
            </span>
            {/* Saved patterns carry no stored `legalStarting` data tag (and
                the flag is NEVER computed — project data convention), so the
                Blank-family caveat badges every card. Presentation only
                (wizard-refresh plan §5.2 / Phase 4 D). */}
            <Badge surface="outline" className="w-fit">
              Not a legal starting mech
            </Badge>
          </div>
          <InstantiateFromPattern pattern={pattern} onSuccess={handleInstantiated} />
        </li>
      ))}
    </ul>
  )
}
