/**
 * ActionsDeck (ITUN binding) — the Actions instrument's rules + store logic. It
 * builds the active entity's activatable actions and drives the resolve flow
 * (Activate / Roll / Push / Apply) under the ADR-007 automation boundary, then
 * hands a pure view-model to the presentational ActionsDeck in component-lib.
 *
 *   Activate  → pay EP/AP + Hot Heat, decrement Uses (auto bookkeeping)
 *   Roll      → the Core Mechanic d20 + its band (component state, never stored)
 *   Push      → reroll the d20, +2 Heat, forcing a Heat Check (mech deck only)
 *   Apply     → commit the rolled outcome (Cascade Failure is routed to the
 *               Active Item band, never auto-written)
 *
 * On foot (`mount === 'pilot'`) the deck is the pilot's abilities + equipment on
 * the AP economy; boarded, it is the mech's chassis + systems + modules on EP.
 */

import { useState } from 'react'
import { ActionsDeck as ActionsDeckView } from 'component-lib'
import type { ActionsDeckView as ActionsDeckViewModel, DeckGroup } from 'component-lib'
import { canActivateAction } from 'salvageunion-reference'

import { CORE_ROLL_BANDS, describePushOutcome, performCoreRoll } from '../../lib/rules/coreMechanic'
import type { CoreRollResult } from '../../lib/rules/coreMechanic'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { mechMaxHeat } from '../../lib/rules/derivedStats'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import type { MountState } from '../../stores/playStateStore'
import type { PlayStore } from './ActiveItemBand'
import {
  activationPatch,
  actionReachable,
  buildMechActions,
  buildPilotActions,
  economyForActivation,
  groupBySource,
  groupByTiming,
  hasCurrencyChoice,
  hasVariableHot,
  isDestructiveOutcome,
  pilotActivationPatch,
  pushPatch,
  reachSummary,
  tabMatchesAction,
  RANGE_BANDS,
  TIMING_TABS,
} from './dashboardRules'
import type { MechItemEconomy } from '../sheet/mechItemRules'
import type { PlayAction, PlayActionCurrency, TimingTab } from './dashboardRules'

