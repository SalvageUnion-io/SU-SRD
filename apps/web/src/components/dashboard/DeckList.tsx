/**
 * DeckList — the Actions deck, beside the display
 * (docs/architecture/dashboard.md §2). It lists what the active
 * entity can do, filtered by timing, range and source, and opens an action in
 * the display's Resolve tab (`ResolvePanel`).
 *
 * Presentational: `useActionsDeck` builds the `DeckListModel` and this only
 * renders it and calls back. Every filter is a row of toggle buttons with
 * `aria-pressed` — the timing filter included: filtering one list is a
 * toggle, not a tab, and a `role="tablist"` would claim a keyboard model it
 * does not have.
 */

import type { CSSProperties } from 'react'
import { fontSize, radius, space } from '../../design/tokens'
import { Badge, EmptyState, Toggle, ToggleGroup } from '../index'
import type { DeckEntry } from './DeckRow'
import { DeckRow } from './DeckRow'

export type DeckListModel =
  | { kind: 'empty'; text: string }
  | {
      kind: 'list'
      tabs: readonly string[]
      activeTab: string
      onTab: (tab: string) => void
      rangeBands: readonly string[]
      activeRange: string
      onRange: (band: string) => void
      reachText: string
      sources: { label: string; stamp: string }[]
      sourceFilter: string | null
      onSourceFilter: (source: string | null) => void
      /** The whole deck, flat — one grid, no source/timing headings above it. */
      rows: DeckEntry[]
      onOpen: (key: string) => void
      /**
       * Open an action and pay for it in one press: the phone's pennant
       * (ADR-045 D6). The canvas pays from the resolve's own pennant.
       */
      onActivate: (key: string) => void
    }

/** A source toggle carries its stamp before its label. */
const SOURCE = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: space[4],
  maxWidth: '100%',
} satisfies CSSProperties

const STAMP = {
  borderRadius: radius.card,
  paddingInline: space[4],
  paddingBlock: '1px',
  fontSize: fontSize.badge,
} satisfies CSSProperties

export function DeckList({ view }: { view: DeckListModel }) {
  if (view.kind === 'empty') {
    return (
      <div className="su-dash-display-scroll">
        <EmptyState variant="quiet" body={view.text} />
      </div>
    )
  }

  return (
    <div className="su-dash-display-scroll">
      <div className="su-dash-deck-controls-bar">
        <ToggleGroup className="su-dash-deck-tabs" label="Filter actions by timing">
          {view.tabs.map((t) => (
            <Toggle key={t} pressed={view.activeTab === t} onClick={() => view.onTab(t)}>
              {t}
            </Toggle>
          ))}
        </ToggleGroup>

        <div className="su-dash-deck-toolrow">
          <ToggleGroup className="su-dash-deck-range" label="Engagement Range">
            {view.rangeBands.map((band) => (
              <Toggle
                key={band}
                pressed={view.activeRange === band}
                onClick={() => view.onRange(band)}
                aria-label={`Range ${band}`}
                title={`Set engagement range to ${band}`}
              >
                {band[0]}
              </Toggle>
            ))}
            <span className="su-dash-deck-reach">{view.reachText}</span>
          </ToggleGroup>
        </div>

        {view.sources.length > 1 && (
          <ToggleGroup className="su-dash-deck-sources" label="Filter actions by source">
            <Toggle pressed={view.sourceFilter === null} onClick={() => view.onSourceFilter(null)}>
              All
            </Toggle>
            {view.sources.map((src) => (
              <Toggle
                key={`${src.stamp}:${src.label}`}
                pressed={view.sourceFilter === src.label}
                onClick={() =>
                  view.onSourceFilter(view.sourceFilter === src.label ? null : src.label)
                }
                title={`Filter the deck to “${src.label}” actions.`}
                style={SOURCE}
              >
                <Badge shape="stamp" size="mini" style={STAMP}>
                  {src.stamp}
                </Badge>
                {src.label}
              </Toggle>
            ))}
          </ToggleGroup>
        )}
      </div>

      {view.rows.length === 0 ? (
        <EmptyState variant="quiet" body="No actions match this filter." />
      ) : (
        <div className="su-dash-deck">
          {/*
           * ONE grid over the whole deck — no source/timing headings, so an
           * action is never filed under a name of its own; the entry already
           * states what it is. Each entry is the COMPACT, header-only card
           * (`compact` + `head`, board D1): the name, the source stamp and the
           * cost pennant on one row, so a kitted pilot's deck stays a short
           * list. The full card — description, roll table, choices — is the
           * Resolve pane's, one tap on the pennant away. `<ul>/<li>` stays — a
           * set of actions IS a list semantically.
           */}
          <ul className="su-dash-deck-grid">
            {view.rows.map((row) => (
              // The cost pennant IS the deck's action (ruleset §1, board D1):
              // filled rust, in the pennant's own place, and tapping it takes
              // the action to Resolve. No separate deck button, no chevron.
              <DeckRow
                key={row.key}
                row={row}
                lock="title"
                pennant={{
                  label: 'Resolve',
                  ariaLabel: `Resolve ${row.name}`,
                  onClick: () => view.onOpen(row.key),
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
