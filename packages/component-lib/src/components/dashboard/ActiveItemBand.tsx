/**
 * ActiveItemBand — the Active Item (primary row): the entity you're currently
 * running, laid out as responsibility "bays" (a gauge cluster + its own button
 * grid), with a resolve overlay for player-confirmed steps.
 *
 * Presentational: every rule + store write lives in the ITUN wrapper (per band:
 * mech / pilot / crawler), which computes this view-model and wires the button
 * callbacks. This renders the bays + gauges + buttons + the resolve overlay.
 * DamageStepper + StorageBay are exported so the wrapper can compose overlay
 * bodies.
 */

import type { ReactNode } from 'react'
import { DashboardGauge, type GaugeTone } from './DashboardGauge'

export type BandGauge = {
  label: string
  value: number
  max: number
  tone: GaugeTone
  danger?: number
}

export type BandButton = {
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
  ariaLabel?: string
  /** Rust/danger styling (pc-btn-danger). */
  danger?: boolean
  /** The "go" primary key (pc-btn-go). */
  go?: boolean
  /** Full-width in the 2-col grid (pc-btn-wide). */
  wide?: boolean
}

export type BandBay = {
  label: string
  gauges?: BandGauge[]
  buttons: BandButton[]
}

export type BandOverlay = {
  title: string
  onClose: () => void
  body?: ReactNode
  actions?: BandButton[]
}

export type ActiveItemBandView = {
  fam: 'mech' | 'pilot' | 'crawler'
  stampLabel: string
  bays: BandBay[]
  overlay?: BandOverlay | null
}

export type ActiveItemBandProps = { view: ActiveItemBandView }

const STAMP_BG: Record<ActiveItemBandView['fam'], string> = {
  mech: 'var(--color-sheet-mech-deep)',
  pilot: 'var(--color-sheet-pilot-deep)',
  crawler: 'var(--color-sheet-crawler-deep)',
}

function BandBtn({ btn }: { btn: BandButton }) {
  const cls = `pc-btn${btn.danger ? ' pc-btn-danger' : ''}${btn.go ? ' pc-btn-go' : ''}${
    btn.wide ? ' pc-btn-wide' : ''
  }`
  return (
    <button
      type="button"
      className={cls}
      onClick={btn.onClick}
      disabled={btn.disabled}
      title={btn.title}
      aria-label={btn.ariaLabel}
    >
      {btn.label}
    </button>
  )
}

/** The ± damage stepper used inside a Take-Damage overlay. */
export function DamageStepper({
  amount,
  setAmount,
}: {
  amount: number
  setAmount: (n: number) => void
}) {
  return (
    <div className="pc-step">
      <button
        type="button"
        className="pc-btn"
        onClick={() => setAmount(Math.max(1, amount - 1))}
        aria-label="Decrease damage"
      >
        −
      </button>
      <span className="pc-step-num">{amount}</span>
      <button
        type="button"
        className="pc-btn"
        onClick={() => setAmount(amount + 1)}
        aria-label="Increase damage"
      >
        +
      </button>
    </div>
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
              <button
                type="button"
                className="pc-btn pc-btn-danger"
                onClick={() => onJettison(lot.id)}
                aria-label={`Jettison ${lot.name}`}
              >
                Jettison
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ActiveItemBand({ view }: ActiveItemBandProps) {
  const { overlay } = view
  return (
    <div className="pc-band" data-fam={view.fam}>
      <div className="pc-band-id">
        {view.fam === 'mech' ? (
          <span className="pc-stamp pc-stamp-mech">{view.stampLabel}</span>
        ) : (
          <span className="pc-stamp" style={{ background: STAMP_BG[view.fam] }}>
            {view.stampLabel}
          </span>
        )}
      </div>
      <div className="pc-bays">
        {view.bays.map((bay) => (
          <div key={bay.label} className="pc-bay">
            <span className="pc-bay-lab">{bay.label}</span>
            {bay.gauges && bay.gauges.length > 0 && (
              <div className="pc-bay-gauges">
                {bay.gauges.map((g) => (
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
            {bay.buttons.length > 0 && (
              <div className="pc-btn-grid">
                {bay.buttons.map((btn) => (
                  <BandBtn key={btn.label} btn={btn} />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {overlay && (
        <div className="pc-resolve" role="dialog" aria-label={overlay.title}>
          <div className="pc-resolve-head">
            <span className="pc-resolve-title">{overlay.title}</span>
            <button type="button" className="pc-railbtn" onClick={overlay.onClose}>
              Close
            </button>
          </div>
          <div className="pc-resolve-body">
            {overlay.body}
            {overlay.actions && overlay.actions.length > 0 && (
              <div className="pc-resolve-actions">
                {overlay.actions.map((btn) => (
                  <BandBtn key={btn.label} btn={btn} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
