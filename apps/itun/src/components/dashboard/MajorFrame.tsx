/**
 * MajorFrame — the presentational half of a Major slot: it renders the bays,
 * gauges, buttons and the resolve overlay from a computed `MajorModel`, and
 * knows nothing about rules or the store. `PilotMajor`, `MechMajor` and
 * `CrawlerMajor` each build a model and hand it here, in the slot row and in
 * the ⤢ overlay alike. `StorageBay` composes overlay bodies.
 *
 * Main bays share the width; bays flagged `side` stack in one narrow column on
 * the right (the Mech's Effects and Egress, the Crawler's Upkeep, Upgrade and
 * Scrap), so the main bays get the room (ADR-038 §3). It reuses the band's `.su-dash-*` rules and adds none; everything else is a
 * style object (ADR-046).
 */

import type { ProvenanceLine, VitalGaugeBreakdown } from 'component-lib'
import { Badge, Button, Entity, Stat } from 'component-lib'
import { radius } from 'component-lib/design/tokens'
import type { CSSProperties, ReactNode, RefObject } from 'react'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import { CargoLotRow } from '../shared/CargoLotRow'
import type { BandStat } from './BandStats'
import { BandStats } from './BandStats'
import { DAMAGED } from './bayStats.model'
import type { GaugeTone } from './DashboardGauge'
import { DashboardGauge } from './DashboardGauge'
import { useDashboardForm } from './dashboardForm.model'
import { PhoneMajorFrame } from './PhoneMajorFrame'
import { slotRule } from './slotLayout.model'

/** Stable no-op, so the Escape effect doesn't re-bind when no overlay is open. */
const NOOP = () => {
  // Nothing to close.
}

export type BandGauge = {
  label: string
  value: number
  max: number
  tone: GaugeTone
  danger?: number
  /** Ledger explaining how `max` was derived (ADR-029). */
  provenance?: ProvenanceLine[]
  /** The stat's breakdown, whose `overridden` flag drives the override marker. */
  breakdown?: VitalGaugeBreakdown
}

export type BandButton = {
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  /**
   * `go` = the primary "go" key; `danger` = a destructive or risky one (Eject,
   * Crit Injury, Mark Destroyed). Both draw the rust action fill (Button
   * `variant="primary"`): rust is the one action colour, and status-bad is a
   * state, never a button fill (ruleset §3.1, board D1's EJECT). A destructive
   * key says so in its word and its confirm step. Omit for the default.
   */
  variant?: 'danger' | 'go'
  /** Full-width in the 2-col bay grid (spans both columns). */
  wide?: boolean
}

/** A short text readout in a bay; `warn` marks a problem (a damaged bay). */
type BandText = {
  text: string
  warn?: boolean
  /**
   * The reference entity the chip names, when it is one (a pilot's equipment
   * and abilities). It renders as the entity card's shortform pill — the same
   * anatomy as everywhere else (board D2) — flat, as the Dashboard
   * is. A chip with none stays a plain chip.
   */
  entity?: SURefEntity
}

export type BandBay = {
  label: string
  gauges?: BandGauge[]
  /** Counts under the gauges, as label-first chips (the Upgrade pool, Upkeep). */
  stats?: BandStat[]
  /** One-line readouts that are not counts (the scrap pool, Upkeep's status). */
  lines?: BandText[]
  /**
   * Names shown as chips (the pilot's Kit and Abilities, the crawler's bays).
   * One with an entity is its Token; `warn` greys it as damaged.
   */
  chips?: BandText[]
  buttons: BandButton[]
  /**
   * A control that is more than a button, rendered in place of the button
   * grid's floor: the Pilot's Board split button (`BoardControl`).
   */
  control?: ReactNode
  /**
   * A bay that is one card, drawn bare with no bay frame around it: the phone
   * Mech tab's Chassis Ability (board D4). Phone form only; the canvas has no
   * bay that carries one.
   */
  card?: ReactNode
  /** Columns in the button grid. Two unless the bay has the width for more. */
  columns?: number
  /** Stacks in the narrow side column instead of sharing the main width. */
  side?: boolean
  /** Full-size gauges: the bigger stat rows of a bay with the width. */
  large?: boolean
  /**
   * How much of the row's spare width the bay takes, against one for a plain
   * bay. A bay of entity pills asks for more, so every name fits on one line.
   */
  grow?: number
}

