/**
 * PhoneDeck — the Actions deck on a phone (ADR-045 D6), on the Major's tab
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

import type { CSSProperties } from 'react'
import { color, font, fontSize, space, tracking, weight } from '../../design/tokens'
import type { ReferenceEntityControl } from '../index'
import { EmptyState, ReferenceEntityCard, Stack, Toggle, ToggleGroup } from '../index'
import type { DeckListModel } from './DeckList'

const HEADING = {
  margin: 0,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.caption,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink,
} satisfies CSSProperties

/** A row of toggles, wrapping (the bare fieldset is `ToggleGroup`'s). */
const GROUP = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: space[6],
} satisfies CSSProperties

const REACH = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink75,
} satisfies CSSProperties

const ROWS = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const LOCKED = { opacity: 0.6 } satisfies CSSProperties

const LOCK_NOTE = {
  margin: `${space[4]} 0 0`,
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
} satisfies CSSProperties

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
      <Stack as="section" gap={10} aria-labelledby="dash-phone-deck">
        <h3 id="dash-phone-deck" style={HEADING}>
          Actions
        </h3>
        <EmptyState variant="quiet" body={view.text} />
      </Stack>
    )
  }
  return (
    <Stack as="section" gap={10} aria-labelledby="dash-phone-deck">
      <h3 id="dash-phone-deck" style={HEADING}>
        Actions
      </h3>
      <ToggleGroup style={GROUP} label="Engagement range">
        {view.rangeBands.map((band) => (
          <Toggle
            key={band}
            pressed={view.activeRange === band}
            onClick={() => view.onRange(band)}
            aria-label={`Range ${band}`}
          >
            {band[0] ?? band}
          </Toggle>
        ))}
        <span style={REACH}>{view.reachText}</span>
      </ToggleGroup>
      <ToggleGroup style={GROUP} label="Filter actions by timing">
        {view.tabs.map((t) => (
          <Toggle key={t} pressed={view.activeTab === t} onClick={() => view.onTab(t)}>
            {t}
          </Toggle>
        ))}
      </ToggleGroup>
      {view.sources.length > 1 && (
        <ToggleGroup style={GROUP} label="Filter actions by source">
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
            >
              {src.label}
            </Toggle>
          ))}
        </ToggleGroup>
      )}
      {view.rows.length === 0 ? (
        <EmptyState variant="quiet" body="No actions match this filter." />
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
                  // `compact` at the head extent is the one-line listing row
                  // (ruleset §1 Listing): it spans the column, truncates a
                  // long name with its full name in a tooltip, and keeps the
                  // pennant right-aligned. `mini` is the shortform pill,
                  // which sizes to its content.
                  size="compact"
                  extent="head"
                  // The Dashboard stays flat: no speckle.
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
    </Stack>
  )
}
