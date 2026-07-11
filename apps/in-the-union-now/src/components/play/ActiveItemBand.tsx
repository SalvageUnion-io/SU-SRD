/**
 * ActiveItemBand — the Active Item (primary row): the entity you're currently
 * running, laid out as responsibility "bays" (a gauge cluster + its own button
 * grid). Dispatches by mount state (playStateStore): the boarded mech, or the
 * pilot on foot.
 *
 * Phase 2 scope: gauges are bound to the real live stats (currentSP/EP/Heat/HP/
 * AP + derived maxima) and are read-only; only the mount transitions
 * (Board / Dismount / Eject) mutate anything. The heat/damage/action buttons
 * are present but disabled — they get wired to the rules engine in Phase 5,
 * under the ADR-007 automation boundary.
 */

import {
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { usePlayStateStore } from '../../stores/playStateStore'
import { CockpitGauge } from './CockpitGauge'

const PHASE5 = 'Wired to the rules engine in a later phase'

type ActiveItemBandProps = {
  mech: Mech
  pilot: Pilot | null
}

export function ActiveItemBand({ mech, pilot }: ActiveItemBandProps) {
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)

  if (mount === 'pilot' && pilot) {
    return <PilotBand pilot={pilot} onBoard={() => setMount('mech')} />
  }
  return <MechBand mech={mech} hasPilot={pilot !== null} onDismount={() => setMount('pilot')} />
}

function MechBand({
  mech,
  hasPilot,
  onDismount,
}: {
  mech: Mech
  hasPilot: boolean
  onDismount: () => void
}) {
  const chassis = resolveChassisRef(mech.chassisRef)
  const maxSP = mechMaxSP(mech, chassis)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis)
  const sp = Math.min(mech.currentSP ?? maxSP, maxSP)
  const ep = Math.min(mech.currentEP ?? maxEP, maxEP)
  const heat = Math.min(mech.currentHeat ?? maxHeat, maxHeat)
  const cargo = totalLotUnits(mech.cargoLots)

  return (
    <div className="pc-band" data-fam="mech">
      <div className="pc-band-id">
        <span className="pc-stamp pc-stamp-mech">Mech · {mech.name}</span>
      </div>
      <div className="pc-bays">
        <div className="pc-bay">
          <span className="pc-bay-lab">Reactor</span>
          <div className="pc-bay-gauges">
            <CockpitGauge
              label="Heat"
              value={heat}
              max={maxHeat}
              tone="mech"
              danger={Math.max(0, maxHeat - 2)}
            />
            <CockpitGauge label="EP" value={ep} max={maxEP} tone="mech" />
          </div>
          <div className="pc-btn-grid">
            <button type="button" className="pc-btn pc-btn-danger" disabled title={PHASE5}>
              Push
            </button>
            <button type="button" className="pc-btn pc-btn-danger" disabled title={PHASE5}>
              Heat Chk
            </button>
            <button type="button" className="pc-btn" disabled title={PHASE5}>
              Vent
            </button>
            <button type="button" className="pc-btn" disabled title={PHASE5}>
              Shutdn
            </button>
          </div>
        </div>
        <div className="pc-bay">
          <span className="pc-bay-lab">Chassis</span>
          <div className="pc-bay-gauges">
            <CockpitGauge label="SP" value={sp} max={maxSP} tone="mech" />
            <CockpitGauge label="Cargo" value={cargo} max={maxCargo} tone="mech" />
          </div>
          <div className="pc-btn-grid">
            <button type="button" className="pc-btn" disabled title={PHASE5}>
              Take Dmg
            </button>
            <button type="button" className="pc-btn" disabled title={PHASE5}>
              Storage
            </button>
          </div>
        </div>
        <div className="pc-bay">
          <span className="pc-bay-lab">Egress</span>
          <div className="pc-btn-grid">
            <button
              type="button"
              className="pc-btn"
              onClick={onDismount}
              disabled={!hasPilot}
              title={hasPilot ? 'Exit the mech (calm)' : 'No pilot assigned to this mech'}
            >
              Dismount
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-danger"
              onClick={onDismount}
              disabled={!hasPilot}
              title={hasPilot ? 'Emergency exit' : 'No pilot assigned to this mech'}
            >
              Eject
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PilotBand({ pilot, onBoard }: { pilot: Pilot; onBoard: () => void }) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)

  return (
    <div className="pc-band" data-fam="pilot">
      <div className="pc-band-id">
        <span className="pc-stamp" style={{ background: 'var(--pc-pilot-deep)' }}>
          Pilot · {pilot.name}
        </span>
      </div>
      <div className="pc-bays">
        <div className="pc-bay">
          <span className="pc-bay-lab">Vitals</span>
          <div className="pc-bay-gauges">
            <CockpitGauge label="HP" value={hp} max={maxHP} tone="pilot" />
            <CockpitGauge label="AP" value={ap} max={maxAP} tone="pilot" />
          </div>
          <div className="pc-btn-grid">
            <button type="button" className="pc-btn" disabled title={PHASE5}>
              Take Dmg
            </button>
            <button type="button" className="pc-btn pc-btn-danger" disabled title={PHASE5}>
              Crit Injury
            </button>
          </div>
        </div>
        <div className="pc-bay">
          <span className="pc-bay-lab">Mount</span>
          <div className="pc-btn-grid">
            <button
              type="button"
              className="pc-btn pc-btn-go pc-btn-wide"
              onClick={onBoard}
              title="Board the mech"
            >
              ▶ Board Mech
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
