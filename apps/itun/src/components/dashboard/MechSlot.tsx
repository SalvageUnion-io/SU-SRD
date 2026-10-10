/**
 * MechSlot — the mech in the slot row, in its two forms
 * (ADR-038 §3):
 *
 *  - `MechMajor`, boarded: the Reactor (Push, Heat Check, Vent, Shutdown) and
 *    the Chassis (Take Damage, the cargo hold) at full width, with Effects and
 *    Egress (Dismount, Eject) in one narrow side column.
 *  - `MechMinor`, parked or in Downtime: SP, with Heat and EP as text, and any
 *    damaged system or module, shutdown or destruction in red.
 *
 * Both derive their maxima through `mechStats`, so a Minor and the Major it
 * opens into agree.
 *
 * ADR-007 automation boundary: Push, Heat Check, Vent, Shutdown and the SP value
 * of a self-declared hit auto-apply on a single click; the Critical Damage roll
 * when a hit reaches 0, marking the mech Destroyed, and Eject each take an
 * explicit extra step.
 *
 * Every roll here (Push, Heat Check, Critical Damage) also goes to the Game's
 * log (`dashboardRolls.ts`), where the crew's Log tab reads it.
 */

import { CountStepper, rollForTable } from 'component-lib'
import { useEffect, useState } from 'react'
import type { CriticalDamageEffect } from 'salvageunion-reference/rules'
import {
  describePushOutcome,
  mechMaxHeat,
  mechMaxSP,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { runWrite } from '../../lib/runWrite'
import { totalLotUnits } from '../../lib/schemas/cargoLot'
import type { Mech } from '../../lib/schemas/mech'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { StepRule } from '../wizard/RuleBrief'
import { RuleBrief } from '../wizard/RuleBrief'
import { activatableEffects } from './dashboardEffects'
import { usePhoneForm } from './dashboardForm'
import { recordRoll } from './dashboardRolls'
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
import type { BandBay, BandButton, BandGauge, MajorModel } from './MajorFrame'
import { MajorFrame, StorageBay } from './MajorFrame'
import { MinorFrame } from './MinorFrame'
import type { DamagePrompt, PlayStore } from './SlotRow'
import { mechMinorModel, mechStats } from './slotModels'

export function MechMinor({
  mech,
  pilotAbilities,
  activeEffects,
  boarded,
  onExpand,
}: {
  mech: Mech
  pilotAbilities?: string[]
  activeEffects: readonly string[]
  boarded: boolean
  onExpand: (trigger: HTMLButtonElement) => void
}) {
  return (
    <MinorFrame
      view={mechMinorModel(mech, pilotAbilities, activeEffects, boarded)}
      slot="Mech"
      onExpand={onExpand}
    />
  )
}

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

export function MechMajor({
  mech,
  store,
  pilotAbilities,
  activeEffects: switchedOn,
  boarded,
  onToggleEffect,
  onDismount,
  onEject,
  damagePrompt,
}: {
  mech: Mech
  /** Beefcake raises the piloted MECH's Max SP and Cargo (ADR-029). */
  pilotAbilities?: string[]
  store: PlayStore
  /** Refs of the activated effects the seat has switched on (ADR-029 §4). */
  activeEffects: readonly string[]
  /**
   * Whether the seat has the pilot in this mech. A parked mech opened through
   * ⤢ shows its Reactor and Chassis; Effects and Egress belong to a pilot
   * aboard.
   */
  boarded: boolean
  onToggleEffect: (ref: string) => void
  onDismount: () => void
  /** The emergency exit, sent only after the player confirms it (ADR-007). */
  onEject: () => void
  /**
   * The deck's Take Damage hand-off, which this copy answers. Only the slot
   * row's Major gets it; the ⤢ overlay's copy passes null so it never
   * consumes it.
   */
  damagePrompt: DamagePrompt | null
}) {
  const {
    chassis,
    active: activeEffects,
    piloting,
    maxSP,
    maxEP,
    maxHeat,
    maxCargo,
    sp: spNow,
    ep: epNow,
    heat,
    cargo,
  } = mechStats(mech, pilotAbilities, switchedOn)
  const phone = usePhoneForm()
  // What this mech/pilot could switch on (F1). Manual expiry: the table keeps
  // time, the app keeps state.
  const activatable = activatableEffects(mech, pilotAbilities)

  const [prompt, setPrompt] = useState<MechPrompt>(null)
  const [dmg, setDmg] = useState(1)

  // The deck's Apply step routes a destructive Cascade Failure here: open the
  // Take-Structure-Damage overlay pre-armed for the player to confirm (ADR-007).
  const armed = damagePrompt?.armed ?? false
  const consume = damagePrompt?.consume
  useEffect(() => {
    if (armed && consume) {
      setPrompt({ kind: 'dmg' })
      consume()
    }
  }, [armed, consume])

  const fresh = () => store.get('mech', mech.id) ?? mech

  // Quick Ref p.233 — can't Push if +2 Heat would exceed the Heat Cap.
  const pushLocked = heat + 2 > maxHeat

  // The rule a blocked control explains when the player reaches for it.
  const [blocked, setBlocked] = useState<StepRule | null>(null)

  /** A Heat Check's own d20 is plain; an overload rolls on Reactor Overload. */
  const heatCheckDice = () => rollForTable('Reactor Overload', { plainD20s: 1 })

  async function doPush() {
    const roll = await heatCheckDice()
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis, piloting)
    const { patch, effect, nextHeat, meltdown } = pushPatch({
      heat: resolveGauge(m.currentHeat, cap),
      heatCap: cap,
      currentSP: resolvePoolStart(m.currentSP, spMax),
      roll,
    })
    const log = describePushOutcome(nextHeat, effect)
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'reactor', log, meltdown })
    )
    recordRoll(mech, {
      description: `${mech.name} · Push: ${log}`,
      result: {
        kind: 'heat-check',
        roll: effect.result.heatCheckRoll,
        outcome: effect.result.outcome ?? 'safe',
      },
    })
  }

  async function doHeatCheck() {
    const roll = await heatCheckDice()
    const m = fresh()
    const cap = mechMaxHeat(m, chassis)
    const spMax = mechMaxSP(m, chassis, piloting)
    const { patch, effect, meltdown } = heatCheckOncePatch({
      heat: resolveGauge(m.currentHeat, cap),
      currentSP: resolvePoolStart(m.currentSP, spMax),
      roll,
    })
    const log = describeHeatCheck(effect)
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'reactor', log, meltdown })
    )
    recordRoll(mech, {
      description: `${mech.name} · ${log}`,
      result: {
        kind: 'heat-check',
        roll: effect.result.heatCheckRoll,
        outcome: effect.result.outcome ?? 'safe',
      },
    })
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

  async function rollCritical() {
    const { patch, effect } = critDamagePatch(await rollForTable('Critical Damage'))
    const log = describeCritDamage(effect)
    runWrite(
      () => store.update('mech', mech.id, patch, DASHBOARD_TXN),
      () => setPrompt({ kind: 'crit', effect, log })
    )
    recordRoll(mech, {
      description: `${mech.name} · ${log}`,
      result: {
        kind: 'critical-damage',
        roll: effect.result.roll,
        outcome: effect.result.outcome,
      },
    })
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

  const overlay = ((): MajorModel['overlay'] => {
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
        gauges: [{ label: 'SP', value: spNow, max: maxSP, tone: 'mech' }],
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
      // intermediate const, which would not satisfy BandButton's
      // `'danger' | 'go'` union.
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
            onEject()
          },
          variant: 'danger',
        },
      ],
    }
  })()

  const riderBays: BandBay[] = [
    ...(activatable.length > 0
      ? [
          {
            label: 'Effects',
            side: true,
            columns: 1,
            buttons: activatable.map((e) => ({
              label: `${activeEffects[e.ref] ? '\u25CF' : '\u25CB'} ${e.name}`,
              onClick: () => onToggleEffect(e.ref),
              title: activeEffects[e.ref]
                ? `${e.name} is active — click to end it`
                : `${e.name}: ${e.summary}`,
            })),
          },
        ]
      : []),
    {
      label: 'Egress',
      side: true,
      buttons: [
        {
          label: 'Dismount',
          onClick: () => onDismount(),
          variant: 'go',
          title: 'Exit the mech (calm)',
        },
        {
          label: 'Eject',
          onClick: () => setPrompt({ kind: 'eject' }),
          variant: 'danger',
          title: 'Emergency exit',
        },
      ],
    },
  ]

  const heatGauge: BandGauge = {
    label: 'Heat',
    value: heat,
    max: maxHeat,
    tone: 'mech',
    danger: Math.max(0, maxHeat - 2),
  }
  const push: BandButton = {
    label: phone ? 'Push · +2 Heat' : 'Push',
    // Guided Play teaches as it enforces (ADR-021). A blocked Push used
    // to grey out with a hover title — unreachable on touch, and it
    // taught nothing at the moment the rule actually bit. It now stays
    // pressable and opens the rule instead of performing the action.
    onClick: pushLocked ? () => setBlocked(PUSH_RULE(heat, maxHeat)) : doPush,
    variant: 'go',
    title: pushLocked
      ? `Can't Push at Heat ${heat}/${maxHeat} — why?`
      : '+2 Heat, then a Heat Check',
  }
  const heatCheck: BandButton = {
    label: phone ? 'Heat Check' : 'Heat Chk',
    onClick: doHeatCheck,
    title: 'Roll a Heat Check at current Heat',
  }
  const vent: BandButton = {
    label: 'Vent',
    onClick: doVent,
    variant: 'go',
    title: 'Vent Heat to 0',
  }
  const shutdown: BandButton = {
    label: phone ? 'Shut Down' : 'Shutdn',
    onClick: doShutdown,
    title: 'Toggle reactor shutdown',
  }
  const takeDamage: BandButton = {
    label: phone ? 'Take Damage' : 'Take Dmg',
    onClick: () => {
      setDmg(1)
      setPrompt({ kind: 'dmg' })
    },
    title: 'Take Structure damage',
  }
  const storage: BandButton = {
    label: phone ? `Storage · ${cargo}/${maxCargo}` : 'Storage',
    onClick: () => setPrompt({ kind: 'storage' }),
    title: 'Open the cargo hold',
  }
  const sp: BandGauge = { label: 'SP', value: spNow, max: maxSP, tone: 'mech' }
  const ep: BandGauge = { label: 'EP', value: epNow, max: maxEP, tone: 'mech' }

  // The canvas's bays: the Reactor and the Chassis share the width.
  const canvasBays: BandBay[] = [
    {
      label: 'Reactor',
      columns: 4,
      large: true,
      gauges: [heatGauge, ep],
      buttons: [push, { ...heatCheck, variant: 'go' }, vent, shutdown],
    },
    {
      label: 'Chassis',
      large: true,
      gauges: [sp, { label: 'Cargo', value: cargo, max: maxCargo, tone: 'mech' }],
      buttons: [takeDamage, storage],
    },
  ]
  // The phone's (board D4, ADR-044): SP and EP as cells, then Heat with Push
  // and Vent at thumb height, then the other verbs. Cargo is on Storage.
  const phoneBays: BandBay[] = [
    { label: 'Pools', gauges: [sp, ep], buttons: [] },
    {
      label: 'Reactor',
      gauges: [heatGauge],
      buttons: [push, vent, heatCheck, shutdown, takeDamage, storage],
    },
  ]

  const view: MajorModel = {
    fam: 'mech',
    stampLabel: boarded ? 'Boarded' : 'Parked',
    bays: [
      ...(phone ? phoneBays : canvasBays),
      // The side column: what a pilot aboard switches on, and the ways out.
      ...(boarded ? riderBays : []),
    ],
    overlay,
  }
  return <MajorFrame view={view} />
}
