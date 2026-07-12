/**
 * ActiveItemBand — the Active Item (primary row): the entity you're currently
 * running, laid out as responsibility "bays" (a gauge cluster + its own button
 * grid). Dispatches by mount state (playStateStore): the boarded mech, or the
 * pilot on foot.
 *
 * Phase 5 scope: the reactor / damage / egress buttons are LIVE, driven through
 * the pure rules engine (`playRules.ts` → `lib/rules/*`) and written through the
 * entity store (`update`), under the ADR-007 automation boundary:
 *   - Auto-apply (single click): Push, Heat Check, Vent, Shutdown toggle, the
 *     SP/HP value of a self-declared hit.
 *   - Player-confirmed (explicit extra step): the Critical Damage / Critical
 *     Injury *roll* when a hit hits 0, marking the mech Destroyed, and Eject.
 * `Storage` stays inert until the cargo-hold overlay lands (Phase 7). Derived
 * maxima come from the same `derivedStats` helpers the gauges read.
 */

import { useState } from 'react'
import type { ReactNode } from 'react'

import {
  crawlerMaxSP,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  pilotMaxAP,
  pilotMaxHP,
} from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { describePushOutcome } from '../../lib/rules/coreMechanic'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import type { CriticalDamageEffect, CriticalInjuryEffect } from '../../lib/rules/takeDamage'
import type { Crawler } from '../../lib/schemas/crawler'
import type { CargoLot } from '../../lib/schemas/cargoLot'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import type { EntityState } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { CockpitGauge } from './CockpitGauge'
import {
  VENT_PATCH,
  critDamagePatch,
  critInjuryPatch,
  describeCritDamage,
  describeCritInjury,
  describeHeatCheck,
  heatCheckOncePatch,
  mechDamagePatch,
  pilotDamagePatch,
  pushPatch,
  shutdownTogglePatch,
} from './playRules'

/** The store surface the band needs — injectable so tests can assert patches. */
export type PlayStore = Pick<EntityState, 'get' | 'update'>

