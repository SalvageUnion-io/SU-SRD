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
 * the AP economy. Boarded, it is BOTH: the mech's chassis + systems + modules on
 * EP *and* the pilot's own actions on AP — the pilot is in the cockpit, so their
 * abilities and equipment never leave the table. The two economies coexist in one
 * flat deck; `PlayAction.currency` (not the mount) decides what an activation
 * spends and whether it touches Heat.
 */

import type { ActionsDeckView as ActionsDeckViewModel, DeckRow } from 'component-lib'
import { ActionsDeck as ActionsDeckView } from 'component-lib'
import { useState } from 'react'
import { canActivateAction, resolveChassisRef } from 'salvageunion-reference/rules'
import type { CoreRollResult } from '../../lib/rules/coreMechanic'
import { CORE_ROLL_BANDS, describePushOutcome, performCoreRoll } from '../../lib/rules/coreMechanic'
import { mechMaxEP, mechMaxHeat, mechMaxSP, pilotMaxAP } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { Mech } from '../../lib/schemas/mech'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import type { MountState } from '../../stores/playStateStore'
import { usePlayStateStore } from '../../stores/playStateStore'
import { DASHBOARD_TXN } from '../../stores/surfaceProvenance'
import type { MechItemEconomy } from '../sheet/mechItemRules'
import type { PlayStore } from './ActiveItemBand'
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
  RANGE_BANDS,
  reachSummary,
  TIMING_TABS,
  tabMatchesAction,
} from './dashboardRules'

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

  // On foot the mech's actions are unreachable; boarded, the pilot's own actions
  // ride along with the mech's in one deck (SU pilots keep their abilities and
  // equipment in the cockpit).
  const onFoot = mount === 'pilot'
  const pilotDeck = pilot ? buildPilotActions(pilot) : []
  const deck = onFoot ? pilotDeck : [...buildMechActions(mech), ...pilotDeck]

  // Heat context for reach + heat-lock (pilots carry no heat).
  const heatCtx = (() => {
    if (onFoot) return { currentHeat: 0, heatCap: HUGE_HEAT_CAP }
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
      // An unrecorded live stat means UNSPENT, not empty — a pilot who has never
      // spent AP is at full AP. Defaulting to 0 here banked the spend against an
      // empty pool and wrote AP 0 on the first activation. The stored value stays
      // authoritative when present (same rule as ActiveItemBand's damage write):
      // never clamp it here, since an unresolved ref makes the max 0.
      const patch = pilotActivationPatch({
        apCost: economy.epCost,
        currentAP: fresh.currentAP ?? pilotMaxAP(fresh),
      })
      if (Object.keys(patch).length > 0) void s.update('pilot', pilot.id, patch, DASHBOARD_TXN)
      setActivated(true)
      return
    }
    const chassis = resolveChassisRef(mech.chassisRef)
    const fresh = s.get('mech', mech.id) ?? mech
    const heatCap = mechMaxHeat(fresh, chassis)
    const patch = activationPatch({
      slug: action.slug,
      economy,
      // Unrecorded EP means a mech that has never spent any — full, not empty.
      currentEP: fresh.currentEP ?? mechMaxEP(fresh, chassis),
      currentHeat: fresh.currentHeat ?? 0,
      heatCap,
      prevUses: fresh.itemUses,
    })
    if (Object.keys(patch).length > 0) {
      void s.update('mech', mech.id, patch, DASHBOARD_TXN)
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
      heat: Math.min(fresh.currentHeat ?? 0, cap),
      heatCap: cap,
      // Unrecorded SP means undamaged. At 0 an Overheat wrote the mech straight
      // to SP 0 — one hit from destroyed — without it ever having taken damage.
      currentSP: fresh.currentSP ?? mechMaxSP(fresh, chassis),
      roll: defaultRoll,
    })
    void s.update('mech', mech.id, patch, DASHBOARD_TXN)
    setRoll(performCoreRoll(defaultRoll))
    setPushLog(describePushOutcome(nextHeat, effect))
    setApplied(false)
    setApplyRouted(false)
  }

  if (deck.length === 0) {
    const text = onFoot
      ? 'This pilot has no activatable actions.'
      : 'This mech and pilot have no activatable actions.'
    return <ActionsDeckView view={{ kind: 'empty', text }} />
  }

  if (selected) {
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

    const cost: string[] = []
    if (eco.epCost > 0) cost.push(`${eco.epCost} ${effCurrency}`)
    if (heatApplies && eco.heat > 0) cost.push(`+${eco.heat} Heat`)
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
        push: isPilotAction ? undefined : { disabled: roll === null, onPush: doPush },
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

  // ---- List view: filter → render (ONE flat grid, no source/timing headings) ----
  const byTab = deck.filter((pa) => tabMatchesAction(tab, pa.action))
  const visible =
    sourceFilter === null ? byTab : byTab.filter((pa) => pa.ownerName === sourceFilter)
  const reach = reachSummary(visible, range, heatCtx.currentHeat, heatCtx.heatCap)

  // Source tags come from the whole deck so they never vanish under a tab filter.
  // They are the only place a source name still appears — the grid itself files
  // no action under a heading.
  const sources = groupBySource(deck).map((g) => ({
    label: g.label,
    stamp: g.items[0]?.stamp ?? 'SYS',
  }))
  const familyClass = onFoot ? 'pc-deck-fam-pilot' : 'pc-deck-fam-mech'

  const rows: DeckRow[] = visible.map((action) => {
    const reachable = actionReachable(action, range, heatCtx.currentHeat, heatCtx.heatCap)
    return {
      key: action.key,
      // The raw action entity drives the canonical catalog tile; the deck no
      // longer hand-assembles stamp/name/meta/cost rows.
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

  const view: ActionsDeckViewModel = {
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
      if (next !== undefined) setRange(next)
    },
    reachText: `${reach.inReach} / ${reach.total} in reach`,
    sources,
    sourceFilter,
    onSourceFilter: setSourceFilter,
    familyClass,
    // Action tiles ghost the deck's host tone: pilot on foot, mech when boarded.
    hostTone: onFoot ? 'var(--color-pilot)' : 'var(--color-mech)',
    rows,
    onOpen: (key) => {
      const action = deck.find((a) => a.key === key)
      if (action) open(action)
    },
  }
  return <ActionsDeckView view={view} />
}
