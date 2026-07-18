/**
 * Legacy "before" capture — ITUN Dashboard `ActiveItemBand` (the primary row).
 *
 * Reproduces the band's presentational shell from
 * apps/in-the-union-now/src/components/dashboard/ActiveItemBand.tsx VERBATIM —
 * the responsibility "bays" (a label + gauge cluster + button grid) for the
 * mech, pilot and crawler (Downtime) mounts, plus the `.pc-resolve` overlay
 * chrome (reactor log + confirm action) and the `.pc-cargo` storage-hold body.
 * The bespoke `DashboardGauge` markup is reproduced inline (it is part of the
 * band's chrome). The `DamageStepper` sub-control is captured separately in
 * LegacyDamageStepper and is intentionally NOT reproduced here.
 *
 * The rules/store plumbing (`dashboardRules`, entityStore, playState) is
 * collapsed to local state; real game data drives the gauge maxima and the
 * cargo-hold rows (real `SalvageUnionReference.Equipment`). L1 reconciliation:
 * freeze the "before", do not refactor the raw markup.
 */

import type { Story } from '@ladle/react'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { Caption } from '../../_harness'
import './LegacyActiveItemBand.css'

// --- Verbatim reproduction of DashboardGauge.tsx (the band's dark instrument) ---
type GaugeTone = 'mech' | 'pilot' | 'crawler'
const TONES: Record<GaugeTone, [string, string]> = {
  mech: ['var(--pc-mech)', 'var(--pc-mech-deep)'],
  pilot: ['var(--pc-pilot)', 'var(--pc-pilot-deep)'],
  crawler: ['var(--pc-crawler)', 'var(--pc-crawler-deep)'],
}

function DashboardGauge({
  label,
  value,
  max,
  tone = 'mech',
  danger,
}: {
  label: string
  value: number
  max: number
  tone?: GaugeTone
  danger?: number
}) {
  const total = Math.max(max, value, 0)
  const [t, td] = TONES[tone]
  const segs: ReactNode[] = []
  for (let i = 0; i < total; i++) {
    const filled = i < value
    const isDanger = danger !== undefined && i >= danger
    let cls = 'pc-seg'
    if (filled) cls += isDanger ? ' danger' : ' on'
    segs.push(<span key={i} className={cls} />)
  }
  const style = { '--pc-gtone': t, '--pc-gtone-deep': td } as CSSProperties
  return (
    <div className="pc-gauge" style={style} role="img" aria-label={`${label} ${value} of ${max}`}>
      <span className="pc-gauge-lab">{label}</span>
      <div className="pc-gauge-track">{segs}</div>
      <span className="pc-gauge-num">
        {value}/{max}
      </span>
    </div>
  )
}

/** Verbatim reproduction of ActiveItemBand's ResolveOverlay chrome. */
function ResolveOverlay({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="pc-resolve" role="dialog" aria-label={title}>
      <div className="pc-resolve-head">
        <span className="pc-resolve-title">{title}</span>
        <button type="button" className="pc-railbtn" onClick={onClose}>
          Close
        </button>
      </div>
      <div className="pc-resolve-body">{children}</div>
    </div>
  )
}

/** Dark primary-row stage that stands in for the Dashboard's `pc-primary` cell. */
function BandFrame({ children }: { children: ReactNode }) {
  return (
    <div
      className="pc-root"
      style={{
        background: 'var(--pc-ground)',
        width: 720,
        height: 168,
        padding: 8,
        borderRadius: 5,
      }}
    >
      {children}
    </div>
  )
}

// biome-ignore lint/style/useComponentExportOnlyModules: Ladle stories require a default meta export alongside story components
export default { title: 'Legacy/Dashboard/Active Item Band' }

