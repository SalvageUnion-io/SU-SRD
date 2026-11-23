/**
 * useActionsDeck — the rules and store half of an action's resolve (play.md
 * §5): it builds the deck the mount allows and drives Activate / Roll / Push /
 * Apply under the ADR-007 automation boundary, then hands `PlayResolveSteps`
 * a pure `ResolveModel` to draw inside the action's Mini.
 *
 *   Activate  → pay EP/AP + Hot Heat, decrement Uses (auto bookkeeping)
 *   Roll      → pays the same cost first where Activate has not (r4 A1: once,
 *               by `payThen`), then the Core Mechanic d20 + its band
 *
 * So an action never finishes with its cost unpaid: Apply stands off until it
 * is paid, a Roll the cost refuses (over the Heat Cap) is refused with it, and
 * Start over keeps what was paid. An action with no cost has no Activate.
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

import { pilotCallsign } from 'game-domain/pilotLabel'
import { pushHeatAt } from 'game-domain/rules/sceneConditions'
import type { SeatResolving } from 'game-domain/schemas/seat'
import { useEffect, useRef, useState } from 'react'
import type { AreaSalvageResult, CoreRollResult } from 'salvageunion-reference/rules'
import {
  AREA_SALVAGE_TABLE,
  areaSalvageResult,
  CORE_ROLL_BANDS,
  canPush,
  coreRollBandLabel,
  mechMaxCargo,
  mechMaxHeat,
  overloadTableName,
  overloadTableOf,
  performCoreRoll,
  pilotMaxInventorySlots,
  resolveChassisRef,
  resolveGauge,
} from 'salvageunion-reference/rules'
import { rollForTable, toast } from '../components/index'
import type { PlayAction, PlayActionCurrency } from '../lib/rules/actionList'
import {
  buildCompanionActions,
  buildMechActions,
  buildPilotActions,
  isAreaSalvage,
} from '../lib/rules/actionList'
import {
  activationHeatGate,
  coreMechanicRowText,
  economyForActivation,
  economyUnderScene,
  hasCurrencyChoice,
  hasVariableHot,
  isDestructiveOutcome,
} from '../lib/rules/actionPatches'
import { areaSalvageToMech, areaSalvageToPilot } from '../lib/rules/downtimeEconomy'
import { runWrite } from '../lib/runWrite'
import { playCopy } from '../messages/play'
import { PLAY_TXN } from '../replica/provenance'
import { useUnits } from '../replica/units'
import type { ActionsDeck, ActionsDeckProps, ResolveModel } from './actionsDeck.model'
import { areaSalvageRowText, haulFeedText, haulText, isExpertSalvager } from './areaSalvage.model'
import { actionUsesLeft, companionNow, payActivation } from './deckActivation.model'
import { heatCheckSays } from './feed.model'
import type { PlayStore } from './play.model'
import { recordPlayRoll } from './playRolls.model'
import { confirmMeltdown, pushMech } from './reactorWrites.model'
import { CORE_MECHANIC_TABLE } from './tables.model'

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
  held = false,
  store,
  rollFor = rollForTable,
  heatScale = 1,
  salvageArea,
}: ActionsDeckProps): ActionsDeck {
  const liveStore = useUnits()
  const s: PlayStore = store ?? liveStore

  // On foot the mech's actions are unreachable; boarded, the pilot's own actions
  // ride along with the mech's in one deck (SU pilots keep their abilities and
  // equipment in the cockpit).
  const onFoot = situation === 'onFoot'
  const pilotDeck = pilot ? buildPilotActions(pilot) : []
  // The companions' actions are in the deck too (R65). A pilot's companion
  // acts on its own turn, on foot or Boarded; a mech's drone is reached from
  // its mech.
  const companionDeck = [
    ...(pilot ? buildCompanionActions({ kind: 'pilot', id: pilot.id }, pilot.partners) : []),
    ...(!onFoot && mech ? buildCompanionActions({ kind: 'mech', id: mech.id }, mech.partners) : []),
  ]
  const deck = [
    ...(onFoot || !mech ? pilotDeck : [...buildMechActions(mech), ...pilotDeck]),
    ...companionDeck,
  ]

  const units = { store: s, pilot, mech, crawler }

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
  const [doneKey, setDoneKey] = useState<string | null>(null)
  // What the finished row says: its roll, when the roll closed it (r6 A5).
  const [doneSays, setDoneSays] = useState<string>(playCopy('resultApplied'))
  // One spend at a time: a second press while it lands pays nothing more.
  const paying = useRef(false)

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
  }

  function open(action: PlayAction) {
    setCurrency(action.currency)
    setDoneKey(null)
    resetLocal()
    onResolving({ ref: action.key, name: action.name, activated: false, applied: false })
  }

  function close() {
    resetLocal()
    onResolving(null)
  }

  /** Back to the opened state: the action stays chosen, its roll goes; what was paid stays paid. */
  function clear(action: PlayAction) {
    resetLocal()
    onResolving({ ref: action.key, name: action.name, activated, applied: false })
  }

  /** Replace the seat's resolve with a new step of the same action. */
  function step(current: SeatResolving, next: Partial<SeatResolving>) {
    onResolving({ ...current, ...next })
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
    // A finished action closes itself: its row says Done, and the seat stops
    // saying it is being resolved.
    // A Core Mechanic roll writes nothing to a unit: the row says what it came to (r6 A5).
    setDoneKey(current.ref)
    setDoneSays(playCopy('rolledSays', { roll: result.roll, band: coreRollBandLabel(result.band) }))
    close()
  }

  async function doRoll(current: SeatResolving) {
    const result = performCoreRoll(await rollFor(CORE_MECHANIC_TABLE))
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
    const table = overloadTableOf(resolveChassisRef(mech.chassisRef))
    // Its own Feed line, passed or failed, never a second roll of the action (r7 A5).
    let said: string | undefined
    const heatRoll = await rollFor(overloadTableName(table), {
      plainD20s: 1,
      label: playCopy('heatCheck'),
      outcome: () => said,
    })
    const coreRoll = await rollFor(CORE_MECHANIC_TABLE)
    // Core Book p.234: no Push that would take Heat past the cap. The control
    // is disabled for it; this holds the line against a stale render too.
    // The readout, a Meltdown and the reroll follow only a Push that landed.
    const pushed = pushMech(
      { store: s, mech, pilot: pilot ?? null, crawler: crawler ?? null, roll: heatRoll, heatScale },
      (pushed) => {
        setPushLog(pushed.text)
        setMeltdown(pushed.meltdown)
        setApplyRouted(false)
        step(current, { roll: performCoreRoll(coreRoll), applied: false })
      }
    )
    said = pushed === null ? undefined : heatCheckSays(pushed.effect, table)
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
    step(current, { salvage: { roll: die, areaTl: spent.techLevel }, applied: false })
  }

  /**
   * Area Salvage's Apply: the Scrap into the Cargo Slots of the mech aboard, or
   * on foot into the pilot's inventory, as much as fits; the rest stays in the
   * area. Nothing found, or a 20's item alone, writes nothing. Then it closes.
   */
  function doSalvageApply(current: SeatResolving, result: AreaSalvageResult) {
    let said: string | null = null
    let feed: string | null = null
    if (!onFoot && mech) {
      const fresh = s.get('mech', mech.id) ?? mech
      const cap = mechMaxCargo(fresh, undefined, { abilities: pilot?.abilities })
      const carried = areaSalvageToMech(fresh, cap, result)
      const { patch } = carried
      if (patch) runWrite(() => s.update('mech', mech.id, patch, meta))
      said = haulText(result, carried, playCopy('salvageMechCargo', { name: fresh.name }))
      feed = haulFeedText(result, carried, playCopy('salvageFeedCargo'))
    } else if (pilot) {
      const fresh = s.get('pilot', pilot.id) ?? pilot
      const carried = areaSalvageToPilot(fresh, pilotMaxInventorySlots(fresh), result)
      const { patch } = carried
      if (patch) runWrite(() => s.update('pilot', pilot.id, patch, meta))
      said = haulText(
        result,
        carried,
        playCopy('salvagePilotInventory', { name: pilotCallsign(fresh) })
      )
      feed = haulFeedText(result, carried, playCopy('salvageFeedInventory'))
    }
    // What it found and where it went reaches the table's Feed (r6 D3): a
    // line without dice reaches the Game's log only in a slot.
    if (feed !== null)
      recordPlayRoll({
        tableName: '',
        rolls: [],
        label: playCopy('salvageFeedLabel'),
        outcome: feed,
        slot: `area-salvage:${current.ref}:${Date.now()}`,
      })
    // It finishes like any other action (LG-12): the row says Done, the seat
    // stops saying it is being resolved, and a toast keeps what was loaded.
    if (said !== null) toast(said, { id: `area-salvage-${current.ref}` })
    setDoneKey(current.ref)
    close()
  }

  /** The player's half of a meltdown: mark the mech Destroyed (ADR-007). */
  function meltDown() {
    if (!mech) return
    confirmMeltdown(s, mech.id, () => setMeltdown(false))
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
        text: playCopy('noLongerInThisDeck', { name: resolving.name }),
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
    // The Scene's conditions scale the Hot Heat (Workshop Manual p.306, False Flag p.9).
    const eco = economyUnderScene(
      economyForActivation(selected.economy, selected.action, hotX),
      heatScale
    )
    // Area Salvage costs "1 AP for a Pilot or 1 EP in a Mech" (p.248).
    const salvaging = isAreaSalvage(selected.action)
    const effCurrency: PlayActionCurrency = currencyChoice
      ? currency
      : salvaging && !onFoot && mech
        ? 'EP'
        : selected.currency

    // Heat projection + cap gate (EP activations only; pilots carry no Heat).
    // A companion's Heat is its own, on foot or Boarded.
    const companion = selected.companion ? companionNow(units, selected.companion) : null
    const actionHeat = companion
      ? { currentHeat: companion.currentHeat, heatCap: companion.heatCap }
      : heatCtx
    const { applies: heatApplies, ok: heatOk } = activationHeatGate({
      currency: effCurrency,
      onFoot: selected.companion ? false : onFoot,
      heat: eco.heat,
      ...actionHeat,
    })
    const projectedHeat = actionHeat.currentHeat + eco.heat
    const apUnavailable = effCurrency === 'AP' && !pilot
    const unpayable = apUnavailable
      ? playCopy('noPilotToSpendAp')
      : heatOk
        ? undefined
        : playCopy('activatingWouldExceed')
    const activateDisabled = activated || unpayable !== undefined
    const counted = actionUsesLeft(units, selected, effCurrency)
    const cost = {
      amount: eco.epCost,
      heat: heatApplies ? eco.heat : 0,
      uses: counted?.max ?? eco.maxUses,
      ...(counted ? { usesLeft: counted.left } : {}),
    }
    const spends = [
      ...(cost.amount > 0 ? [`${cost.amount} ${effCurrency}`] : []),
      ...(cost.heat > 0 ? [playCopy('spendsHeat', { heat: cost.heat })] : []),
      ...(counted && counted.left > 0 ? [playCopy('spendsUse')] : []),
    ]
    /**
     * Pay the cost where it is not paid yet, once, then go on with the resolve
     * as paid: Activate's own path, so the spend says itself with Undo.
     */
    const payThen = (after: (paid: SeatResolving) => void) => {
      if (activated) return after(current)
      if (paying.current || unpayable !== undefined) return
      paying.current = true
      payActivation(
        units,
        selected,
        effCurrency,
        eco,
        () => {
          paying.current = false
          const paid = { ...current, activated: true }
          onResolving(paid)
          after(paid)
        },
        () => {
          paying.current = false
        }
      )
    }

    // Core Book p.233: a pushed roll is not pushed again. A new roll clears
    // the Push readout, and with it this.
    const pushed = pushLog !== null
    // Core Book pp.233–234: a Push adds 2 Heat, and a mech never exceeds its
    // Heat Cap, so it is refused where that would — as `PlayReactorRow` refuses it.
    const pushHeat = pushHeatAt(heatScale)
    const pushLocked = !canPush(heatCtx.currentHeat, heatCtx.heatCap, pushHeat)
    // A roll whose result writes nothing (every band but a Cascade Failure,
    // which the player takes on the gauge): there is nothing to Apply (r6 A5),
    // so the row's own Done finishes it, and a Failure with no Push open to it
    // closes itself once the roll is logged.
    // Unpaid, it still waits on Apply, which stands off until it is (r4 A1).
    const nothingToApply =
      !salvaging && activated && roll !== null && !isDestructiveOutcome(roll.band) && !applied
    const pushOpen = !(isPilotAction || salvaging || selected.companion) && !pushed && !pushLocked

    const rolledSays =
      roll === null
        ? null
        : playCopy('rolledSays', { roll: roll.roll, band: coreRollBandLabel(roll.band) })
    return {
      kind: 'resolve',
      // Done on a roll that writes nothing finishes it: the row says what it came to.
      onBack:
        nothingToApply && rolledSays !== null
          ? () => {
              setDoneKey(current.ref)
              setDoneSays(rolledSays)
              close()
            }
          : close,
      cost,
      free: cost.amount <= 0 && cost.heat <= 0 && cost.uses <= 0,
      rollLeads: !salvaging && selected.action.damage !== undefined,
      rollSpends:
        activated || spends.length === 0
          ? null
          : playCopy('rollSpends', { cost: spends.join(', ') }),
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
            projText: playCopy(heatOk ? 'heatProjected' : 'heatProjectedOverCap', {
              heat: projectedHeat,
              cap: actionHeat.heatCap,
            }),
            over: !heatOk,
            onDec: () => setHotX((x) => Math.max(1, x - 1)),
            onInc: () => setHotX((x) => x + 1),
          }
        : undefined,
      controls: {
        activateDisabled,
        activateTitle: unpayable,
        onActivate: () => payThen(() => undefined),
        activated,
        onRoll: () => payThen((paid) => void (salvaging ? doSalvageRoll(paid) : doRoll(paid))),
        ...(!activated && unpayable !== undefined ? { rollLockedReason: unpayable } : {}),
        push:
          // A companion cannot Push (Core Book p.68).
          isPilotAction || salvaging || selected.companion
            ? undefined
            : {
                disabled: roll === null || pushed || pushLocked,
                pushed,
                heat: pushHeat,
                lockedReason: pushLocked
                  ? playCopy('noPushAtHeatWouldPass', {
                      heat: heatCtx.currentHeat,
                      cap: heatCtx.heatCap,
                      gain: pushHeat,
                    })
                  : undefined,
                onPush: () => void doPush(current),
              },
        applyLabel: applied ? 'Applied' : 'Apply',
        // Never done with its cost unpaid (r4 A1).
        applyDisabled:
          !activated || (salvaging ? salvaged === null : roll === null) || applied || applyRouted,
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
          }
        : undefined,
      meltdown: meltdown ? { onConfirm: meltDown, onDismiss: () => setMeltdown(false) } : null,
      applied,
      applyRouted,
      nothingToApply,
      // A Failure has nothing to apply and nothing to read on: with no Push
      // open it closes itself; any other result stays to be read, closed by Done.
      closesItself:
        nothingToApply && !pushOpen && !applyRouted && roll?.band === 'failure' ? rolledSays : null,
      progressed: activated || roll !== null || salvageRoll !== null || applied,
      held,
    }
  })()

  // The roll changed nothing and nothing can follow it: the card closes, the
  // Feed line stays, and the row says what it came to (r6 A5).
  const closing = resolve.kind === 'resolve' ? resolve.closesItself : null
  const closingRef = resolving?.ref ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: closes once per roll that says so
  useEffect(() => {
    if (closing === null || closingRef === null) return
    setDoneKey(closingRef)
    setDoneSays(closing)
    close()
  }, [closing, closingRef])

  return {
    open: (key) => {
      const action = deck.find((a) => a.key === key)
      if (action) open(action)
    },
    resolve,
    doneKey: resolving === null ? doneKey : null,
    doneSays,
  }
}
