/**
 * useActionsDeck — the rules and store half of the Actions deck: it builds the
 * deck the mount allows and drives the resolve flow (Activate / Roll / Push /
 * Apply) under the ADR-007 automation boundary, then hands two pure models to
 * the two places they render (docs/architecture/dashboard.md §6):
 *
 *   - `DeckList`, beside the display: the actions, with the timing, range and
 *     source filters;
 *   - `ResolvePanel`, in the display's Resolve tab: the chosen action.
 *
 *   Activate  → pay EP/AP + Hot Heat, decrement Uses (auto bookkeeping)
 *   Roll      → the Core Mechanic d20 + its band
 *   Push      → reroll the d20, +2 Heat, forcing a Heat Check (mech deck only)
 *   Apply     → commit the rolled outcome (Cascade Failure is routed to the
 *               Mech's Major slot, never auto-written)
 *
 * **The resolve in progress lives on the seat** (`resolving`, ADR-038 §2):
 * which action, whether it is activated, the roll and whether it was applied.
 * So a reload mid-roll keeps the roll, and the crew watches it step by step.
 * Every roll and Push also goes to the Game's log (`dashboardRolls.ts`). What
 * only this screen needs (a Hot X, the EP-or-AP choice, the Push readout)
 * stays component state.
 *
 * On foot (`mount === 'pilot'`) the deck is the pilot's abilities + equipment on
 * the AP economy. Boarded, it is BOTH: the mech's chassis + systems + modules on
 * EP *and* the pilot's own actions on AP — the pilot is in the cockpit, so their
 * abilities and equipment never leave the table. `PlayAction.currency` (not the
 * mount) decides what an activation spends and whether it touches Heat.
 */

import { useState } from 'react'
import type { CoreRollResult } from 'salvageunion-reference/rules'
import {
  CORE_ROLL_BANDS,
  canActivateAction,
  describePushOutcome,
  mechMaxEP,
  mechMaxHeat,
  mechMaxSP,
  performCoreRoll,
  pilotMaxAP,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
  rollDie,
} from 'salvageunion-reference/rules'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import type { RangeBand, SeatResolving } from '../../lib/schemas/seat'
import { RANGE_BANDS } from '../../lib/schemas/seat'
import { useEntityStore } from '../../stores/entityStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { MechItemEconomy } from '../sheet/mechItemRules'
import type { DeckListModel, DeckRow } from './DeckList'
import { recordRoll } from './dashboardRolls'
import type { PlayAction, PlayActionCurrency, TimingTab } from './dashboardRules'
import {
  actionReachable,
  activationPatch,
  buildMechActions,
  buildPilotActions,
  economyForActivation,
  groupBySource,
  hasCurrencyChoice,
  hasVariableHot,
  isDestructiveOutcome,
  pilotActivationPatch,
  pushPatch,
  reachSummary,
  TIMING_TABS,
  tabMatchesAction,
} from './dashboardRules'
import type { ResolveModel } from './ResolvePanel'
import type { PlayStore } from './SlotRow'
import type { MountState } from './useSeat'