export type BandOverlay = {
  title: string
  onClose: () => void
  /**
   * Gauges to keep on screen while the overlay is up.
   *
   * The overlay covers the whole band, so without these "Take Damage" would
   * hide SP, EP and Heat at exactly the moment you decide how much damage to
   * apply. Pass the gauge the overlay acts on and it stays readable.
   */
  gauges?: BandGauge[]
  body?: ReactNode
  actions?: BandButton[]
  /**
   * The roll or result the overlay reads out (a Heat Check, Critical Damage),
   * spoken through the slot's live region: focus lands on the title, so the
   * body is not read on its own.
   */
  announce?: string
}

export type MajorModel = {
  fam: 'mech' | 'pilot' | 'crawler'
  /**
   * The slot's MOUNT STATE — "Boarded", "On Foot", "Downtime" — or, in the ⤢
   * overlay, what the entity is doing ("Parked"). Not the entity name: the
   * rail and the overlay header already carry the identity.
   */
  stampLabel: string
  bays: BandBay[]
  overlay?: BandOverlay | null
}

const STAMP_BG: Record<MajorModel['fam'], string> = {
  mech: 'var(--color-sheet-mech-deep)',
  pilot: 'var(--color-sheet-pilot-deep)',
  crawler: 'var(--color-sheet-crawler-deep)',
}

const STAMP: CSSProperties = {
  padding: '5px 9px',
  fontSize: 'var(--text-caption)',
  color: 'var(--color-paper)',
}

/** The bay row: the main bays, then the side column. */
const BAYS: CSSProperties = { gap: 0 }

const SIDE: CSSProperties = {
  display: 'flex',
  flex: '0 0 172px',
  flexDirection: 'column',
  gap: '8px',
  minWidth: 0,
  overflowY: 'auto',
  marginLeft: '8px',
  padding: '4px 8px',
  borderLeft: 'var(--bw-chrome) solid color-mix(in srgb, var(--color-ink) 16%, transparent)',
  borderRadius: 'var(--radius-card)',
  background: 'var(--color-ink-8)',
}

/**
 * The bigger stat rows: the same single-row gauge, drawn larger. `zoom`
 * scales its label, track and numeral together and takes the space it draws
 * in, which a `transform` would not.
 */
const LARGE: CSSProperties = { zoom: 1.5, gap: '6px' }

const SIDE_BAY: CSSProperties = { display: 'flex', flexDirection: 'column', gap: '4px' }

const LINE: CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-body)',
  fontSize: 'var(--text-note)',
  lineHeight: 1.3,
  color: 'var(--color-ink)',
}

const WARN: CSSProperties = { color: 'var(--color-status-bad)', fontWeight: 600 }

const CHIPS: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignContent: 'flex-start',
  gap: '4px',
  minHeight: 0,
  overflowY: 'auto',
}

/**
 * A bay of named things with no entity card (a crawler bay whose ref does
 * not resolve) lays them out as TILES in a grid (board D3), not a run of pills.
 */
const TILES: CSSProperties = {
  ...CHIPS,
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
}

/**
 * One named tile: square-cornered on the 3px canon (ruleset §4.4 — rounding
 * beyond it only where it copies a book style, and a bay is not one), framed in
 * ink, condensed caps as board D3 sets them.
 */
const CHIP: CSSProperties = {
  padding: '6px 8px',
  border: 'var(--bw-chrome) solid var(--color-ink)',
  borderRadius: radius.card,
  background: 'var(--color-paper)',
  fontFamily: 'var(--font-cond)',
  fontWeight: 700,
  fontSize: 'var(--text-note)',
  letterSpacing: 'var(--tracking-caps-tight)',
  lineHeight: 1.2,
  textTransform: 'uppercase',
}

/**
 * A bay/overlay action, rendered on the standard `Button` (dark instrument
 * surface). `danger` and `go` both map to the rust primary variant (see
 * `BandButton.variant`); `full` fills the
 * bay grid cell (`wide` spans both columns), while overlay actions stay
 * auto-width with a 140px floor.
 */
