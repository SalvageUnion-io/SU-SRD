/**
 * ActiveItemBand — the Active Item (primary row): the entity you're currently
 * running, laid out as responsibility "bays" (a gauge cluster + its own button
 * grid), with a resolve overlay for player-confirmed steps.
 *
 * Presentational: every rule + store write lives in the ITUN wrapper (per band:
 * mech / pilot / crawler), which computes this view-model and wires the button
 * callbacks. This renders the bays + gauges + buttons + the resolve overlay.
 * StorageBay is exported so the wrapper can compose overlay
 * bodies.
 */

import type { ReactNode } from 'react'
import { Badge } from '../chrome/Badge'
import { Button } from '../chrome/Button'
import { cn } from '../../utils/cn'
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
  /** Destructive styling → Button `variant="danger"`. */
  danger?: boolean
  /** The primary "go" key → Button `variant="primary"`. */
  go?: boolean
  /** Full-width in the 2-col bay grid (spans both columns). */
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

/**
 * A bay/overlay action, rendered on the standard `Button` (dark instrument
 * surface). `danger`/`go` map to the danger/primary variants; `full` fills the
 * bay grid cell (`wide` spans both columns), while overlay actions stay
 * auto-width with a 140px floor.
 */
function BandBtn({ btn, full = true }: { btn: BandButton; full?: boolean }) {
  return (
    <Button
      variant={btn.danger ? 'danger' : btn.go ? 'primary' : 'default'}
      size="sm"
      className={cn(full ? 'w-full' : 'min-w-[140px]', btn.wide && 'col-span-2')}
      onClick={btn.onClick}
      disabled={btn.disabled}
      title={btn.title}
      aria-label={btn.ariaLabel}
    >
      {btn.label}
    </Button>
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
                size="sm"
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

export function ActiveItemBand({ view }: ActiveItemBandProps) {
  const { overlay } = view
  return (
    <div className="pc-band" data-fam={view.fam}>
      <div className="pc-band-id">
        <Badge
          shape="stamp"
          className="px-[9px] py-[5px] text-caption text-paper"
          style={{ backgroundColor: STAMP_BG[view.fam] }}
        >
          {view.stampLabel}
        </Badge>
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
            <Button variant="ghost" size="sm" onClick={overlay.onClose}>
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