export type ActionsDeckProps = {
  /** The boarded mech; on foot, the assigned one or null with none. */
  mech: Mech | null
  /** The pilot; on foot the deck lists only their actions. */
  pilot?: Pilot | null
  /** The pilot's crawler — its tier drives Stat Training (max AP). */
  crawler?: Crawler | null
  /** Which entity owns the cockpit; defaults to the boarded mech. */
  mount?: MountState
  /** The engagement range band declared on the pilot's seat. */
  range: RangeBand
  /** Declare a new range band on the seat. */
  onRange: (range: RangeBand) => void
  /** The resolve in progress, read from the seat. */
  resolving: SeatResolving | null
  /** Record the resolve on the seat; null when it is over. */
  onResolving: (resolving: SeatResolving | null) => void
  /**
   * Hand a destructive outcome to the Major slot, which opens its Take Damage
   * overlay for the player to confirm (ADR-007). The Dashboard holds the flag.
   */
  onDamagePrompt?: () => void
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

export type ActionsDeck = {
  list: DeckListModel
  resolve: ResolveModel
}

const HUGE_HEAT_CAP = Number.MAX_SAFE_INTEGER

function bandText(roll: CoreRollResult): string {
  return `${roll.roll}, ${CORE_ROLL_BANDS[roll.band].label}`
}

export function useActionsDeck({
  mech,
  pilot,
  crawler,
  mount = 'mech',
  range,
  onRange,
  resolving,
  onResolving,
  onDamagePrompt,
  store,
}: ActionsDeckProps): ActionsDeck {
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore

  // On foot the mech's actions are unreachable; boarded, the pilot's own actions
  // ride along with the mech's in one deck (SU pilots keep their abilities and
  // equipment in the cockpit).
  const onFoot = mount === 'pilot'
  const pilotDeck = pilot ? buildPilotActions(pilot) : []
  const deck = onFoot || !mech ? pilotDeck : [...buildMechActions(mech), ...pilotDeck]

  // Heat context for reach + heat-lock (pilots carry no heat).
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

  // Deck filters stay on the device.
  const [tab, setTab] = useState<TimingTab>('All')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const selected = resolving === null ? null : (deck.find((a) => a.key === resolving.ref) ?? null)
  const roll: CoreRollResult | null = resolving?.roll ?? null
  const activated = resolving?.activated ?? false
  const applied = resolving?.applied ?? false

  /** Who the log names for a roll: the pilot, or the mech with none. */
  const roller = pilot?.name ?? mech?.name ?? 'Dashboard'
  const logOwner = pilot ?? mech

  function resetLocal() {
    setPushLog(null)
    setMeltdown(false)
    setApplyRouted(false)
    setHotX(1)
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
      // authoritative when present (same rule as the Mech Major's damage write):
      // never clamp it here, since an unresolved ref makes the max 0.
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
        runWrite(() => s.update('pilot', pilot.id, patch, DASHBOARD_TXN))
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
      runWrite(() => s.update('mech', mech.id, patch, DASHBOARD_TXN))
    }
    step(current, { activated: true })
  }

  /**
   * Apply commits the rolled outcome (ADR-007). Non-destructive bands auto-commit;
   * a Cascade Failure is destructive — it is NOT auto-written; the deck ARMS the
   * Mech's Major slot to open its Take-Damage overlay so the player confirms there.
   */
  function doApply(current: SeatResolving, result: CoreRollResult) {
    if (isDestructiveOutcome(result.band)) {
      setApplyRouted(true)
      onDamagePrompt?.()
      return
    }
    step(current, { applied: true })
  }

  function doRoll(current: SeatResolving, action: PlayAction) {
    const result = performCoreRoll(rollDie)
    setPushLog(null)
    setMeltdown(false)
    setApplyRouted(false)
    step(current, { roll: result, applied: false })
    if (logOwner) {
      recordRoll(logOwner, {
        description: `${roller} · ${action.name}: ${bandText(result)}`,
        result: { kind: 'core', roll: result.roll, outcome: result.band },
      })
    }
  }

  function doPush(current: SeatResolving, action: PlayAction) {
    // Push is the mech reactor's move: only a boarded deck offers it.
    if (!mech) return
    const chassis = resolveChassisRef(mech.chassisRef)
    const fresh = s.get('mech', mech.id) ?? mech
    const cap = mechMaxHeat(fresh, chassis)
    const {
      patch,
      effect,
      nextHeat,
      meltdown: meltedDown,
    } = pushPatch({
      heat: resolveGauge(fresh.currentHeat, cap),
      heatCap: cap,
      // Unrecorded SP means undamaged. At 0 an Overheat wrote the mech straight
      // to SP 0 — one hit from destroyed — without it ever having taken damage.
      currentSP: resolvePoolStart(fresh.currentSP, mechMaxSP(fresh, chassis)),
      roll: rollDie,
    })
    runWrite(() => s.update('mech', mech.id, patch, DASHBOARD_TXN))
    const result = performCoreRoll(rollDie)
    const log = describePushOutcome(nextHeat, effect)
    setPushLog(log)
    setMeltdown(meltedDown)
    setApplyRouted(false)
    step(current, { roll: result, applied: false })
    recordRoll(mech, {
      description: `${roller} · ${action.name}, pushed: ${bandText(result)}. ${log}`,
      result: { kind: 'push', roll: result.roll, outcome: result.band },
    })
  }

  /** The player's half of a meltdown: mark the mech Destroyed (ADR-007). */
  function confirmMeltdown() {
    if (!mech) return
    runWrite(
      () => s.update('mech', mech.id, { destroyed: true }, DASHBOARD_TXN),
      () => setMeltdown(false)
    )
  }

  /**
   * The phone's pennant (ADR-044 D6): open an action and pay for it in one
   * press, through the same `activate` the resolve's own pennant calls. An
   * action that cannot be paid for as it stands (locked, over the Heat Cap,
   * a cost to choose) only opens, and the resolve says why.
   */
  function openAndActivate(action: PlayAction) {
    setCurrency(action.currency)
    resetLocal()
    const current: SeatResolving = {
      ref: action.key,
      name: action.name,
      activated: false,
      applied: false,
    }
    const eco = economyForActivation(action.economy, action.action, 1)
    const choice = hasCurrencyChoice(action.action) && !onFoot
    const heatApplies = action.currency === 'EP' && !onFoot
    const heatOk =
      !heatApplies ||
      eco.heat <= 0 ||
      canActivateAction(heatCtx.currentHeat, eco.heat, heatCtx.heatCap)
    const reachable = actionReachable(action, range, heatCtx.currentHeat, heatCtx.heatCap)
    const payable = action.currency === 'EP' ? mech !== null : pilot != null
    if (choice || hasVariableHot(action.action) || !heatOk || !reachable || !payable) {
      onResolving(current)
      return
    }
    activate(current, action, action.currency, eco)
  }

  const list = ((): DeckListModel => {
    if (deck.length === 0) {
      const text = onFoot
        ? 'This pilot has no activatable actions.'
        : 'This mech and pilot have no activatable actions.'
      return { kind: 'empty', text }
    }

    // Filter → render (ONE flat grid, no source/timing headings).
    const byTab = deck.filter((pa) => tabMatchesAction(tab, pa.action))
    const visible =
      sourceFilter === null ? byTab : byTab.filter((pa) => pa.ownerName === sourceFilter)
    const reach = reachSummary(visible, range, heatCtx.currentHeat, heatCtx.heatCap)

    // Source tags come from the whole deck so they never vanish under a timing
    // filter. They are the only place a source name still appears — the grid
    // itself files no action under a heading.
    const sources = groupBySource(deck).map((g) => ({
      label: g.label,
      stamp: g.items[0]?.stamp ?? 'SYS',
    }))

    const rows: DeckRow[] = visible.map((action) => {
      const reachable = actionReachable(action, range, heatCtx.currentHeat, heatCtx.heatCap)
      return {
        key: action.key,
        // The raw action entity drives the canonical header-only card.
        entity: action.action,
        name: action.name,
        locked: !reachable,
        lockTitle:
          action.condition === 'destroyed'
            ? 'Destroyed'
            : reachable
              ? undefined
              : 'Out of range / overheat',
      }
    })

    return {
      kind: 'list',
      tabs: TIMING_TABS,
      activeTab: tab,
      onTab: (t) => {
        const next = TIMING_TABS.find((x) => x === t)
        if (next !== undefined) setTab(next)
      },
      rangeBands: RANGE_BANDS,
      activeRange: range,
      onRange: (b) => {
        const next = RANGE_BANDS.find((x) => x === b)
        if (next !== undefined) onRange(next)
      },
      reachText: `${reach.inReach} / ${reach.total} in reach`,
      sources,
      sourceFilter,
      onSourceFilter: setSourceFilter,
      familyClass: onFoot ? 'pc-deck-fam-pilot' : 'pc-deck-fam-mech',
      rows,
      onOpen: (key) => {
        const action = deck.find((a) => a.key === key)
        if (action) open(action)
      },
      onActivate: (key) => {
        const action = deck.find((a) => a.key === key)
        if (action) openAndActivate(action)
      },
    }
  })()

  const resolve = ((): ResolveModel => {
    if (resolving === null) {
      return { kind: 'idle', text: 'Choose an action from the deck to resolve it here.' }
    }
    if (selected === null) {
      // The seat names an action this deck no longer has: a system was
      // removed, or the deck changed under a reload. Say so, and let it go.
      return {
        kind: 'idle',
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
    const effCurrency: PlayActionCurrency = currencyChoice ? currency : selected.currency

    // Heat projection + cap gate (EP activations only; pilots carry no Heat).
    const heatApplies = effCurrency === 'EP' && !onFoot
    const heatOk =
      !heatApplies ||
      eco.heat <= 0 ||
      canActivateAction(heatCtx.currentHeat, eco.heat, heatCtx.heatCap)
    const projectedHeat = heatCtx.currentHeat + eco.heat
    const apUnavailable = effCurrency === 'AP' && !pilot
    const activateDisabled = activated || !heatOk || apUnavailable

    // Core Book p.233: a pushed roll is not pushed again. A new roll clears
    // the Push readout, and with it this.
    const pushed = pushLog !== null

    const cost: string[] = []
    if (eco.epCost > 0) cost.push(`${eco.epCost} ${effCurrency}`)
    if (heatApplies && eco.heat > 0) cost.push(`+${eco.heat} Heat`)
    if (eco.maxUses > 0) cost.push(`Uses ${eco.maxUses}`)

    return {
      kind: 'resolve',
      onBack: close,
      costLabel: cost.length > 0 ? cost.join(' · ') : 'No cost',
      currency: effCurrency,
      entity: selected.action,
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
        activateLabel: activated ? 'Activated' : 'Activate',
        activateDisabled,
        activateTitle: apUnavailable
          ? 'No pilot to spend AP'
          : heatOk
            ? undefined
            : 'Activating would exceed the Heat Cap',
        onActivate: () => activate(current, selected, effCurrency, eco),
        activated,
        onRoll: () => doRoll(current, selected),
        push: isPilotAction
          ? undefined
          : {
              disabled: roll === null || pushed,
              pushed,
              onPush: () => doPush(current, selected),
            },
        applyLabel: applied ? 'Applied' : 'Apply',
        applyDisabled: roll === null || applied || applyRouted,
        onApply: () => {
          if (roll) doApply(current, roll)
        },
        onClear: () => clear(selected),
      },
      roll: roll
        ? {
            roll: roll.roll,
            band: roll.band,
            bandRange: CORE_ROLL_BANDS[roll.band].range,
            bandLabel: CORE_ROLL_BANDS[roll.band].label,
            bandSummary: CORE_ROLL_BANDS[roll.band].summary,
            destructive: isDestructiveOutcome(roll.band),
          }
        : null,
      pushLog,
      meltdown: meltdown
        ? { onConfirm: confirmMeltdown, onDismiss: () => setMeltdown(false) }
        : null,
      applied,
      applyRouted,
    }
  })()

  return { list, resolve }
}
