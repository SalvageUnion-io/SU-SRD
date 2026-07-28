/**
 * ActiveItemBand (ITUN binding) — the Active Item (primary row) rules + store
 * logic, per band (mech / pilot / crawler). Dispatches by mount state
 * (playStateStore), runs the reactor / damage / egress verbs through the pure
 * rules engine (`dashboardRules.ts` → `lib/rules/*`) and the entity store under
 * the ADR-007 automation boundary, then hands a pure view-model to the
 * presentational ActiveItemBand in component-lib.
 *
 *   - Auto-apply (single click): Push, Heat Check, Vent, Shutdown toggle, the
 *     SP/HP value of a self-declared hit.
 *   - Player-confirmed (explicit extra step): the Critical Damage / Critical
 *     Injury *roll* when a hit hits 0, marking the mech Destroyed, and Eject.
 */

import { useEffect, useState } from 'react'

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
import { resolveChassisRef } from 'salvageunion-reference/rules'
import type { CriticalDamageEffect, CriticalInjuryEffect } from '../../lib/rules/takeDamage'
import type { Crawler } from '../../lib/schemas/crawler'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import type { EntityState } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { ActiveItemBand as ActiveItemBandView, CountStepper, StorageBay } from 'component-lib'
import type { ActiveItemBandView as ActiveItemBandViewModel, BandButton } from 'component-lib'
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
} from './dashboardRules'

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
  const view: ActiveItemBandViewModel = {
    fam: 'crawler',
    stampLabel: 'Downtime',
    bays: [
      {
        label: 'Crawler',
        gauges: [{ label: 'SP', value: sp, max: maxSP, tone: 'crawler' }],
        buttons: [],
      },
      {
        label: 'Downtime',
        buttons: [
          {
            label: '◄ Leave Downtime',
            onClick: onLeave,
            wide: true,
            title: 'Return to the previous mount',
          },
        ],
      },
    ],
  }
  return <ActiveItemBandView view={view} />
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
  const heat = Math.min(mech.currentHeat ?? 0, maxHeat)
  const cargo = totalLotUnits(mech.cargoLots)

  const [prompt, setPrompt] = useState<MechPrompt>(null)
  const [dmg, setDmg] = useState(1)

  // The deck's Apply step routes a destructive Cascade Failure here: open the
  // Take-Structure-Damage overlay pre-armed for the player to confirm (ADR-007).
  const damagePromptArmed = usePlayStateStore((st) => st.damagePromptArmed)
  const consumeDamagePrompt = usePlayStateStore((st) => st.consumeDamagePrompt)
  useEffect(() => {
    if (damagePromptArmed) {
      setPrompt({ kind: 'dmg' })
      consumeDamagePrompt()
    }
  }, [damagePromptArmed, consumeDamagePrompt])

  const fresh = () => store.get('mech', mech.id) ?? mech

  // Quick Ref p.233 — can't Push if +2 Heat would exceed the Heat Cap.
  const pushLocked = heat + 2 > maxHeat

  function doPush() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis)
    const { patch, effect, nextHeat, meltdown } = pushPatch({
      heat: Math.min(m.currentHeat ?? 0, cap),
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
      heat: Math.min(m.currentHeat ?? 0, cap),
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

  const overlay = ((): ActiveItemBandViewModel['overlay'] => {
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'reactor') {
      return {
        title: 'Reactor',
        onClose,
        body: <p className="pc-resolve-log">{prompt.log}</p>,
        actions: prompt.meltdown
          ? [
              {
                label: 'Confirm Meltdown — Mark Mech Destroyed',
                onClick: confirmDestroyed,
                variant: 'danger',
              },
            ]
          : undefined,
      }
    }
    if (prompt.kind === 'dmg') {
      return {
        title: 'Take Structure Damage',
        onClose,
        // Keep the gauge being edited on screen (see BandOverlay.gauges).
        gauges: [{ label: 'SP', value: sp, max: maxSP, tone: 'mech' }],
        body: (
          <CountStepper
            count={dmg}
            onChange={setDmg}
            subject="damage point"
            min={1}
            surface="instrument"
          />
        ),
        actions: [{ label: `Apply −${dmg} SP`, onClick: applyDamage, variant: 'go' }],
      }
    }
    if (prompt.kind === 'crit') {
      // Annotated: without it TS widens `variant` to `string` in this
      // intermediate const, which no longer satisfies BandButton's
      // `'danger' | 'go'` union (the two mutually-exclusive booleans it replaced
      // couldn't catch this class of mistake at all).
      const actions: BandButton[] | undefined =
        prompt.effect === null
          ? [{ label: 'Roll Critical Damage', onClick: rollCritical, variant: 'danger' }]
          : prompt.effect.destroyed
            ? [{ label: 'Mark Mech Destroyed', onClick: confirmDestroyed, variant: 'danger' }]
            : undefined
      return {
        title: 'Critical Damage',
        onClose,
        body: <p className="pc-resolve-log">{prompt.log}</p>,
        actions,
      }
    }
    if (prompt.kind === 'storage') {
      return {
        title: 'Cargo Hold',
        onClose,
        body: (
          <StorageBay
            lots={fresh().cargoLots}
            used={totalLotUnits(fresh().cargoLots)}
            cap={maxCargo}
            onJettison={jettison}
          />
        ),
      }
    }
    // eject
    return {
      title: 'Eject',
      onClose,
      body: <p className="pc-resolve-log">Eject the pilot from the mech?</p>,
      actions: [
        {
          label: 'Confirm Eject',
          onClick: () => {
            setPrompt(null)
            onDismount()
          },
          variant: 'danger',
        },
      ],
    }
  })()

  const view: ActiveItemBandViewModel = {
    fam: 'mech',
    stampLabel: 'Boarded',
    bays: [
      {
        label: 'Reactor',
        gauges: [
          {
            label: 'Heat',
            value: heat,
            max: maxHeat,
            tone: 'mech',
            danger: Math.max(0, maxHeat - 2),
          },
          { label: 'EP', value: ep, max: maxEP, tone: 'mech' },
        ],
        buttons: [
          {
            label: 'Push',
            onClick: doPush,
            disabled: pushLocked,
            variant: 'go',
            title: pushLocked
              ? `Can't Push at Heat ${heat}/${maxHeat} — +2 would exceed the Heat Cap (p.233).`
              : '+2 Heat, then a Heat Check',
          },
          {
            label: 'Heat Chk',
            onClick: doHeatCheck,
            variant: 'go',
            title: 'Roll a Heat Check at current Heat',
          },
          { label: 'Vent', onClick: doVent, variant: 'go', title: 'Vent Heat to 0' },
          { label: 'Shutdn', onClick: doShutdown, title: 'Toggle reactor shutdown' },
        ],
      },
      {
        label: 'Chassis',
        gauges: [
          { label: 'SP', value: sp, max: maxSP, tone: 'mech' },
          { label: 'Cargo', value: cargo, max: maxCargo, tone: 'mech' },
        ],
        buttons: [
          {
            label: 'Take Dmg',
            onClick: () => {
              setDmg(1)
              setPrompt({ kind: 'dmg' })
            },
            title: 'Take Structure damage',
          },
          {
            label: 'Storage',
            onClick: () => setPrompt({ kind: 'storage' }),
            title: 'Open the cargo hold',
          },
        ],
      },
      {
        label: 'Egress',
        buttons: [
          {
            label: 'Dismount',
            onClick: onDismount,
            disabled: !hasPilot,
            variant: 'go',
            title: hasPilot ? 'Exit the mech (calm)' : 'No pilot assigned to this mech',
          },
          {
            label: 'Eject',
            onClick: () => setPrompt({ kind: 'eject' }),
            disabled: !hasPilot,
            variant: 'danger',
            title: hasPilot ? 'Emergency exit' : 'No pilot assigned to this mech',
          },
        ],
      },
    ],
    overlay,
  }
  return <ActiveItemBandView view={view} />
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

  // On-foot: the deck's Apply routes a destructive Cascade Failure here — open
  // the Take-HP-Damage overlay pre-armed for the player to confirm (ADR-007).
  const damagePromptArmed = usePlayStateStore((st) => st.damagePromptArmed)
  const consumeDamagePrompt = usePlayStateStore((st) => st.consumeDamagePrompt)
  useEffect(() => {
    if (damagePromptArmed) {
      setPrompt({ kind: 'dmg' })
      consumeDamagePrompt()
    }
  }, [damagePromptArmed, consumeDamagePrompt])

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

  const overlay = ((): ActiveItemBandViewModel['overlay'] => {
    if (!prompt) return null
    const onClose = () => setPrompt(null)
    if (prompt.kind === 'log') {
      return { title: 'Vitals', onClose, body: <p className="pc-resolve-log">{prompt.log}</p> }
    }
    if (prompt.kind === 'dmg') {
      return {
        title: 'Take Damage',
        onClose,
        // Keep the gauge being edited on screen (see BandOverlay.gauges).
        gauges: [{ label: 'HP', value: hp, max: maxHP, tone: 'pilot' }],
        body: (
          <CountStepper
            count={dmg}
            onChange={setDmg}
            subject="damage point"
            min={1}
            surface="instrument"
          />
        ),
        actions: [{ label: `Apply −${dmg} HP`, onClick: applyDamage, variant: 'go' }],
      }
    }
    // crit
    return {
      title: 'Critical Injury',
      onClose,
      body: <p className="pc-resolve-log">{prompt.log}</p>,
      actions:
        prompt.effect === null
          ? [{ label: 'Roll Critical Injury', onClick: rollInjury, variant: 'danger' }]
          : undefined,
    }
  })()

  const view: ActiveItemBandViewModel = {
    fam: 'pilot',
    stampLabel: 'On Foot',
    bays: [
      {
        label: 'Vitals',
        gauges: [
          { label: 'HP', value: hp, max: maxHP, tone: 'pilot' },
          { label: 'AP', value: ap, max: maxAP, tone: 'pilot' },
        ],
        buttons: [
          {
            label: 'Take Dmg',
            onClick: () => {
              setDmg(1)
              setPrompt({ kind: 'dmg' })
            },
            title: 'Take HP damage',
          },
          {
            label: 'Crit Injury',
            onClick: () =>
              setPrompt({ kind: 'crit', effect: null, log: 'Roll a Critical Injury?' }),
            variant: 'danger',
            title: 'Roll on the Critical Injury table',
          },
        ],
      },
      {
        label: 'Mount',
        buttons: [
          {
            label: '▶ Board Mech',
            onClick: onBoard,
            variant: 'go',
            wide: true,
            title: 'Board the mech',
          },
        ],
      },
    ],
    overlay,
  }
  return <ActiveItemBandView view={view} />
}
