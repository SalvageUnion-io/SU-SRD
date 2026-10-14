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

import type { ReferenceCardEntity } from 'component-lib'
import { Badge, EmptyState, ReferenceEntityCard, Toggle } from 'component-lib'
import { fontSize, radius, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'

/**
 * A render-ready action card. The action ENTITY drives a header-only
 * (`extent="head"`) `ReferenceEntityCard` row, so the deck reuses the canonical
 * action rendering instead of a hand-rolled row.
 * The card states its own name, so the deck adds no describing label above it.
 * Reach/lock is resolved by the caller and layered on top (dim + tooltip), never
 * baked into the card.
 */
export type DeckRow = {
  key: string
  /** Any card-renderable entity — ACTIONS are meta-entities, not `SURefEntity`. */
  entity: ReferenceCardEntity
  /** Accessible name for the clickable tile (the action name). */
  name: string
  locked: boolean
  lockTitle?: string
}

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
      rows: DeckRow[]
      onOpen: (key: string) => void
      /**
       * Open an action and pay for it in one press: the phone's pennant
       * (ADR-045 D6). The canvas pays from the resolve's own pennant.
       */
      onActivate: (key: string) => void
    }

/** A bare fieldset: the group, without the browser's frame around it. */
const GROUP: CSSProperties = { border: 0, margin: 0, padding: 0, minInlineSize: 0 }

/** A source toggle carries its stamp before its label. */
const SOURCE = {
  alignItems: 'center',
  display: 'inline-flex',
  gap: space[4],
  maxWidth: '100%',
} satisfies CSSProperties

const STAMP: CSSProperties = {
  borderRadius: radius.card,
  paddingInline: space[4],
  paddingBlock: '1px',
  fontSize: fontSize.badge,
}

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
        <fieldset className="su-dash-deck-tabs" style={GROUP} aria-label="Filter actions by timing">
          {view.tabs.map((t) => (
            <Toggle key={t} pressed={view.activeTab === t} onClick={() => view.onTab(t)}>
              {t}
            </Toggle>
          ))}
        </fieldset>

        <div className="su-dash-deck-toolrow">
          <fieldset className="su-dash-deck-range" style={GROUP} aria-label="Engagement Range">
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
          </fieldset>
        </div>

        {view.sources.length > 1 && (
          <fieldset
            className="su-dash-deck-sources"
            style={GROUP}
            aria-label="Filter actions by source"
          >
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
          </fieldset>
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
           * (`medium` + `head`, board D1): the name, the source stamp and the
           * cost pennant on one row, so a kitted pilot's deck stays a short
           * list. The full card — description, roll table, choices — is the
           * Resolve pane's, one tap on the pennant away. `<ul>/<li>` stays — a
           * set of actions IS a list semantically.
           */}
          <ul className="su-dash-deck-grid">
            {view.rows.map((row) => (
              // Lock (out of range / overheat) is a caller-resolved overlay,
              // layered on the canonical card — dim + tooltip — never a
              // property of the action card itself.
              <li
                key={row.key}
                className={row.locked ? 'is-locked' : undefined}
                title={row.lockTitle}
              >
                {/* The cost pennant IS the deck's action (ruleset §1, board
                    D1): filled rust, in the pennant's own place, and tapping it
                    takes the action to Resolve. There is no separate deck
                    button and no chevron beside it. */}
                <ReferenceEntityCard
                  data={row.entity}
                  size="medium"
                  extent="head"
                  // The Dashboard stays flat (ruleset §3.5): no speckle.
                  texture={false}
                  // Dimmed, still openable: the lock is a caller-resolved
                  // overlay (see above), and Resolve says why it cannot run.
                  disabled={row.locked}
                  controls={[
                    {
                      key: 'resolve',
                      pennant: true,
                      label: 'Resolve',
                      ariaLabel: `Resolve ${row.name}`,
                      title: row.lockTitle,
                      onClick: () => view.onOpen(row.key),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
