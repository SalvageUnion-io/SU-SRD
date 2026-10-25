/**
 * useActionsDeck — the rules and store half of an action's resolve (play.md
 * §5): it builds the deck the mount allows and drives Activate / Roll / Push /
 * Apply under the ADR-007 automation boundary, then hands `PlayResolveSteps`
 * a pure `ResolveModel` to draw inside the action's Mini.
 *
 *   Activate  → pay EP/AP + Hot Heat, decrement Uses (auto bookkeeping)
 *   Roll      → the Core Mechanic d20 + its band
 *   Push      → reroll the d20, +2 Heat, forcing a Heat Check (mech deck only)
 *   Apply     → commit the rolled outcome (a Cascade Failure is never
 *               auto-written: the Mini says to take the damage on the mech)
 *
 * **Area Salvage rolls its own table** (Core Book p.248), not the Core
 * Mechanic: Roll first spends 1 of the area's Supply on the server
 * (`useSalvageArea`), then reads the Area Salvage d20, and Apply loads the
 * Scrap it found into the mech's Cargo Slots (Boarded, spending EP) or the
 * pilot's inventory (on foot, AP), as much as fits (`areaSalvageToMech`,
 * `areaSalvageToPilot`). A 20's Damaged item is the table's to choose, never
 * picked here (ADR-007). It is not Pushed: a Push rerolls the Core Mechanic.
 *
 * **The resolve in progress lives on the seat** (`resolving`, ADR-038 §2):
 * which action, whether it is activated, the roll and whether it was applied.
 * So a reload mid-roll keeps the roll, and the crew watches it step by step.
 * The dice come from the caller (`rollFor`), which records them on Play's roll
 * log (`playRolls.model.ts`). What only this screen needs (a Hot X, the
 * EP-or-AP choice, the Push readout) stays component state.
 *
 * On foot (`situation === 'onFoot'`) the deck is the pilot's abilities + equipment on
 * the AP economy. Boarded, it is BOTH: the mech's chassis + systems + modules on
 * EP *and* the pilot's own actions on AP — the pilot is in the cockpit, so their
 * abilities and equipment never leave the table. `PlayAction.currency` (not the
 * Situation) decides what an activation spends and whether it touches Heat.
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { SalvageArea } from 'game-domain/schemas/salvageArea'
import type { SeatResolving } from 'game-domain/schemas/seat'
import { useState } from 'react'
import type { AreaSalvageResult, CoreRollResult } from 'salvageunion-reference/rules'
import {
  AREA_SALVAGE_TABLE,
  areaSalvageResult,
  CORE_ROLL_BANDS,
  canPush,
  coreRollBandLabel,
  mechMaxCargo,
  mechMaxEP,
  mechMaxHeat,
  overloadTableName,
  overloadTableOf,
  performCoreRoll,
  pilotMaxAP,
  pilotMaxInventorySlots,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { rollForTable } from '../components/index'
import type { PlayAction, PlayActionCurrency } from '../lib/rules/actionPatches'
import {
  activationHeatGate,
  activationPatch,
  buildMechActions,
  buildPilotActions,
  coreMechanicRowText,
  economyForActivation,
  hasCurrencyChoice,
  hasVariableHot,
  isAreaSalvage,
  isDestructiveOutcome,
  mechPush,
  pilotActivationPatch,
  pilotOverloadPatch,
} from '../lib/rules/actionPatches'
import { areaSalvageToMech, areaSalvageToPilot } from '../lib/rules/downtimeEconomy'
import type { MechItemEconomy } from '../lib/rules/mechItems'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { useEntityStore } from '../stores/entityStore'
import { PLAY_TXN } from '../stores/surfaceProvenance'
import { areaSalvageRowText, haulText, isExpertSalvager } from './areaSalvage.model'
import type { PlayStore } from './play.model'
import type { Situation } from './situation.model'
import type { SalvageAreaView } from './useSalvageArea'

export type ResolveModel =
  | { kind: 'idle' }
  | {
      /** The seat names an action the deck no longer has: say so, and let it go. */
      kind: 'orphan'
      text: string
      onClear: () => void
    }
  | {
      kind: 'resolve'
      onBack: () => void
      /**
       * What activating spends, each 0 when it spends none: `amount` of the
       * `currency`, the Heat it adds, and its uses. Drawn by `ResolveSpend`.
       */
      cost: { amount: number; heat: number; uses: number }
      /** What this activation spends: the mech's EP or the pilot's AP. */
      currency: 'EP' | 'AP'
      /** EP-vs-AP cost radio for `activationCurrency === 'EP or AP'` actions. */
      currencyChoice?: {
        epCost: number
        currency: 'EP' | 'AP'
        pilotAvailable: boolean
        activated: boolean
        onCurrency: (c: 'EP' | 'AP') => void
      }
      /** `− X +` Hot(X) stepper + heat projection for variable-Heat actions. */
      variableHot?: {
        hotX: number
        activated: boolean
        projText: string
        over: boolean
        onDec: () => void
        onInc: () => void
      }
      controls: {
        activateDisabled: boolean
        activateTitle?: string
        onActivate: () => void
        onRoll: () => void
        /**
         * Mech actions only (pilots cannot Push, Core Book p.233). Disabled
         * before a roll, once this roll is pushed, and where +2 Heat would
         * pass the Heat Cap (Quick Ref p.233).
         */
        push?: {
          disabled: boolean
          pushed: boolean
          onPush: () => void
          /** Why Push is refused at this Heat, or undefined when it is not. */
          lockedReason?: string
        }
        /** The activation is paid (or the action needs none paid). */
        activated: boolean
        applyLabel: string
        applyDisabled: boolean
        onApply: () => void
        onClear: () => void
      }
      roll?: {
        roll: number
        band: string
        /** The band's span on the d20, as the book prints it ("11–19"). */
        bandRange: string
        bandLabel: string
        bandSummary: string
        /** A Cascade Failure: Apply hands it to the Compact's Callout, never writes it. */
        destructive: boolean
      } | null
      pushLog?: string | null
      /** An Area Salvage: the area, its own table's roll, and what Apply carried. */
      salvage?: {
        /** The area its Supply is spent from; null when there is none to salvage. */
        area: SalvageArea | null
        /** Name or change the area: the Mediator's in a Game, so a solo screen's only. */
        onSetArea?: (area: SalvageArea) => void
        /** The Area Salvage d20, once rolled. */
        roll: number | null
        /** The rolled row, as the screen reader says it. */
        rolled: { label: string; text: string } | null
        /** What Apply carried, and what it left in the area. */
        haul: string | null
      }
      /** A Push's Heat Check melted the reactor down; the player confirms it. */
      meltdown?: { onConfirm: () => void; onDismiss: () => void } | null
      applied: boolean
      applyRouted: boolean
    }

