/**
 * PhoneDeck — the Actions deck on a phone (ADR-044 D6), on the Major's tab
 * only. The same `DeckListModel` the canvas's `DeckList` renders, drawn as
 * one column of one-line rows.
 *
 *  - **Filters** sit above the rows and wrap; there is no horizontal
 *    scroller. Range is four `aria-pressed` keys (it is seat state, shared
 *    with the crew), then timing, then source.
 *  - **A row** is the action's `ReferenceEntityCard` at its head extent. Its
 *    pennant is the action button: it opens the action AND pays for it
 *    (`onActivate`), the same `activate` the resolve's own pennant calls. The
 *    row's body opens it without paying (`onOpen`). Either way the resolve
 *    screen opens.
 *  - **A locked action** dims and says why, in text.
 *
 * Each row carries `data-deck-key`, so focus can return to the pennant or row
 * that opened the resolve screen once it closes (D14).
 */

import type { ReferenceEntityControl } from 'component-lib'
import { ReferenceEntityCard } from 'component-lib'
import { color, font, fontSize, space, tracking, weight } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import type { DeckListModel } from './DeckList'

const ROOT: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[10] }

const HEADING: CSSProperties = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.caption,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink,
}

const GROUP: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
  border: 0,
  margin: 0,
  padding: 0,
  minInlineSize: 0,
}

const REACH: CSSProperties = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink75,
}

const ROWS: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
}

const LOCKED: CSSProperties = { opacity: 0.6 }

const LOCK_NOTE: CSSProperties = {
  margin: `${space[4]} 0 0`,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
}

const EMPTY: CSSProperties = { ...REACH, margin: 0 }

function Toggle({
  pressed,
  onPress,
  label,
  children,
}: {
  pressed: boolean
  onPress: () => void
  label?: string
  children: string
}) {
  return (
    <button
      type="button"
      className="su-dash-toggle"
      aria-pressed={pressed}
      aria-label={label}
      onClick={onPress}
    >
      {children}
    </button>
  )
}

export function PhoneDeck({
  view,
  onOpen,
  onActivate,
}: {
  view: DeckListModel
  /** The row's body: open the action without paying. */
  onOpen: (key: string) => void
  /** The row's pennant: open the action and pay for it. */
  onActivate: (key: string) => void
}) {
  if (view.kind === 'empty') {
    return (
      <section aria-labelledby="dash-phone-deck" style={ROOT}>
        <h3 id="dash-phone-deck" style={HEADING}>
          Actions
        </h3>
        <p style={EMPTY}>{view.text}</p>
      </section>
    )
  }
  return (
    <section aria-labelledby="dash-phone-deck" style={ROOT}>
      <h3 id="dash-phone-deck" style={HEADING}>
        Actions
      </h3>
      <fieldset style={GROUP} aria-label="Engagement range">
        {view.rangeBands.map((band) => (
          <Toggle
            key={band}
            pressed={view.activeRange === band}
            onPress={() => view.onRange(band)}
            label={`Range ${band}`}
          >
            {band[0] ?? band}
          </Toggle>
        ))}
        <span style={REACH}>{view.reachText}</span>
      </fieldset>
      <fieldset style={GROUP} aria-label="Filter actions by timing">
        {view.tabs.map((t) => (
          <Toggle key={t} pressed={view.activeTab === t} onPress={() => view.onTab(t)}>
            {t}
          </Toggle>
        ))}
      </fieldset>
      {view.sources.length > 1 && (
        <fieldset style={GROUP} aria-label="Filter actions by source">
          <Toggle pressed={view.sourceFilter === null} onPress={() => view.onSourceFilter(null)}>
            All
          </Toggle>
          {view.sources.map((src) => (
            <Toggle
              key={`${src.stamp}:${src.label}`}
              pressed={view.sourceFilter === src.label}
              onPress={() =>
                view.onSourceFilter(view.sourceFilter === src.label ? null : src.label)
              }
            >
              {src.label}
            </Toggle>
          ))}
        </fieldset>
      )}
      {view.rows.length === 0 ? (
        <p style={EMPTY}>No actions match this filter.</p>
      ) : (
        <ul style={ROWS}>
          {view.rows.map((row) => {
            const pennant: ReferenceEntityControl = {
              key: 'activate',
              pennant: true,
              label: 'Activate',
              onClick: () => onActivate(row.key),
              disabled: row.locked,
            }
            return (
              <li key={row.key} data-deck-key={row.key} style={row.locked ? LOCKED : undefined}>
                <ReferenceEntityCard
                  data={row.entity}
                  size="small"
                  extent="head"
                  // The Dashboard stays flat (issue 1255): no speckle.
                  texture={false}
                  controls={[pennant]}
                  cardClickLabel={`Open ${row.name}`}
                  onCardClick={() => onOpen(row.key)}
                />
                {row.locked && row.lockTitle ? <p style={LOCK_NOTE}>{row.lockTitle}</p> : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
