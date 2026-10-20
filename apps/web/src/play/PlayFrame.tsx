/**
 * PlayFrame — the Cockpit's one screen (Play, Direction A): the Play bar on
 * top, three columns under it, a foot along the bottom, laid on the fixed
 * 1280×800 `PlayCanvas`, which scales and letterboxes it and never
 * scrolls (ADR-038 §9, ADR-045's floor). Below that floor it draws the
 * screen's `phone` form instead (`PlayPhone`: tabs under pinned vitals,
 * play.md §11), which fits the screen too.
 *
 * A pure slotted layout, shared by both Play screens: the player's
 * (`PlayCockpit`: Units | Actions | Crew, Tables, Feed) and the Mediator's
 * (`PlayMediatorCockpit`: the table's seats | the Opposition | Tables, Feed,
 * Propose). The side columns are ~300px and ~320px; the centre takes the
 * rest. A column scrolls inside itself when its content outgrows it; the
 * canvas never does.
 *
 * ## Nesting (the Nested Frames Audit)
 *
 * The canvas is level 0. A column is a plain region on it, not a frame: its
 * heading is a Slab (`PlayColumn`), never a `TitledBox`, so what a column
 * lists — Compacts, Cards, a unit's `TitledBox` — stays at level 1, and
 * anything inside one of those is a Mini (level 2).
 *
 * The Cockpit is a page like the sheets (owner's call, 2026-10-20): the page
 * ground, the Play bar and foot in the Cantina's band, and each column a paper
 * panel on a hairline. Its ground is flat, its brand-colour bands speckled as the
 * sheet's (ruleset §1.3, §3.5.1; R10): the frame sets the texture once for
 * every entity form on the canvas and the phone form alike.
 *
 * The `.su-play-*` stylesheet rides in with this module: the canvas's size
 * and ground are its rules, and the Play route's chunk is where it belongs.
 * Play's own bundle (`styles/play/play.css`: Units, Actions, side) comes
 * after it.
 */

import '../styles/play/dashboard.css'
import '../styles/play/play.css'
import type { CSSProperties, ReactNode } from 'react'
import { EntitySurfaceProvider, tokens } from '../components/index'
import { PlayCanvas } from './PlayCanvas'

/** The two side columns' widths: the Units (or the table's seats) and the side stack. */
const PLAY_COLUMNS = { start: 300, end: 320 } as const

const FRAME = {
  display: 'grid',
  gap: tokens.space[12],
  gridTemplateColumns: `${PLAY_COLUMNS.start}px minmax(0, 1fr) ${PLAY_COLUMNS.end}px`,
  gridTemplateRows: 'auto minmax(0, 1fr) auto',
  gridTemplateAreas: "'bar bar bar' 'start centre end' 'foot foot foot'",
  height: '100%',
  padding: `${tokens.space[8]} ${tokens.space[12]}`,
  width: '100%',
} satisfies CSSProperties

/**
 * Play's brand-colour grounds wear the speckle as the sheet's do (ruleset
 * §3.5.1, R10): set once, for every form inside. The page ground, the paper
 * columns, buttons and fields stay clean, since only a band (the Play bar, a
 * head, a unit box's band) carries it.
 */
const SPECKLED = { texture: true } as const

/** The bar and foot bleed to the canvas's edges, out of the frame's padding. */
const BAR = {
  gridArea: 'bar',
  margin: `-${tokens.space[8]} -${tokens.space[12]} 0`,
  minWidth: 0,
} satisfies CSSProperties
const FOOT = {
  gridArea: 'foot',
  margin: `0 -${tokens.space[12]} -${tokens.space[8]}`,
  minWidth: 0,
} satisfies CSSProperties

/**
 * A column: a paper panel on the page ground, framed in the 1px ink-40
 * hairline a sheet's opening panels wear (ruleset §4.3; owner's call,
 * 2026-10-20), its own scroll.
 */
const COLUMN = {
  background: 'var(--color-paper)',
  border: `${tokens.borderWidth.hairline} solid var(--color-ink-40)`,
  borderRadius: tokens.radius.card,
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minHeight: 0,
  minWidth: 0,
  overflowY: 'auto',
  padding: tokens.space[12],
} satisfies CSSProperties

const AREA: Record<'start' | 'centre' | 'end', CSSProperties> = {
  start: { ...COLUMN, gridArea: 'start' },
  centre: { ...COLUMN, gridArea: 'centre' },
  end: { ...COLUMN, gridArea: 'end' },
}

type PlayFrameProps = {
  /** The Play bar (`PlayBar`). */
  bar: ReactNode
  /** The left column: the Units, or the Mediator's table seats. */
  start: ReactNode
  /** The centre column: the flattened Actions, or the Opposition. */
  centre: ReactNode
  /** The right column: Crew, Tables and Feed, or the Mediator's Tables, Feed and Propose. */
  end: ReactNode
  /** The foot (`PlayFoot`). */
  foot: ReactNode
  /** Names for the three columns' regions, in order: "Units", "Actions", … */
  labels: readonly [string, string, string]
  /**
   * The phone form (`PlayPhone`, play.md §11), drawn instead below the
   * canvas's floor; it fits the screen and scrolls inside itself.
   */
  phone: ReactNode
}

export function PlayFrame({ bar, start, centre, end, foot, labels, phone }: PlayFrameProps) {
  return (
    <EntitySurfaceProvider value={SPECKLED}>
      <PlayCanvas phone={phone}>
        <div style={FRAME}>
          <div style={BAR}>{bar}</div>
          <section aria-label={labels[0]} style={AREA.start}>
            {start}
          </section>
          <section aria-label={labels[1]} style={AREA.centre}>
            {centre}
          </section>
          <section aria-label={labels[2]} style={AREA.end}>
            {end}
          </section>
          <div style={FOOT}>{foot}</div>
        </div>
      </PlayCanvas>
    </EntitySurfaceProvider>
  )
}