type ActionsDeckProps = {
  mech: Mech
  /** The on-foot pilot; when `mount === 'pilot'` the deck lists their actions. */
  pilot?: Pilot | null
  /** Which entity owns the cockpit; defaults to the boarded mech. */
  mount?: MountState
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

const HUGE_HEAT_CAP = Number.MAX_SAFE_INTEGER

export function ActionsDeck({ mech, pilot, mount = 'mech', store }: ActionsDeckProps) {
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore
  const range = usePlayStateStore((st) => st.range)
  const setRange = usePlayStateStore((st) => st.setRange)
  const armDamagePrompt = usePlayStateStore((st) => st.armDamagePrompt)

  const isPilotDeck = mount === 'pilot' && pilot != null
  const deck = isPilotDeck ? buildPilotActions(pilot) : buildMechActions(mech)

  // Heat context for reach + heat-lock (pilots carry no heat).
  const heatCtx = (() => {
    if (isPilotDeck) return { currentHeat: 0, heatCap: HUGE_HEAT_CAP }
    const fresh = s.get('mech', mech.id) ?? mech
    const chassis = resolveChassisRef(mech.chassisRef)
    return { currentHeat: fresh.currentHeat ?? 0, heatCap: mechMaxHeat(fresh, chassis) }
  })()

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [roll, setRoll] = useState<CoreRollResult | null>(null)
  const [activated, setActivated] = useState(false)
  const [pushLog, setPushLog] = useState<string | null>(null)
  // Resolve-flow state (D2, all Dashboard-local / ephemeral).
  const [applied, setApplied] = useState(false)
  const [applyRouted, setApplyRouted] = useState(false)
  const [hotX, setHotX] = useState(1)
  const [currency, setCurrency] = useState<PlayActionCurrency>('EP')

  const [tab, setTab] = useState<TimingTab>('All')
  const [grouping, setGrouping] = useState<'source' | 'timing'>('source')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const selected = deck.find((a) => a.key === selectedKey) ?? null

  function resetResolve() {
    setRoll(null)
    setActivated(false)
    setPushLog(null)
    setApplied(false)
    setApplyRouted(false)
    setHotX(1)
  }

  function open(action: PlayAction) {
    setSelectedKey(action.key)
    setCurrency(action.currency)
    resetResolve()
  }

  function close() {
    setSelectedKey(null)
    resetResolve()
  }

  /**
   * Pay one activation in `effCurrency`, spending the (possibly Hot-X-adjusted)
   * `economy`. EP writes the mech patch (EP + Hot Heat + uses); AP writes the
   * pilot's AP spend. This is the single non-destructive ADR-007 bookkeeping
   * write; the Apply step never adds a destructive one.
   */
  function activate(action: PlayAction, effCurrency: PlayActionCurrency, economy: MechItemEconomy) {
    if (effCurrency === 'AP') {
      if (!pilot) return
      const fresh = s.get('pilot', pilot.id) ?? pilot
      const patch = pilotActivationPatch({
        apCost: economy.epCost,
        currentAP: fresh.currentAP ?? 0,
      })
      if (Object.keys(patch).length > 0) void s.update('pilot', pilot.id, patch)
      setActivated(true)
      return
    }
    const chassis = resolveChassisRef(mech.chassisRef)
    const fresh = s.get('mech', mech.id) ?? mech
    const heatCap = mechMaxHeat(fresh, chassis)
    const patch = activationPatch({
      slug: action.slug,
      economy,
      currentEP: fresh.currentEP ?? 0,
      currentHeat: fresh.currentHeat ?? 0,
      heatCap,
      prevUses: fresh.itemUses,
    })
    if (Object.keys(patch).length > 0) {
      void s.update('mech', mech.id, patch)
    }
    setActivated(true)
  }

  /**
   * Apply commits the rolled outcome (ADR-007). Non-destructive bands auto-commit;
   * a Cascade Failure is destructive — it is NOT auto-written; the deck ARMS the
   * active Item band to open its Take-Damage overlay so the player confirms there.
   */
  function doApply(result: CoreRollResult) {
    if (isDestructiveOutcome(result.band)) {
      setApplyRouted(true)
      armDamagePrompt()
      return
    }
    setApplied(true)
  }

  function doRoll() {
    setRoll(performCoreRoll(defaultRoll))
    setPushLog(null)
    setApplied(false)
    setApplyRouted(false)
  }

  function doPush() {
    const chassis = resolveChassisRef(mech.chassisRef)
    const fresh = s.get('mech', mech.id) ?? mech
    const cap = mechMaxHeat(fresh, chassis)
    const { patch, effect, nextHeat } = pushPatch({
      heat: Math.min(fresh.currentHeat ?? cap, cap),
      heatCap: cap,
      currentSP: fresh.currentSP ?? 0,
      roll: defaultRoll,
    })
    void s.update('mech', mech.id, patch)
    setRoll(performCoreRoll(defaultRoll))
    setPushLog(describePushOutcome(nextHeat, effect))
    setApplied(false)
    setApplyRouted(false)
  }

  if (deck.length === 0) {
    const text = isPilotDeck
      ? 'This pilot has no activatable actions.'
      : 'This mech has no activatable actions.'
    return <ActionsDeckView view={{ kind: 'empty', text }} />
  }

  if (selected) {
    // Fold the player-picked Hot X into this activation's economy (no-op unless
    // the action carries a variable Hot); the chosen currency drives the patch.
    const currencyChoice = hasCurrencyChoice(selected.action)
    const variableHot = hasVariableHot(selected.action) && !isPilotDeck
    const eco = economyForActivation(selected.economy, selected.action, hotX)
    const effCurrency: PlayActionCurrency = currencyChoice ? currency : selected.currency

    // Heat projection + cap gate (mech deck only; pilots carry no Heat).
    const heatOk =
      isPilotDeck ||
      effCurrency === 'AP' ||
      eco.heat <= 0 ||
      canActivateAction(heatCtx.currentHeat, eco.heat, heatCtx.heatCap)
    const projectedHeat = heatCtx.currentHeat + eco.heat
    const apUnavailable = effCurrency === 'AP' && !pilot
    const activateDisabled = activated || !heatOk || apUnavailable

    const cost: string[] = []
    if (eco.epCost > 0) cost.push(`${eco.epCost} ${effCurrency}`)
    if (!isPilotDeck && effCurrency === 'EP' && eco.heat > 0) cost.push(`+${eco.heat} Heat`)
    if (eco.maxUses > 0) cost.push(`Uses ${eco.maxUses}`)

    const view: ActionsDeckViewModel = {
      kind: 'resolve',
      onBack: close,
      costLabel: cost.length > 0 ? cost.join(' · ') : 'No cost',
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
        onActivate: () => activate(selected, effCurrency, eco),
        onRoll: doRoll,
        push: isPilotDeck ? undefined : { disabled: roll === null, onPush: doPush },
        applyLabel: applied ? 'Applied' : 'Apply',
        applyDisabled: roll === null || applied || applyRouted,
        onApply: () => roll && doApply(roll),
        onClear: resetResolve,
      },
      roll: roll
        ? {
            roll: roll.roll,
            band: roll.band,
            bandLabel: CORE_ROLL_BANDS[roll.band].label,
            bandSummary: CORE_ROLL_BANDS[roll.band].summary,
          }
        : null,
      pushLog,
      applied,
      applyRouted,
    }
    return <ActionsDeckView view={view} />
  }

  // ---- List view: filter → group → render ----
  const byTab = deck.filter((pa) => tabMatchesAction(tab, pa.action))
  const visible =
    sourceFilter === null ? byTab : byTab.filter((pa) => pa.ownerName === sourceFilter)
  const groups = grouping === 'source' ? groupBySource(visible) : groupByTiming(visible)
  const reach = reachSummary(visible, range, heatCtx.currentHeat, heatCtx.heatCap)

  // Source tags come from the whole deck so they never vanish under a tab filter.
  const sources = groupBySource(deck).map((g) => ({
    label: g.label,
    stamp: g.items[0]?.stamp ?? 'SYS',
  }))
  const familyClass = isPilotDeck ? 'pc-deck-fam-pilot' : 'pc-deck-fam-mech'

  const deckGroups: DeckGroup[] = groups.map((group) => ({
    label: group.label,
    rows: group.items.map((action) => {
      const reachable = actionReachable(action, range, heatCtx.currentHeat, heatCtx.heatCap)
      return {
        key: action.key,
        // The raw action entity drives the canonical shortform badge card; the
        // deck no longer hand-assembles stamp/name/meta/cost rows.
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
    }),
  }))

  const view: ActionsDeckViewModel = {
    kind: 'list',
    tabs: TIMING_TABS,
    activeTab: tab,
    onTab: (t) => {
      const next = TIMING_TABS.find((x) => x === t)
      if (next !== undefined) setTab(next)
    },
    groupingLabel: grouping === 'source' ? 'Source' : 'Timing',
    groupingTitle: grouping === 'source' ? 'Group by timing' : 'Group by source',
    onToggleGrouping: () => setGrouping((g) => (g === 'source' ? 'timing' : 'source')),
    rangeBands: RANGE_BANDS,
    activeRange: range,
    onRange: (b) => {
      const next = RANGE_BANDS.find((x) => x === b)
      if (next !== undefined) setRange(next)
    },
    reachText: `${reach.inReach} / ${reach.total} in reach`,
    sources,
    sourceFilter,
    onSourceFilter: setSourceFilter,
    familyClass,
    // Action badges ghost the deck's host tone: pilot on foot, mech when boarded.
    hostTone: isPilotDeck ? 'var(--color-pilot)' : 'var(--color-mech)',
    groups: deckGroups,
    onOpen: (key) => {
      const action = deck.find((a) => a.key === key)
      if (action) open(action)
    },
  }
  return <ActionsDeckView view={view} />
}