/** MechBand (default mount) — Reactor / Chassis / Egress bays. */
export const Mech: Story = () => {
  const [prompt, setPrompt] = useState<'reactor' | 'cargo' | null>(null)
  // Real cargo rows so the storage-hold body renders production content.
  const equipment = SalvageUnionReference.Equipment.all().slice(0, 3)
  const lots = equipment.map((e, i) => ({
    id: `${i}`,
    code: `C${i + 1}`,
    name: (e as unknown as { name: string }).name,
    units: i + 1,
  }))
  const used = lots.reduce((n, l) => n + l.units, 0)

  return (
    <div style={{ maxWidth: 760 }}>
      <Caption>
        ActiveItemBand · MechBand — Reactor (Heat redline + EP, Push/Heat Chk/Vent/Shutdn), Chassis
        (SP + Cargo, Take Dmg/Storage), Egress (Dismount/Eject). Take Dmg opens the DamageStepper
        (captured separately). Buttons open the `pc-resolve` overlay.
      </Caption>
      <BandFrame>
        <div className="pc-band" data-fam="mech">
          <div className="pc-band-id">
            <span className="pc-stamp pc-stamp-mech">Mech · Iron Mongrel</span>
          </div>
          <div className="pc-bays">
            <div className="pc-bay">
              <span className="pc-bay-lab">Reactor</span>
              <div className="pc-bay-gauges">
                <DashboardGauge label="Heat" value={4} max={6} tone="mech" danger={4} />
                <DashboardGauge label="EP" value={3} max={5} tone="mech" />
              </div>
              <div className="pc-btn-grid">
                <button
                  type="button"
                  className="pc-btn pc-btn-danger"
                  onClick={() => setPrompt('reactor')}
                  title="+2 Heat, then a Heat Check"
                >
                  Push
                </button>
                <button
                  type="button"
                  className="pc-btn pc-btn-danger"
                  onClick={() => setPrompt('reactor')}
                  title="Roll a Heat Check at current Heat"
                >
                  Heat Chk
                </button>
                <button
                  type="button"
                  className="pc-btn"
                  onClick={() => setPrompt('reactor')}
                  title="Vent Heat to 0"
                >
                  Vent
                </button>
                <button type="button" className="pc-btn" title="Toggle reactor shutdown">
                  Shutdn
                </button>
              </div>
            </div>
            <div className="pc-bay">
              <span className="pc-bay-lab">Chassis</span>
              <div className="pc-bay-gauges">
                <DashboardGauge label="SP" value={8} max={10} tone="mech" />
                <DashboardGauge label="Cargo" value={used} max={6} tone="mech" />
              </div>
              <div className="pc-btn-grid">
                <button type="button" className="pc-btn" title="Take Structure damage">
                  Take Dmg
                </button>
                <button
                  type="button"
                  className="pc-btn"
                  onClick={() => setPrompt('cargo')}
                  title="Open the cargo hold"
                >
                  Storage
                </button>
              </div>
            </div>
            <div className="pc-bay">
              <span className="pc-bay-lab">Egress</span>
              <div className="pc-btn-grid">
                <button type="button" className="pc-btn" title="Exit the mech (calm)">
                  Dismount
                </button>
                <button type="button" className="pc-btn pc-btn-danger" title="Emergency exit">
                  Eject
                </button>
              </div>
            </div>
          </div>

          {prompt === 'reactor' && (
            <ResolveOverlay title="Reactor" onClose={() => setPrompt(null)}>
              <p className="pc-resolve-log">
                Vented — Heat 0, Vulnerable. (Shut down separately if needed.)
              </p>
            </ResolveOverlay>
          )}
          {prompt === 'cargo' && (
            <ResolveOverlay title="Cargo Hold" onClose={() => setPrompt(null)}>
              <div className="pc-cargo">
                <p className="pc-cargo-usage">Hold {used}/6</p>
                <ul className="pc-cargo-list">
                  {lots.map((lot) => (
                    <li key={lot.id} className="pc-cargo-row">
                      <span className="pc-cargo-name">
                        <span className="pc-cargo-code">{lot.code}</span>
                        {lot.name}
                        <span className="pc-cargo-units">{lot.units}u</span>
                      </span>
                      <button
                        type="button"
                        className="pc-btn pc-btn-danger"
                        aria-label={`Jettison ${lot.name}`}
                      >
                        Jettison
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </ResolveOverlay>
          )}
        </div>
      </BandFrame>
    </div>
  )
}

/** PilotBand (on foot) — Vitals + Mount bays. */
export const Pilot: Story = () => (
  <div style={{ maxWidth: 760 }}>
    <Caption>
      ActiveItemBand · PilotBand — Vitals (HP + AP, Take Dmg/Crit Injury) and the pilot-tone Board
      Mech go-button.
    </Caption>
    <BandFrame>
      <div className="pc-band" data-fam="pilot">
        <div className="pc-band-id">
          <span className="pc-stamp" style={{ background: 'var(--pc-pilot-deep)' }}>
            Pilot · Vasquez
          </span>
        </div>
        <div className="pc-bays">
          <div className="pc-bay">
            <span className="pc-bay-lab">Vitals</span>
            <div className="pc-bay-gauges">
              <DashboardGauge label="HP" value={7} max={10} tone="pilot" />
              <DashboardGauge label="AP" value={4} max={6} tone="pilot" />
            </div>
            <div className="pc-btn-grid">
              <button type="button" className="pc-btn" title="Take HP damage">
                Take Dmg
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-danger"
                title="Roll on the Critical Injury table"
              >
                Crit Injury
              </button>
            </div>
          </div>
          <div className="pc-bay">
            <span className="pc-bay-lab">Mount</span>
            <div className="pc-btn-grid">
              <button type="button" className="pc-btn pc-btn-go pc-btn-wide" title="Board the mech">
                ▶ Board Mech
              </button>
            </div>
          </div>
        </div>
      </div>
    </BandFrame>
  </div>
)

/** CrawlerBand (Downtime) — read-only Structure + Leave control. */
export const CrawlerDowntime: Story = () => (
  <div style={{ maxWidth: 760 }}>
    <Caption>
      ActiveItemBand · CrawlerBand (Downtime) — the crawler Structure gauge and the wide Leave
      Downtime control.
    </Caption>
    <BandFrame>
      <div className="pc-band" data-fam="crawler">
        <div className="pc-band-id">
          <span className="pc-stamp" style={{ background: 'var(--pc-crawler-deep)' }}>
            Downtime · Rust Wagon
          </span>
        </div>
        <div className="pc-bays">
          <div className="pc-bay">
            <span className="pc-bay-lab">Crawler</span>
            <div className="pc-bay-gauges">
              <DashboardGauge label="SP" value={18} max={25} tone="crawler" />
            </div>
          </div>
          <div className="pc-bay">
            <span className="pc-bay-lab">Downtime</span>
            <div className="pc-btn-grid">
              <button
                type="button"
                className="pc-btn pc-btn-wide"
                title="Return to the previous mount"
              >
                ◄ Leave Downtime
              </button>
            </div>
          </div>
        </div>
      </div>
    </BandFrame>
  </div>
)