export type ActionsDeckProps = {
  /** The boarded mech; on foot, the assigned one or null with none. */
  mech: Mech | null
  /** The pilot; on foot the deck lists only their actions. */
  pilot?: Pilot | null
  /** The pilot's crawler — its tier drives Stat Training (max AP). */
  crawler?: Crawler | null
  /** What the pilot is doing: on foot, Boarded or in Downtime. */
  situation: Situation
  /** The resolve in progress, read from the seat. */
  resolving: SeatResolving | null
  /** Record the resolve on the seat; null when it is over. */
  onResolving: (resolving: SeatResolving | null) => void
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
  /**
   * The dice for a roll on a table, by its name. Injectable so a test controls
   * the roll; defaults to the UI library's `rollForTable` (Randsum).
   */
  rollFor?: typeof rollForTable
  /** The area an Area Salvage spends Supply from; absent where no area is read. */
  salvageArea?: SalvageAreaView
}

export type ActionsDeck = {
  /** Open an action's resolve on the seat, by its key. */
  open: (key: string) => void
  resolve: ResolveModel
}

/** Every write here is Play's enforced transaction (ADR-022). */
const meta = PLAY_TXN

const HUGE_HEAT_CAP = Number.MAX_SAFE_INTEGER

export function useActionsDeck({
  mech,
  pilot,
  crawler,
  situation,
  resolving,
  onResolving,
  store,
  rollFor = rollForTable,
  salvageArea,
}: ActionsDeckProps): ActionsDeck {
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore

  // On foot the mech's actions are unreachable; boarded, the pilot's own actions
  // ride along with the mech's in one deck (SU pilots keep their abilities and
  // equipment in the cockpit).
  const onFoot = situation === 'onFoot'
  const pilotDeck = pilot ? buildPilotActions(pilot) : []
  const deck = onFoot || !mech ? pilotDeck : [...buildMechActions(mech), ...pilotDeck]

  // Heat context for the heat-lock (pilots carry no heat).
  const heatCtx = (() => {
    if (onFoot || !mech) return { currentHeat: 0, heatCap: HUGE_HEAT_CAP }
    const fresh = s.get('mech', mech.id) ?? mech
    const chassis = resolveChassisRef(mech.chassisRef)
    return { currentHeat: resolveGauge(fresh.currentHeat), heatCap: mechMaxHeat(fresh, chassis) }
  })()

  // This screen's own part of a resolve: never on the seat.
  const [pushLog, setPushLog] = useState<string | null>(null)
  // A Push's Heat Check melted the reactor down: the player confirms the
  // destruction (ADR-007), it is never written for them.
  const [meltdown, setMeltdown] = useState(false)
  const [applyRouted, setApplyRouted] = useState(false)
  const [hotX, setHotX] = useState(1)
  const [currency, setCurrency] = useState<PlayActionCurrency>('EP')
  const [haul, setHaul] = useState<string | null>(null)

  const selected = resolving === null ? null : (deck.find((a) => a.key === resolving.ref) ?? null)
  const roll: CoreRollResult | null = resolving?.roll ?? null
  const activated = resolving?.activated ?? false
  const applied = resolving?.applied ?? false
  const salvageRoll = resolving?.salvage ?? null
  const salvaged: AreaSalvageResult | null =
    salvageRoll === null
      ? null
      : areaSalvageResult({
          areaTl: salvageRoll.areaTl,
          d20: salvageRoll.roll,
          expert: isExpertSalvager(pilot),
        })

  function resetLocal() {
    setPushLog(null)
    setMeltdown(false)
    setApplyRouted(false)
    setHotX(1)
    setHaul(null)
  }

  function open(action: PlayAction) {
    setCurrency(action.currency)
    resetLocal()
    onResolving({ ref: action.key, name: action.name, activated: false, applied: false })
  }

  function close() {
    resetLocal()
    onResolving(null)
  }

  /** Back to the opened state: the action stays chosen, its progress goes. */
  function clear(action: PlayAction) {
    resetLocal()
    onResolving({ ref: action.key, name: action.name, activated: false, applied: false })
  }

  /** Replace the seat's resolve with a new step of the same action. */
  function step(current: SeatResolving, next: Partial<SeatResolving>) {
    onResolving({ ...current, ...next })
  }

  /**
   * Pay one activation in `effCurrency`, spending the (possibly Hot-X-adjusted)
   * `economy`. EP writes the mech patch (EP + Hot Heat + uses); AP writes the
   * pilot's AP spend. This is the single non-destructive ADR-007 bookkeeping
   * write; the Apply step never adds a destructive one.
   */
  function activate(
    current: SeatResolving,
    action: PlayAction,
    effCurrency: PlayActionCurrency,
    economy: MechItemEconomy
  ) {
    if (effCurrency === 'AP') {
      if (!pilot) return
      const fresh = s.get('pilot', pilot.id) ?? pilot
      // An unrecorded live stat means UNSPENT, not empty — a pilot who has never
      // spent AP is at full AP. Defaulting to 0 here banked the spend against an
      // empty pool and wrote AP 0 on the first activation. The stored value stays
      // authoritative when present: never clamp it here, since an unresolved ref
      // makes the max 0.
      const patch = pilotActivationPatch({
        apCost: economy.epCost,
        currentAP: resolvePoolStart(
          fresh.currentAP,
          pilotMaxAP({
            ...fresh,
            crawlerTechLevel: resolveEffectiveCrawlerLevel(fresh, crawler),
          })
        ),
      })
      if (Object.keys(patch).length > 0) {
        runWrite(() => s.update('pilot', pilot.id, patch, meta))
      }
      step(current, { activated: true })
      return
    }
    // EP is the mech's: only a boarded deck offers it.
    if (!mech) return
    const chassis = resolveChassisRef(mech.chassisRef)
    const fresh = s.get('mech', mech.id) ?? mech
    const heatCap = mechMaxHeat(fresh, chassis)
    const patch = activationPatch({
      slug: action.slug,
      economy,
      // Unrecorded EP means a mech that has never spent any — full, not empty.
      currentEP: resolvePoolStart(fresh.currentEP, mechMaxEP(fresh, chassis)),
      currentHeat: resolveGauge(fresh.currentHeat),
      heatCap,
      prevUses: fresh.itemUses,
    })
    if (Object.keys(patch).length > 0) {
      runWrite(() => s.update('mech', mech.id, patch, meta))
    }
    step(current, { activated: true })
  }

  /**
   * Apply commits the rolled outcome (ADR-007). Non-destructive bands auto-commit;
   * a Cascade Failure is destructive — it is NOT auto-written; the resolve says
   * so (`applyRouted`), and the player takes the damage on the unit's gauge.
   */
  function doApply(current: SeatResolving, result: CoreRollResult) {
    if (isDestructiveOutcome(result.band)) {
      setApplyRouted(true)
      return
    }
    step(current, { applied: true })
  }

  async function doRoll(current: SeatResolving) {
    const result = performCoreRoll(await rollFor('Core Mechanic'))
    setPushLog(null)
    setMeltdown(false)
    setApplyRouted(false)
    step(current, { roll: result, applied: false })
  }

  async function doPush(current: SeatResolving) {
    // Push is the mech reactor's move: only a boarded deck offers it.
    if (!mech) return
    // The Heat Check's own d20 is plain; an overload rolls on Reactor Overload,
    // or a Bio-Chassis's own table (We Were Here First p.79).
    const overloadTable = overloadTableName(overloadTableOf(resolveChassisRef(mech.chassisRef)))
    const heatRoll = await rollFor(overloadTable, { plainD20s: 1 })
    const coreRoll = await rollFor('Core Mechanic')
    // Core Book p.234: no Push that would take Heat past the cap. The control
    // is disabled for it; this holds the line against a stale render too.
    const pushed = mechPush(s.get('mech', mech.id) ?? mech, heatRoll)
    if (pushed === null) return
    runWrite(() => s.update('mech', mech.id, pushed.patch, meta))
    const hurt = pilot ? pilotOverloadPatch(s.get('pilot', pilot.id) ?? pilot, pushed.effect) : null
    if (pilot && hurt !== null) runWrite(() => s.update('pilot', pilot.id, hurt, meta))
    const result = performCoreRoll(coreRoll)
    setPushLog(pushed.text)
    setMeltdown(pushed.meltdown)
    setApplyRouted(false)
    step(current, { roll: result, applied: false })
  }

  /**
   * Area Salvage's roll: 1 Supply spent on the server first, then its own
   * table's d20, at the Tech Level the Supply was spent on. A refused spend
   * (no area, picked clean) is said by `useSalvageArea` and rolls nothing.
   */
  async function doSalvageRoll(current: SeatResolving) {
    if (!salvageArea || !pilot) return
    const spent = await salvageArea.spend(pilot.id)
    if (spent === null) return
    const die = (await rollFor(AREA_SALVAGE_TABLE))(20)
    setHaul(null)
    step(current, { salvage: { roll: die, areaTl: spent.techLevel }, applied: false })
  }

  /**
   * Area Salvage's Apply: the Scrap into the Cargo Slots of the mech aboard, or
   * on foot into the pilot's inventory, as much as fits; the rest stays in the
   * area. Nothing found, or a 20's item alone, writes nothing.
   */
  function doSalvageApply(current: SeatResolving, result: AreaSalvageResult) {
    if (!onFoot && mech) {
      const fresh = s.get('mech', mech.id) ?? mech
      const cap = mechMaxCargo(fresh, undefined, { abilities: pilot?.abilities })
      const carried = areaSalvageToMech(fresh, cap, result)
      const { patch } = carried
      if (patch) runWrite(() => s.update('mech', mech.id, patch, meta))
      setHaul(haulText(result, carried, playCopy('salvageMechCargo', { name: fresh.name })))
    } else if (pilot) {
      const fresh = s.get('pilot', pilot.id) ?? pilot
      const carried = areaSalvageToPilot(fresh, pilotMaxInventorySlots(fresh), result)
      const { patch } = carried
      if (patch) runWrite(() => s.update('pilot', pilot.id, patch, meta))
      setHaul(
        haulText(result, carried, playCopy('salvagePilotInventory', { name: fresh.callsign }))
      )
    }
    step(current, { applied: true })
  }

  /** The player's half of a meltdown: mark the mech Destroyed (ADR-007). */
  function confirmMeltdown() {
    if (!mech) return
    runWrite(
      () => s.update('mech', mech.id, { destroyed: true }, meta),
      () => setMeltdown(false)
    )
  }

  const resolve = ((): ResolveModel => {
    if (resolving === null) {
      return { kind: 'idle' }
    }
    if (selected === null) {
      // The seat names an action this deck no longer has: a system was
      // removed, or the deck changed under a reload. Say so, and let it go.
      return {
        kind: 'orphan',
        text: `${resolving.name} is no longer in this deck.`,
        onClear: close,
      }
    }

    const current = resolving
    // Whether THIS action runs on the pilot's AP economy — per action, not per
    // deck, since a boarded deck carries both. Pilot actions never touch Heat and
    // can never be Pushed (Push is the mech reactor's move).
    const isPilotAction = selected.currency === 'AP'
    // Fold the player-picked Hot X into this activation's economy (no-op unless
    // the action carries a variable Hot); the chosen currency drives the patch.
    // The mech's EP is only reachable from the cockpit, so the EP-vs-AP radios
    // are offered only when boarded.
    const currencyChoice = hasCurrencyChoice(selected.action) && !onFoot
    const variableHot = hasVariableHot(selected.action) && !isPilotAction
    const eco = economyForActivation(selected.economy, selected.action, hotX)
    // Area Salvage costs "1 AP for a Pilot or 1 EP in a Mech" (p.248).
    const salvaging = isAreaSalvage(selected.action)
    const effCurrency: PlayActionCurrency = currencyChoice
      ? currency
      : salvaging && !onFoot && mech
        ? 'EP'
        : selected.currency

    // Heat projection + cap gate (EP activations only; pilots carry no Heat).
    const { applies: heatApplies, ok: heatOk } = activationHeatGate({
      currency: effCurrency,
      onFoot,
      heat: eco.heat,
      ...heatCtx,
    })
    const projectedHeat = heatCtx.currentHeat + eco.heat
    const apUnavailable = effCurrency === 'AP' && !pilot
    const activateDisabled = activated || !heatOk || apUnavailable

    // Core Book p.233: a pushed roll is not pushed again. A new roll clears
    // the Push readout, and with it this.
    const pushed = pushLog !== null
    // Core Book pp.233–234: a Push adds 2 Heat, and a mech never exceeds its
    // Heat Cap, so it is refused where that would — as `PlayReactorRow` refuses it.
    const pushLocked = !canPush(heatCtx.currentHeat, heatCtx.heatCap)

    return {
      kind: 'resolve',
      onBack: close,
      cost: {
        amount: eco.epCost,
        heat: heatApplies ? eco.heat : 0,
        uses: eco.maxUses,
      },
      currency: effCurrency,
      currencyChoice: currencyChoice
        ? {
            epCost: eco.epCost,
            currency,
            pilotAvailable: pilot != null,
            activated,
            onCurrency: setCurrency,
          }
        : undefined,
      variableHot: variableHot
        ? {
            hotX,
            activated,
            projText: `Heat ${projectedHeat}/${heatCtx.heatCap}${heatOk ? '' : ' — over cap'}`,
            over: !heatOk,
            onDec: () => setHotX((x) => Math.max(1, x - 1)),
            onInc: () => setHotX((x) => x + 1),
          }
        : undefined,
      controls: {
        activateDisabled,
        activateTitle: apUnavailable
          ? 'No pilot to spend AP'
          : heatOk
            ? undefined
            : 'Activating would exceed the Heat Capacity',
        onActivate: () => activate(current, selected, effCurrency, eco),
        activated,
        onRoll: () => void (salvaging ? doSalvageRoll(current) : doRoll(current)),
        push:
          isPilotAction || salvaging
            ? undefined
            : {
                disabled: roll === null || pushed || pushLocked,
                pushed,
                lockedReason: pushLocked
                  ? `No Push at Heat ${heatCtx.currentHeat}/${heatCtx.heatCap}: +2 Heat would pass the Heat Capacity.`
                  : undefined,
                onPush: () => void doPush(current),
              },
        applyLabel: applied ? 'Applied' : 'Apply',
        applyDisabled: (salvaging ? salvaged === null : roll === null) || applied || applyRouted,
        onApply: () => {
          if (salvaging) {
            if (salvaged) doSalvageApply(current, salvaged)
          } else if (roll) doApply(current, roll)
        },
        onClear: () => clear(selected),
      },
      roll:
        roll && !salvaging
          ? {
              roll: roll.roll,
              band: roll.band,
              bandRange: CORE_ROLL_BANDS[roll.band].range,
              bandLabel: coreRollBandLabel(roll.band),
              bandSummary: coreMechanicRowText(roll.roll),
              destructive: isDestructiveOutcome(roll.band),
            }
          : null,
      pushLog,
      salvage: salvaging
        ? {
            area: salvageArea?.area ?? null,
            ...(salvageArea?.canSet ? { onSetArea: salvageArea.set } : {}),
            roll: salvaged?.roll ?? null,
            rolled: salvaged
              ? { label: salvaged.label, text: areaSalvageRowText(salvaged.roll) }
              : null,
            haul,
          }
        : undefined,
      meltdown: meltdown
        ? { onConfirm: confirmMeltdown, onDismiss: () => setMeltdown(false) }
        : null,
      applied,
      applyRouted,
    }
  })()

  return {
    open: (key) => {
      const action = deck.find((a) => a.key === key)
      if (action) open(action)
    },
    resolve,
  }
}