function BandBtn({ btn, full = true }: { btn: BandButton; full?: boolean }) {
  const style: CSSProperties = full ? { width: '100%' } : { minWidth: '140px' }
  if (btn.wide) style.gridColumn = 'span 2'
  return (
    <Button
      variant={btn.variant === undefined ? 'default' : 'primary'}
      size="compact"
      style={style}
      onClick={btn.onClick}
      disabled={btn.disabled}
      title={btn.title}
    >
      {btn.label}
    </Button>
  )
}

function Gauges({ gauges, large }: { gauges: BandGauge[]; large?: boolean }) {
  return (
    <div className="su-dash-bay-gauges" style={large ? LARGE : undefined}>
      {gauges.map((g) => (
        <DashboardGauge
          key={g.label}
          label={g.label}
          value={g.value}
          max={g.max}
          tone={g.tone}
          danger={g.danger}
          provenance={g.provenance}
          breakdown={g.breakdown}
        />
      ))}
    </div>
  )
}

function Lines({ lines }: { lines: BandText[] }) {
  return (
    <>
      {lines.map((l) => (
        <p key={l.text} style={l.warn ? { ...LINE, ...WARN } : LINE}>
          {l.text}
        </p>
      ))}
    </>
  )
}

/** A bay with nothing but its button grid. */
function buttonsOnly(bay: BandBay): boolean {
  return !bay.gauges?.length && !bay.stats?.length && !bay.lines?.length && !bay.chips?.length
}

