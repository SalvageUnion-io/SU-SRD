/**
 * ActiveItemBandFrame — the presentational half of the Active Item band: it
 * renders the bays, gauges, buttons and the resolve overlay from a computed
 * `ActiveItemBandModel`, and knows nothing about rules or the store. The three
 * bands (`MechBand`, `PilotBand`, `CrawlerBand`) each build a model and hand it
 * here; the Ladle story drives it with fixture view-models and no store.
 * `StorageBay` composes overlay bodies.
 */

import { Badge, Button, cn } from 'component-lib'
import type { ReactNode } from 'react'
import { useEscapeKey } from '../../hooks/useEscapeKey'
import type { GaugeTone } from './DashboardGauge'
import { DashboardGauge } from './DashboardGauge'

/** Stable no-op, so the Escape effect doesn't re-bind when no overlay is open. */
const NOOP = () => {}

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
  /** `danger` = destructive styling (Button `variant="danger"`); `go` = the
   * primary "go" key (Button `variant="primary"`). Omit for the default. */
  variant?: 'danger' | 'go'
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
  /**
   * Gauges to keep on screen while the overlay is up.
   *
   * The overlay covers the whole band, so opening "Take Damage" used to hide
   * SP, EP and Heat at exactly the moment you were deciding how much damage to
   * apply — the number you are choosing and the number it changes were never
   * visible together. Pass the gauge the overlay acts on and it stays readable.
   */
  gauges?: BandGauge[]
  body?: ReactNode
  actions?: BandButton[]
}

export type ActiveItemBandModel = {
  fam: 'mech' | 'pilot' | 'crawler'
  /**
   * The band's MOUNT STATE — "Boarded", "On Foot", "Downtime" — not the entity
   * name. The rail directly above already stamps the identity ("Mech · Mule"),
   * and this stamp used to repeat it verbatim, in the same tone, ~40px below:
   * two identical plates stacked, which read as a rendering fault. Identity
   * belongs to the rail; this plate answers the different question of what
   * you are currently driving.
   */
  stampLabel: string
  bays: BandBay[]
  overlay?: BandOverlay | null
}

const STAMP_BG: Record<ActiveItemBandModel['fam'], string> = {
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
      variant={btn.variant === 'danger' ? 'danger' : btn.variant === 'go' ? 'primary' : 'default'}
      size="compact"
      className={cn(full ? 'w-full' : 'min-w-[140px]', btn.wide && 'col-span-2')}
      onClick={btn.onClick}
      disabled={btn.disabled}
      title={btn.title}
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

/** Renders one computed band model. */
export function ActiveItemBandFrame({ view }: { view: ActiveItemBandModel }) {
  const { overlay } = view
  // Escape dismisses the resolve/damage/storage prompt, like every other
  // dismissible surface in the app.
  useEscapeKey(overlay != null, overlay?.onClose ?? NOOP)
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
          // A bay with no gauges (Mount, Egress) has nothing to fill its middle,
          // and the button grid is floor-pinned — so it used to render as a
          // label at the top, a button at the bottom, and a stripe of nothing
          // between, which at 1920 was a third of the band. Flagged so the
          // stylesheet can centre those bays instead.
          <div key={bay.label} className="pc-bay" data-nogauge={!bay.gauges?.length || undefined}>
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
