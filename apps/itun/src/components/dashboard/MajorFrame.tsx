/**
 * MajorFrame — the presentational half of a Major slot: it renders the bays,
 * gauges, buttons and the resolve overlay from a computed `MajorModel`, and
 * knows nothing about rules or the store. `PilotMajor`, `MechMajor` and
 * `CrawlerMajor` each build a model and hand it here, in the slot row and in
 * the ⤢ overlay alike; the stories drive it with fixture models and no
 * store. `StorageBay` composes overlay bodies.
 *
 * Main bays share the width; bays flagged `side` stack in one narrow column on
 * the right (the Mech's Effects and Egress, the Crawler's Upkeep, Upgrade and
 * Scrap), so the main bays get the room (ADR-038 §3). It reuses the band's `.pc-*` rules and adds none; everything else is a
 * style object (tailwind-removal.md §4).
 */

import type { ProvenanceLine, VitalGaugeBreakdown } from 'component-lib'
import { Badge, Button, ReferenceEntityCard } from 'component-lib'
import { radius } from 'component-lib/design/tokens'
import type { CSSProperties, ReactNode } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { GaugeTone } from './DashboardGauge'
import { DashboardGauge } from './DashboardGauge'
import { slotRule } from './slotLayout'

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
  /** `danger` = destructive styling (Button `variant="danger"`); `go` = the
   * primary "go" key (Button `variant="primary"`). Omit for the default. */
  variant?: 'danger' | 'go'
  /** Full-width in the 2-col bay grid (spans both columns). */
  wide?: boolean
}

/** A short text readout in a bay; `warn` marks a problem (a damaged bay). */
export type BandText = {
  text: string
  warn?: boolean
  /**
   * The reference entity the chip names, when it is one (a pilot's equipment
   * and abilities). It renders as the entity card's shortform pill — the same
   * anatomy as everywhere else (issue 1255, board D2) — flat, as the Dashboard
   * is. A chip with none stays a plain chip.
   */
  entity?: SURefEntity
}

export type BandBay = {
  label: string
  gauges?: BandGauge[]
  /** One-line readouts under the gauges (Tech Level, the scrap pool, Upkeep). */
  lines?: BandText[]
  /** Names shown as chips (the pilot's Kit and Abilities, the crawler's bays). */
  chips?: BandText[]
  buttons: BandButton[]
  /**
   * A control that is more than a button, rendered in place of the button
   * grid's floor: the Pilot's Board split button (`BoardControl`).
   */
  control?: ReactNode
  /** Columns in the button grid. Two unless the bay has the width for more. */
  columns?: number
  /** Stacks in the narrow side column instead of sharing the main width. */
  side?: boolean
  /** Full-size gauges: the bigger stat rows of a bay with the width. */
  large?: boolean
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

const CHIP: CSSProperties = {
  padding: '1px 8px',
  border: 'var(--bw-chrome) solid var(--color-ink-30)',
  borderRadius: radius.full,
  background: 'var(--color-paper)',
  fontFamily: 'var(--font-cond)',
  fontWeight: 600,
  fontSize: 'var(--text-note)',
  whiteSpace: 'nowrap',
}

/**
 * A bay/overlay action, rendered on the standard `Button` (dark instrument
 * surface). `danger`/`go` map to the danger/primary variants; `full` fills the
 * bay grid cell (`wide` spans both columns), while overlay actions stay
 * auto-width with a 140px floor.
 */
function BandBtn({ btn, full = true }: { btn: BandButton; full?: boolean }) {
  const style: CSSProperties = full ? { width: '100%' } : { minWidth: '140px' }
  if (btn.wide) style.gridColumn = 'span 2'
  return (
    <Button
      variant={btn.variant === 'danger' ? 'danger' : btn.variant === 'go' ? 'primary' : 'default'}
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
    <div className="pc-bay-gauges" style={large ? LARGE : undefined}>
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
  return !bay.gauges?.length && !bay.lines?.length && !bay.chips?.length
}

/** One bay's content: label, gauges, readouts, chips, then the button grid. */
function BayBody({ bay }: { bay: BandBay }) {
  const columns = bay.columns ?? 2
  return (
    <>
      <span className="pc-bay-lab">{bay.label}</span>
      {bay.gauges && bay.gauges.length > 0 && <Gauges gauges={bay.gauges} large={bay.large} />}
      {bay.lines && bay.lines.length > 0 && <Lines lines={bay.lines} />}
      {bay.chips && bay.chips.length > 0 && (
        <ul style={{ ...CHIPS, listStyle: 'none', margin: 0, padding: 0 }}>
          {bay.chips.map((c) =>
            c.entity ? (
              <li key={c.text}>
                <ReferenceEntityCard data={c.entity} size="small" extent="head" texture={false} />
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
          className="pc-btn-grid"
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
  qty?: number
  units: number
}

/** The cargo-hold list used inside the Storage overlay (Jettison is destructive). */
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
    <div className="pc-cargo">
      <p className="pc-cargo-usage">
        Hold {used}/{cap}
      </p>
      {lots.length === 0 ? (
        <p className="pc-resolve-log">Cargo hold is empty.</p>
      ) : (
        <ul className="pc-cargo-list">
          {lots.map((lot) => (
            <li key={lot.id} className="pc-cargo-row">
              <span className="pc-cargo-name">
                <span className="pc-cargo-code">{lot.code}</span>
                {lot.name}
                {lot.kind === 'bulk' && lot.qty !== undefined ? ` ×${lot.qty}` : ''}
                <span className="pc-cargo-units">{lot.units}u</span>
              </span>
              <Button
                variant="danger"
                size="compact"
                onClick={() => onJettison(lot.id)}
                aria-label={`Jettison ${lot.name}`}
              >
                Jettison
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Renders one computed Major model. */
export function MajorFrame({ view }: { view: MajorModel }) {
  const { overlay } = view
  // Escape dismisses the resolve/damage/storage prompt, like every other
  // dismissible surface in the app.
  useEscapeKey(overlay != null, overlay?.onClose ?? NOOP)
  const main = view.bays.filter((b) => !b.side)
  const side = view.bays.filter((b) => b.side)
  return (
    <div
      className="pc-band"
      data-fam={view.fam}
      // The unit colour as the slot's top rule, as every Minor wears it (D1–D3).
      style={{ borderTop: slotRule(view.fam) }}
    >
      <div className="pc-band-id">
        <Badge shape="stamp" style={{ ...STAMP, backgroundColor: STAMP_BG[view.fam] }}>
          {view.stampLabel}
        </Badge>
      </div>
      <div className="pc-bays" style={BAYS}>
        {main.map((bay) => (
          // A bay with only buttons (Mount) has nothing to fill its middle, and
          // the button grid is floor-pinned — so it would render as a label at
          // the top, a button at the bottom, and a stripe of nothing between.
          // Flagged so the stylesheet can centre those bays instead.
          // A bay of readouts or chips reads from the top like the rest.
          <div key={bay.label} className="pc-bay" data-nogauge={buttonsOnly(bay) || undefined}>
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
        <div className="pc-resolve" role="dialog" aria-label={overlay.title}>
          <div className="pc-resolve-head">
            <span className="pc-resolve-title">{overlay.title}</span>
            {overlay.gauges && overlay.gauges.length > 0 && (
              <div className="pc-resolve-gauges">
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
          <div className="pc-resolve-body">
            {overlay.body}
            {overlay.actions && overlay.actions.length > 0 && (
              <div className="pc-resolve-actions">
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
