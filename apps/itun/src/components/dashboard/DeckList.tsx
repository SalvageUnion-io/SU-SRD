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
import { Badge, ReferenceEntityCard } from 'component-lib'
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
      familyClass: string
      /** The whole deck, flat — one grid, no source/timing headings above it. */
      rows: DeckRow[]
      onOpen: (key: string) => void
      /**
       * Open an action and pay for it in one press: the phone's pennant
       * (ADR-044 D6). The canvas pays from the resolve's own pennant.
       */
      onActivate: (key: string) => void
    }

/** A bare fieldset: the group, without the browser's frame around it. */
const GROUP: CSSProperties = { border: 0, margin: 0, padding: 0, minInlineSize: 0 }

const STAMP: CSSProperties = {
  borderRadius: radius.card,
  paddingInline: space[4],
  paddingBlock: '1px',
  fontSize: fontSize.badge,
}

export function DeckList({ view }: { view: DeckListModel }) {
  if (view.kind === 'empty') {
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-empty">{view.text}</div>
      </div>
    )
  }

  return (
    <div className="pc-display-scroll">
      <div className="pc-deck-controls-bar">
        <fieldset className="pc-deck-tabs" style={GROUP} aria-label="Filter actions by timing">
          {view.tabs.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={view.activeTab === t}
              className={`pc-deck-tab${view.activeTab === t ? ' is-active' : ''}`}
              onClick={() => view.onTab(t)}
            >
              {t}
            </button>
          ))}
        </fieldset>

        <div className="pc-deck-toolrow">
          <div className="pc-deck-range">
            {view.rangeBands.map((band) => (
              <button
                key={band}
                type="button"
                aria-pressed={view.activeRange === band}
                className={`pc-deck-range-btn${view.activeRange === band ? ' is-active' : ''}`}
                onClick={() => view.onRange(band)}
                title={`Set engagement range to ${band}`}
              >
                {band[0]}
              </button>
            ))}
            <span className="pc-deck-reach">{view.reachText}</span>
          </div>
        </div>

        {view.sources.length > 1 && (
          <div className={`pc-deck-sources ${view.familyClass}`}>
            <button
              type="button"
              aria-pressed={view.sourceFilter === null}
              className={`pc-deck-source${view.sourceFilter === null ? ' is-active' : ''}`}
              onClick={() => view.onSourceFilter(null)}
            >
              All
            </button>
            {view.sources.map((src) => (
              <button
                key={`${src.stamp}:${src.label}`}
                type="button"
                aria-pressed={view.sourceFilter === src.label}
                className={`pc-deck-source${view.sourceFilter === src.label ? ' is-active' : ''}`}
                onClick={() =>
                  view.onSourceFilter(view.sourceFilter === src.label ? null : src.label)
                }
                title={`Filter the deck to “${src.label}” actions.`}
              >
                <Badge shape="stamp" size="mini" style={STAMP}>
                  {src.stamp}
                </Badge>
                {src.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view.rows.length === 0 ? (
        <div className="pc-deck-empty">No actions match this filter.</div>
      ) : (
        <div className="pc-deck">
          {/*
           * ONE grid over the whole deck — no source/timing headings, so an
           * action is never filed under a name of its own; the entry already
           * states what it is. Each entry is the COMPACT, header-only card
           * (`medium` + `head`, board D1): the name, the source stamp and the
           * cost pennant on one row, so a kitted pilot's deck stays a short
           * list. The full card — description, roll table, choices — is the
           * Resolve pane's, one click away. A head row nests no buttons, which
           * keeps it safe inside this entry's own `role="button"`. `<ul>/<li>`
           * stays — a set of actions IS a list semantically.
           */}
          <ul className="pc-deck-grid">
            {view.rows.map((row) => (
              // Lock (out of range / overheat) is a caller-resolved overlay,
              // layered on the canonical card — dim + tooltip — never a
              // property of the action card itself.
              <li
                key={row.key}
                className={row.locked ? 'is-locked' : undefined}
                title={row.lockTitle}
              >
                <ReferenceEntityCard
                  data={row.entity}
                  size="medium"
                  extent="head"
                  // The Dashboard stays flat (ruleset §3.5): no speckle.
                  texture={false}
                  disabled={row.locked}
                  cardClickLabel={row.name}
                  onCardClick={() => view.onOpen(row.key)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