/** One bay's content: label, gauges, readouts, chips, then the button grid. */
function BayBody({ bay }: { bay: BandBay }) {
  const columns = bay.columns ?? 2
  return (
    <>
      <span className="su-dash-bay-lab">{bay.label}</span>
      {bay.gauges && bay.gauges.length > 0 && <Gauges gauges={bay.gauges} large={bay.large} />}
      {bay.stats && <BandStats stats={bay.stats} />}
      {bay.lines && bay.lines.length > 0 && <Lines lines={bay.lines} />}
      {bay.chips && bay.chips.length > 0 && (
        <ul
          style={{
            ...(bay.chips.some((c) => c.entity) ? CHIPS : TILES),
            listStyle: 'none',
            margin: 0,
            padding: 0,
          }}
        >
          {bay.chips.map((c) =>
            c.entity ? (
              <li key={c.text}>
                <Entity form="token" entity={c.entity} instance={c.warn ? DAMAGED : undefined} />
              </li>
            ) : (
              <li
                key={c.text}
                style={c.warn ? { ...CHIP, ...WARN, borderColor: 'currentColor' } : CHIP}
              >
                {c.text}
              </li>
            )
          )}
        </ul>
      )}
      {bay.control}
      {bay.buttons.length > 0 && (
        <div
          className="su-dash-btn-grid"
          style={columns === 2 ? undefined : { gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {bay.buttons.map((btn) => (
            <BandBtn key={btn.label} btn={btn} />
          ))}
        </div>
      )}
    </>
  )
}

export type StorageLot = {
  id: string
  code: string
  name: string
  kind: string
  tl?: number
  qty?: number
  units: number
}

/**
 * The cargo-hold list used inside the Storage overlay (Jettison is destructive):
 * the hold's `UNITS | used/cap`, then each lot as the one lot row
 * (`CargoLotRow`), as every hold draws it.
 */
export function StorageBay({
  lots,
  used,
  cap,
  onJettison,
}: {
  lots: StorageLot[]
  used: number
  cap: number
  onJettison: (lotId: string) => void
}) {
  return (
    <div className="su-dash-cargo">
      <span className="su-dash-cargo-usage">
        <Stat
          orientation="horizontal"
          size="compact"
          label="Units"
          value={used}
          max={cap}
          state={used > cap ? 'critical' : undefined}
        />
      </span>
      {lots.length === 0 ? (
        <p className="su-dash-resolve-log">Cargo hold is empty.</p>
      ) : (
        <ul className="su-dash-cargo-list">
          {lots.map((lot) => (
            <CargoLotRow key={lot.id} lot={lot}>
              <Button
                variant="danger"
                size="compact"
                onClick={() => onJettison(lot.id)}
                aria-label={`Jettison ${lot.name}`}
              >
                Jettison
              </Button>
            </CargoLotRow>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * An overlay takes focus: its title on open (again when a new prompt replaces
 * it), unless its body already placed focus inside it; and on close back to what had focus when it opened (the bay button, or
 * the deck's Apply that routed a Cascade Failure here) — unless focus has
 * since moved somewhere live. The opener is read in a layout effect, before
 * the bays' `inert` can move focus off it.
 */
function useOverlayFocus(title: string | undefined): RefObject<HTMLElement | null> {
  const titleRef = useRef<HTMLElement>(null)
  const open = title !== undefined
  useLayoutEffect(() => {
    if (!open) return
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active !== document.body ? active : null
    return () => {
      const now = document.activeElement
      if (opener?.isConnected && (now === null || now === document.body)) opener.focus()
    }
  }, [open])
  useEffect(() => {
    const el = titleRef.current
    if (title === undefined || el === null) return
    // A body that places focus itself (the Board menu's first mech) keeps it.
    if (el.closest('[role="dialog"]')?.contains(document.activeElement)) return
    el.focus()
  }, [title])
  return titleRef
}

/**
 * Renders one computed Major model: on the canvas's band, or — in the phone
 * form (ADR-045) — as `PhoneMajorFrame`'s one column. Same model either way.
 */
export function MajorFrame({ view }: { view: MajorModel }) {
  const { overlay } = view
  const form = useDashboardForm()
  // Escape dismisses the resolve/damage/storage prompt, like every other
  // dismissible surface in the app.
  useEscapeKey(overlay != null, overlay?.onClose ?? NOOP)
  const titleRef = useOverlayFocus(overlay?.title)
  // Mounted before any overlay is, so a screen reader hears what it reads out.
  const live = (
    <p aria-live="polite" className="su-sr-only">
      {overlay?.announce}
    </p>
  )
  if (form.form === 'phone') {
    return <PhoneMajorFrame view={view} between={form.between} titleRef={titleRef} live={live} />
  }
  const main = view.bays.filter((b) => !b.side)
  const side = view.bays.filter((b) => b.side)
  return (
    <div
      className="su-dash-band"
      data-fam={view.fam}
      // The unit colour as the slot's top rule, as every Minor wears it (D1–D3).
      style={{ borderTop: slotRule(view.fam) }}
    >
      {live}
      <div className="su-dash-band-id">
        <Badge shape="stamp" style={{ ...STAMP, backgroundColor: STAMP_BG[view.fam] }}>
          {view.stampLabel}
        </Badge>
      </div>
      {/* Under an overlay the bays are covered: out of the Tab order too. */}
      <div className="su-dash-bays" style={BAYS} inert={overlay != null}>
        {main.map((bay) => (
          // A bay with only buttons (Mount) has nothing to fill its middle, and
          // the button grid is floor-pinned — so it would render as a label at
          // the top, a button at the bottom, and a stripe of nothing between.
          // Flagged so the stylesheet can centre those bays instead.
          // A bay of readouts or chips reads from the top like the rest.
          <div
            key={bay.label}
            className="su-dash-bay"
            data-nogauge={buttonsOnly(bay) || undefined}
            style={bay.grow ? { flexGrow: bay.grow } : undefined}
          >
            <BayBody bay={bay} />
          </div>
        ))}
        {side.length > 0 && (
          <div style={SIDE}>
            {side.map((bay) => (
              <div key={bay.label} style={SIDE_BAY}>
                <BayBody bay={bay} />
              </div>
            ))}
          </div>
        )}
      </div>

      {overlay && (
        <div className="su-dash-resolve" role="dialog" aria-label={overlay.title}>
          <div className="su-dash-resolve-head">
            <span ref={titleRef} className="su-dash-resolve-title" tabIndex={-1}>
              {overlay.title}
            </span>
            {overlay.gauges && overlay.gauges.length > 0 && (
              <div className="su-dash-resolve-gauges">
                {overlay.gauges.map((g) => (
                  <DashboardGauge
                    key={g.label}
                    label={g.label}
                    value={g.value}
                    max={g.max}
                    tone={g.tone}
                    danger={g.danger}
                  />
                ))}
              </div>
            )}
            <Button variant="ghost" size="compact" onClick={overlay.onClose}>
              Close
            </Button>
          </div>
          <div className="su-dash-resolve-body">
            {overlay.body}
            {overlay.actions && overlay.actions.length > 0 && (
              <div className="su-dash-resolve-actions">
                {overlay.actions.map((btn) => (
                  <BandBtn key={btn.label} btn={btn} full={false} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