type ActiveItemBandProps = {
  mech: Mech
  pilot: Pilot | null
  /** The linked crawler — the Active Item while in Downtime (Phase 6). */
  crawler?: Crawler | null
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

export function ActiveItemBand({ mech, pilot, crawler, store }: ActiveItemBandProps) {
  const mount = usePlayStateStore((s) => s.mount)
  const setMount = usePlayStateStore((s) => s.setMount)
  const leaveDowntime = usePlayStateStore((s) => s.leaveDowntime)
  // Unconditional hook; the prop wins when a stub is injected (tests / harness).
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore

  if (mount === 'downtime' && crawler) {
    return <CrawlerBand crawler={crawler} onLeave={leaveDowntime} />
  }
  if (mount === 'pilot' && pilot) {
    return <PilotBand pilot={pilot} store={s} onBoard={() => setMount('mech')} />
  }
  return (
    <MechBand
      mech={mech}
      store={s}
      hasPilot={pilot !== null}
      onDismount={() => setMount('pilot')}
    />
  )
}

// ---------------------------------------------------------------------------
// Crawler band (Downtime — read-only: the crawler's Structure + Leave control)
// ---------------------------------------------------------------------------

function CrawlerBand({ crawler, onLeave }: { crawler: Crawler; onLeave: () => void }) {
  const maxSP = crawlerMaxSP(crawler)
  const sp = Math.min(crawler.currentSP ?? maxSP, maxSP)
  return (
    <div className="pc-band" data-fam="crawler">
      <div className="pc-band-id">
        <span className="pc-stamp" style={{ background: 'var(--pc-crawler-deep)' }}>
          Downtime · {crawler.name}
        </span>
      </div>
      <div className="pc-bays">
        <div className="pc-bay">
          <span className="pc-bay-lab">Crawler</span>
          <div className="pc-bay-gauges">
            <CockpitGauge label="SP" value={sp} max={maxSP} tone="crawler" />
          </div>
        </div>
        <div className="pc-bay">
          <span className="pc-bay-lab">Downtime</span>
          <div className="pc-btn-grid">
            <button
              type="button"
              className="pc-btn pc-btn-wide"
              onClick={onLeave}
              title="Return to the previous mount"
            >
              ◄ Leave Downtime
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resolve overlay — a small dark panel over the band for roll readouts and the
// player-confirmed steps (never auto-destructive).
// ---------------------------------------------------------------------------

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

function DamageStepper({ amount, setAmount }: { amount: number; setAmount: (n: number) => void }) {
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

// ---------------------------------------------------------------------------
// Mech band
// ---------------------------------------------------------------------------

type MechPrompt =
  | { kind: 'reactor'; log: string; meltdown?: boolean }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalDamageEffect | null; log: string }
  | { kind: 'eject' }
  | { kind: 'storage' }
  | null

// ---------------------------------------------------------------------------
// Cargo-hold overlay (Phase 7) — lists the mech's cargo lots with a Jettison
// affordance. Jettison is irreversible (the cargo is discarded), so per ADR-007
// it is a player-confirmed explicit button, never silent auto-bookkeeping.
// ---------------------------------------------------------------------------

function StorageBay({
  lots,
  used,
  cap,
  onJettison,
}: {
  lots: CargoLot[]
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

function MechBand({
  mech,
  store,
  hasPilot,
  onDismount,
}: {
  mech: Mech
  store: PlayStore
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

  const [prompt, setPrompt] = useState<MechPrompt>(null)
  const [dmg, setDmg] = useState(1)

  const fresh = () => store.get('mech', mech.id) ?? mech

  // Quick Ref p.233 — can't Push if +2 Heat would exceed the Heat Cap.
  const pushLocked = heat + 2 > maxHeat

  function doPush() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis)
    const { patch, effect, nextHeat, meltdown } = pushPatch({
      heat: Math.min(m.currentHeat ?? cap, cap),
      heatCap: cap,
      currentSP: Math.min(m.currentSP ?? spMax, spMax),
      roll: defaultRoll,
    })
    void store.update('mech', mech.id, patch)
    setPrompt({ kind: 'reactor', log: describePushOutcome(nextHeat, effect), meltdown })
  }

  function doHeatCheck() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis)
    const { patch, effect, meltdown } = heatCheckOncePatch({
      heat: Math.min(m.currentHeat ?? cap, cap),
      currentSP: Math.min(m.currentSP ?? spMax, spMax),
      roll: defaultRoll,
    })
    void store.update('mech', mech.id, patch)
    setPrompt({ kind: 'reactor', log: describeHeatCheck(effect), meltdown })
  }

  function doVent() {
    void store.update('mech', mech.id, VENT_PATCH)
    setPrompt({
      kind: 'reactor',
      log: 'Vented — Heat 0, Vulnerable. (Shut down separately if needed.)',
    })
  }

  function doShutdown() {
    void store.update('mech', mech.id, shutdownTogglePatch(fresh().shutdown))
  }

  function applyDamage() {
    const m = fresh()
    // Damage operates on the stored SP (authoritative); default to max only
    // when it was never set. The gauge, not this write, clamps for display.
    const { patch, effect } = mechDamagePatch({
      currentSP: m.currentSP ?? mechMaxSP(m, chassis),
      amount: dmg,
      vulnerable: m.vulnerable ?? false,
    })
    void store.update('mech', mech.id, patch)
    if (effect.criticalDue) {
      setPrompt({ kind: 'crit', effect: null, log: `−${effect.effectiveDamage} SP → 0.` })
    } else {
      setPrompt({ kind: 'reactor', log: `−${effect.effectiveDamage} SP → ${effect.nextSP}.` })
    }
  }

  function rollCritical() {
    const { patch, effect } = critDamagePatch(defaultRoll)
    void store.update('mech', mech.id, patch)
    setPrompt({ kind: 'crit', effect, log: describeCritDamage(effect) })
  }

  function confirmDestroyed() {
    void store.update('mech', mech.id, { destroyed: true })
    setPrompt(null)
  }

  function jettison(lotId: string) {
    const m = fresh()
    void store.update('mech', mech.id, {
      cargoLots: m.cargoLots.filter((lot) => lot.id !== lotId),
    })
  }

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
            <button
              type="button"
              className="pc-btn pc-btn-danger"
              onClick={doPush}
              disabled={pushLocked}
              title={
                pushLocked
                  ? `Can't Push at Heat ${heat}/${maxHeat} — +2 would exceed the Heat Cap (p.233).`
                  : '+2 Heat, then a Heat Check'
              }
            >
              Push
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-danger"
              onClick={doHeatCheck}
              title="Roll a Heat Check at current Heat"
            >
              Heat Chk
            </button>
            <button type="button" className="pc-btn" onClick={doVent} title="Vent Heat to 0">
              Vent
            </button>
            <button
              type="button"
              className="pc-btn"
              onClick={doShutdown}
              title="Toggle reactor shutdown"
            >
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
            <button
              type="button"
              className="pc-btn"
              onClick={() => {
                setDmg(1)
                setPrompt({ kind: 'dmg' })
              }}
              title="Take Structure damage"
            >
              Take Dmg
            </button>
            <button
              type="button"
              className="pc-btn"
              onClick={() => setPrompt({ kind: 'storage' })}
              title="Open the cargo hold"
            >
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
              onClick={() => setPrompt({ kind: 'eject' })}
              disabled={!hasPilot}
              title={hasPilot ? 'Emergency exit' : 'No pilot assigned to this mech'}
            >
              Eject
            </button>
          </div>
        </div>
      </div>

      {prompt?.kind === 'reactor' && (
        <ResolveOverlay title="Reactor" onClose={() => setPrompt(null)}>
          <p className="pc-resolve-log">{prompt.log}</p>
          {prompt.meltdown && (
            <div className="pc-resolve-actions">
              <button type="button" className="pc-btn pc-btn-danger" onClick={confirmDestroyed}>
                Confirm Meltdown — Mark Mech Destroyed
              </button>
            </div>
          )}
        </ResolveOverlay>
      )}
      {prompt?.kind === 'dmg' && (
        <ResolveOverlay title="Take Structure Damage" onClose={() => setPrompt(null)}>
          <DamageStepper amount={dmg} setAmount={setDmg} />
          <div className="pc-resolve-actions">
            <button type="button" className="pc-btn pc-btn-danger" onClick={applyDamage}>
              Apply −{dmg} SP
            </button>
          </div>
        </ResolveOverlay>
      )}
      {prompt?.kind === 'crit' && (
        <ResolveOverlay title="Critical Damage" onClose={() => setPrompt(null)}>
          <p className="pc-resolve-log">{prompt.log}</p>
          {prompt.effect === null ? (
            <div className="pc-resolve-actions">
              <button type="button" className="pc-btn pc-btn-danger" onClick={rollCritical}>
                Roll Critical Damage
              </button>
            </div>
          ) : (
            prompt.effect.destroyed && (
              <div className="pc-resolve-actions">
                <button type="button" className="pc-btn pc-btn-danger" onClick={confirmDestroyed}>
                  Mark Mech Destroyed
                </button>
              </div>
            )
          )}
        </ResolveOverlay>
      )}
      {prompt?.kind === 'storage' && (
        <ResolveOverlay title="Cargo Hold" onClose={() => setPrompt(null)}>
          <StorageBay
            lots={fresh().cargoLots}
            used={totalLotUnits(fresh().cargoLots)}
            cap={maxCargo}
            onJettison={jettison}
          />
        </ResolveOverlay>
      )}
      {prompt?.kind === 'eject' && (
        <ResolveOverlay title="Eject" onClose={() => setPrompt(null)}>
          <p className="pc-resolve-log">Eject the pilot from the mech?</p>
          <div className="pc-resolve-actions">
            <button
              type="button"
              className="pc-btn pc-btn-danger"
              onClick={() => {
                setPrompt(null)
                onDismount()
              }}
            >
              Confirm Eject
            </button>
          </div>
        </ResolveOverlay>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pilot band
// ---------------------------------------------------------------------------

type PilotPrompt =
  | { kind: 'log'; log: string }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalInjuryEffect | null; log: string }
  | null

function PilotBand({
  pilot,
  store,
  onBoard,
}: {
  pilot: Pilot
  store: PlayStore
  onBoard: () => void
}) {
  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const maxAP = Math.max(0, pilotMaxAP(pilot))
  const hp = Math.min(pilot.currentHP ?? maxHP, maxHP)
  const ap = Math.min(pilot.currentAP ?? maxAP, maxAP)

  const [prompt, setPrompt] = useState<PilotPrompt>(null)
  const [dmg, setDmg] = useState(1)

  const fresh = () => store.get('pilot', pilot.id) ?? pilot

  function applyDamage() {
    const p = fresh()
    const { patch, effect } = pilotDamagePatch({
      currentHP: p.currentHP ?? Math.max(0, pilotMaxHP(p)),
      amount: dmg,
      vulnerable: false,
    })
    void store.update('pilot', pilot.id, patch)
    if (effect.criticalDue) {
      setPrompt({ kind: 'crit', effect: null, log: `−${effect.effectiveDamage} HP → 0.` })
    } else {
      setPrompt({ kind: 'log', log: `−${effect.effectiveDamage} HP → ${effect.nextHP}.` })
    }
  }

  function rollInjury() {
    const { patch, effect } = critInjuryPatch(defaultRoll)
    void store.update('pilot', pilot.id, patch)
    setPrompt({ kind: 'crit', effect, log: describeCritInjury(effect) })
  }

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
            <button
              type="button"
              className="pc-btn"
              onClick={() => {
                setDmg(1)
                setPrompt({ kind: 'dmg' })
              }}
              title="Take HP damage"
            >
              Take Dmg
            </button>
            <button
              type="button"
              className="pc-btn pc-btn-danger"
              onClick={() =>
                setPrompt({ kind: 'crit', effect: null, log: 'Roll a Critical Injury?' })
              }
              title="Roll on the Critical Injury table"
            >
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

      {prompt?.kind === 'log' && (
        <ResolveOverlay title="Vitals" onClose={() => setPrompt(null)}>
          <p className="pc-resolve-log">{prompt.log}</p>
        </ResolveOverlay>
      )}
      {prompt?.kind === 'dmg' && (
        <ResolveOverlay title="Take Damage" onClose={() => setPrompt(null)}>
          <DamageStepper amount={dmg} setAmount={setDmg} />
          <div className="pc-resolve-actions">
            <button type="button" className="pc-btn pc-btn-danger" onClick={applyDamage}>
              Apply −{dmg} HP
            </button>
          </div>
        </ResolveOverlay>
      )}
      {prompt?.kind === 'crit' && (
        <ResolveOverlay title="Critical Injury" onClose={() => setPrompt(null)}>
          <p className="pc-resolve-log">{prompt.log}</p>
          {prompt.effect === null && (
            <div className="pc-resolve-actions">
              <button type="button" className="pc-btn pc-btn-danger" onClick={rollInjury}>
                Roll Critical Injury
              </button>
            </div>
          )}
        </ResolveOverlay>
      )}
    </div>
  )
}
