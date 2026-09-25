/**
 * MechBand — the Active Item while Boarded: the Reactor (Push, Heat Check,
 * Vent, Shutdown), the Chassis (Take Damage, the cargo hold), any activatable
 * effects, and Egress (Dismount, Eject).
 *
 * ADR-007 automation boundary: Push, Heat Check, Vent, Shutdown and the SP value
 * of a self-declared hit auto-apply on a single click; the Critical Damage roll
 * when a hit reaches 0, marking the mech Destroyed, and Eject each take an
 * explicit extra step.
 */

import type { StepRule } from 'component-lib'
import { CountStepper, RuleBrief } from 'component-lib'
import { useEffect, useState } from 'react'
import {
  resolveChassisRef,
  resolveGauge,
  resolvePool,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { describePushOutcome } from '../../lib/rules/coreMechanic'
import { mechMaxCargo, mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { pilotingContext } from '../../lib/rules/pilotingContext'
import type { CriticalDamageEffect } from '../../lib/rules/takeDamage'
import { runWrite } from '../../lib/runWrite'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import { usePlayStateStore } from '../../stores/playStateStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { PlayStore } from './ActiveItemBand'
import type { ActiveItemBandModel, BandButton } from './ActiveItemBandFrame'
import { ActiveItemBandFrame, StorageBay } from './ActiveItemBandFrame'
import { activatableEffects } from './dashboardEffects'
import {
  critDamagePatch,
  describeCritDamage,
  describeHeatCheck,
  heatCheckOncePatch,
  mechDamagePatch,
  pushPatch,
  shutdownTogglePatch,
  VENT_PATCH,
} from './dashboardRules'

type MechPrompt =
  | { kind: 'reactor'; log: string; meltdown?: boolean }
  | { kind: 'dmg' }
  | { kind: 'crit'; effect: CriticalDamageEffect | null; log: string }
  | { kind: 'eject' }
  | { kind: 'storage' }
  | null

/**
 * Rules a blocked Guided-Play control explains when the player reaches for it
 * (ADR-021 — the guided modes teach as they enforce).
 *
 * Paraphrased with a citation, matching the wizards' RuleBrief contract; the
 * numbers are interpolated so the brief describes THIS mech's situation rather
 * than the rule in the abstract.
 */
const PUSH_RULE = (heat: number, cap: number): StepRule => ({
  rule: `Pushing adds 2 Heat before the roll, and a Mech can never exceed its Heat Cap. This Mech is at ${heat}/${cap} Heat, so a Push would take it past the Cap — vent or take a Heat Check first.`,
  cite: 'Quick Ref · p.233',
})

export function MechBand({
  mech,
  store,
  hasPilot,
  pilotAbilities,
  onDismount,
}: {
  mech: Mech
  /** Beefcake raises the piloted MECH's Max SP and Cargo (ADR-029). */
  pilotAbilities?: string[]
  store: PlayStore
  hasPilot: boolean
  onDismount: () => void
}) {
  const chassis = resolveChassisRef(mech.chassisRef)
  const activeEffects = usePlayStateStore((st) => st.activeEffects)
  const toggleEffect = usePlayStateStore((st) => st.toggleEffect)
  const piloting = { ...pilotingContext(mech, pilotAbilities), active: activeEffects }
  // What this mech/pilot could switch on (F1). Manual expiry: the table keeps
  // time, the app keeps state.
  const activatable = activatableEffects(mech, pilotAbilities)
  const maxSP = mechMaxSP(mech, chassis, piloting)
  const maxEP = mechMaxEP(mech, chassis)
  const maxHeat = mechMaxHeat(mech, chassis)
  const maxCargo = mechMaxCargo(mech, chassis, piloting)
  const sp = resolvePool(mech.currentSP, maxSP)
  const ep = resolvePool(mech.currentEP, maxEP)
  const heat = resolveGauge(mech.currentHeat, maxHeat)
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

  // The rule a blocked control explains when the player reaches for it.
  const [blocked, setBlocked] = useState<StepRule | null>(null)

  function doPush() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis, piloting)
    const { patch, effect, nextHeat, meltdown } = pushPatch({
      heat: resolveGauge(m.currentHeat, cap),
      heatCap: cap,
      currentSP: resolvePoolStart(m.currentSP, spMax),
      roll: defaultRoll,
    })
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'reactor', log: describePushOutcome(nextHeat, effect), meltdown })
    )
  }

  function doHeatCheck() {
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis, piloting)
    const { patch, effect, meltdown } = heatCheckOncePatch({
      heat: resolveGauge(m.currentHeat, cap),
      currentSP: resolvePoolStart(m.currentSP, spMax),
      roll: defaultRoll,
    })
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'reactor', log: describeHeatCheck(effect), meltdown })
    )
  }

  function doVent() {
    runWrite(
      () => store.update('mech', mech.id, VENT_PATCH, DASHBOARD_TXN),
      () =>
        setPrompt({
          kind: 'reactor',
          log: 'Vented — Heat 0, Vulnerable. (Shut down separately if needed.)',
        })
    )
  }

  function doShutdown() {
    runWrite(() =>
      store.update('mech', mech.id, shutdownTogglePatch(fresh().shutdown), DASHBOARD_TXN)
    )
  }

  function applyDamage() {
    const m = fresh()
    // Damage operates on the stored SP (authoritative); default to max only
    // when it was never set. The gauge, not this write, clamps for display.
    const { patch, effect } = mechDamagePatch({
      currentSP: resolvePoolStart(m.currentSP, mechMaxSP(m, chassis, piloting)),
      amount: dmg,
      vulnerable: m.vulnerable ?? false,
    })
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () =>
        setPrompt(
          effect.criticalDue
            ? { kind: 'crit', effect: null, log: `−${effect.effectiveDamage} SP → 0.` }
            : { kind: 'reactor', log: `−${effect.effectiveDamage} SP → ${effect.nextSP}.` }
        )
    )
  }

  function rollCritical() {
    const { patch, effect } = critDamagePatch(defaultRoll)
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'crit', effect, log: describeCritDamage(effect) })
    )
  }

  function confirmDestroyed() {
    runWrite(
      () => store.update('mech', mech.id, { destroyed: true }, DASHBOARD_TXN),
      () => setPrompt(null)
    )
  }

  function jettison(lotId: string) {
    const m = fresh()
    runWrite(() =>
      store.update(
        'mech',
        mech.id,
        { cargoLots: m.cargoLots.filter((lot) => lot.id !== lotId) },
        DASHBOARD_TXN
      )
    )
  }

  const overlay = ((): ActiveItemBandModel['overlay'] => {
    if (blocked) {
      return {
        title: 'Blocked by a rule',
        onClose: () => setBlocked(null),
        // Keep the gauge the rule is ABOUT on screen while explaining it —
        // the number and the reason belong together.
        gauges: [
          {
            label: 'Heat',
            value: heat,
            max: maxHeat,
            tone: 'mech',
            danger: Math.max(0, maxHeat - 2),
          },
        ],
        body: <RuleBrief rule={blocked.rule} cite={blocked.cite} />,
        actions: [{ label: 'Got it', onClick: () => setBlocked(null), variant: 'go' }],
      }
    }
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

  const view: ActiveItemBandModel = {
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
            // Guided Play teaches as it enforces (ADR-021). A blocked Push used
            // to grey out with a hover title — unreachable on touch, and it
            // taught nothing at the moment the rule actually bit. It now stays
            // pressable and opens the rule instead of performing the action.
            onClick: pushLocked ? () => setBlocked(PUSH_RULE(heat, maxHeat)) : doPush,
            variant: 'go',
            title: pushLocked
              ? `Can't Push at Heat ${heat}/${maxHeat} — why?`
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
      ...(activatable.length > 0
        ? [
            {
              label: 'Effects',
              buttons: activatable.map((e) => ({
                label: `${activeEffects[e.ref] ? '\u25CF' : '\u25CB'} ${e.name}`,
                onClick: () => toggleEffect(e.ref),
                title: activeEffects[e.ref]
                  ? `${e.name} is active — click to end it`
                  : `${e.name}: ${e.summary}`,
              })),
            },
          ]
        : []),
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
  return <ActiveItemBandFrame view={view} />
}
