/**
 * ActionsDeck — the Actions instrument on the ONE light display surface. It
 * lists the active entity's activatable actions and opens a resolve panel for
 * the selected one.
 *
 * `ActionsDeck` is the rules + store half: it builds the actions and drives the
 * resolve flow (Activate / Roll / Push / Apply) under the ADR-007 automation
 * boundary, then hands a pure `ActionsDeckModel` to `ActionsDeckFrame`, which
 * only renders and calls back — the reference card in the resolve panel is the
 * reused ReferenceEntityCard. The frame lived in component-lib with ITUN as its
 * only consumer, imported `as ActionsDeckView`; one file since the
 * component-lib boundary audit (PK-03).
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

import type { ReferenceCardEntity } from 'component-lib'
import { Badge, Button, ReferenceEntityCard } from 'component-lib'
import { useState } from 'react'
import {
  canActivateAction,
  resolveChassisRef,
  resolveGauge,
  resolvePoolStart,
} from 'salvageunion-reference/rules'
import { resolveEffectiveCrawlerLevel } from '../../lib/crawlerLevel'
import type { CoreRollResult } from '../../lib/rules/coreMechanic'
import { CORE_ROLL_BANDS, describePushOutcome, performCoreRoll } from '../../lib/rules/coreMechanic'
import { mechMaxEP, mechMaxHeat, mechMaxSP, pilotMaxAP } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { runWrite } from '../../lib/runWrite'
import type { Crawler } from '../../lib/schemas/crawler'
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

/**
 * A render-ready action card. The action ENTITY drives a CATALOG-extent
 * `ReferenceEntityCard` tile — the same index tile the SRD catalog renders — so
 * the deck reuses the canonical action rendering instead of a hand-rolled row.
 * The card states its own name, so the deck adds no describing label above it.
 * Reach/lock is resolved by the caller and layered on top (dim + tooltip), never
 * baked into the card.
 */
export type DeckRow = {
  key: string
  /** Any card-renderable entity — ACTIONS are meta-entities, not `SURefEntity`. */
  entity: ReferenceCardEntity
  /** Accessible name for the clickable tile (the action name). */
  name: string
  locked: boolean
  lockTitle?: string
}

export type ActionsDeckResolve = {
  onBack: () => void
  costLabel: string
  entity: ReferenceCardEntity
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
    activateLabel: string
    activateDisabled: boolean
    activateTitle?: string
    onActivate: () => void
    onRoll: () => void
    push?: { disabled: boolean; onPush: () => void }
    applyLabel: string
    applyDisabled: boolean
    onApply: () => void
    onClear: () => void
  }
  roll?: { roll: number; band: string; bandLabel: string; bandSummary: string } | null
  pushLog?: string | null
  applied: boolean
  applyRouted: boolean
}

export type ActionsDeckList = {
  tabs: readonly string[]
  activeTab: string
  onTab: (tab: string) => void
  rangeBands: readonly string[]
  activeRange: string
  onRange: (band: string) => void
  reachText: string
  sources: { label: string; stamp: string }[]
  sourceFilter: string | null
  onSourceFilter: (source: string | null) => void
  familyClass: string
  /** Host tone the action tiles GHOST (mech vs pilot) — a resolvable CSS colour. */
  hostTone: string
  /** The whole deck, flat — one grid, no source/timing headings above it. */
  rows: DeckRow[]
  onOpen: (key: string) => void
}

export type ActionsDeckModel =
  | { kind: 'empty'; text: string }
  | ({ kind: 'list' } & ActionsDeckList)
  | ({ kind: 'resolve' } & ActionsDeckResolve)

/**
 * The presentational half: renders a computed `ActionsDeckModel` and only calls
 * back. Exported for the Ladle story, which drives it with real action entities
 * and no store.
 */
export function ActionsDeckFrame({ view }: { view: ActionsDeckModel }) {
  if (view.kind === 'empty') {
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-empty">{view.text}</div>
      </div>
    )
  }

  if (view.kind === 'resolve') {
    const { currencyChoice, variableHot, controls, roll } = view
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-panel">
          <div className="pc-deck-panel-head">
            <Button variant="ghost" size="compact" onClick={view.onBack}>
              ◀ Back
            </Button>
            <span className="pc-deck-cost">{view.costLabel}</span>
          </div>

          <ReferenceEntityCard data={view.entity} />

          {currencyChoice && (
            <fieldset className="pc-deck-cost-choice">
              {/*
               * Deliberately NATIVE radios, not the chrome `Radio` primitive.
               * That primitive is a self-framed choice-row card
               * (`rounded-card border-chrome border-ink bg-paper p-2` around a
               * `font-body` label). Here the two options are compact inline
               * `pc-deck-radio` labels inside the already-bordered
               * `pc-deck-cost-choice` fieldset; the framed primitive would turn
               * the tight EP/AP pair into two bordered cards nested in a bordered
               * fieldset (foreign to this instrument). The `name` stays a real
               * radio-group form name. Adopt only once `Radio` grows a
               * bare/instrument rung (just the accent-rust input, no framed row).
               */}
              <legend className="pc-deck-cost-choice-lab">Pay with</legend>
              <label className="pc-deck-radio">
                <input
                  type="radio"
                  name="pc-deck-currency"
                  checked={currencyChoice.currency === 'EP'}
                  disabled={currencyChoice.activated}
                  onChange={() => currencyChoice.onCurrency('EP')}
                />
                {currencyChoice.epCost} EP
              </label>
              <label className="pc-deck-radio">
                <input
                  type="radio"
                  name="pc-deck-currency"
                  checked={currencyChoice.currency === 'AP'}
                  disabled={currencyChoice.activated || !currencyChoice.pilotAvailable}
                  onChange={() => currencyChoice.onCurrency('AP')}
                />
                {currencyChoice.epCost} AP
              </label>
            </fieldset>
          )}

          {variableHot && (
            <div className="pc-deck-hotx">
              <span className="pc-deck-hotx-lab">Hot</span>
              <div className="pc-step">
                <Button
                  size="compact"
                  className="min-w-0 px-2"
                  onClick={variableHot.onDec}
                  disabled={variableHot.activated}
                  aria-label="Decrease Hot"
                >
                  −
                </Button>
                <span className="pc-step-num">{variableHot.hotX}</span>
                <Button
                  size="compact"
                  className="min-w-0 px-2"
                  onClick={variableHot.onInc}
                  disabled={variableHot.activated}
                  aria-label="Increase Hot"
                >
                  +
                </Button>
              </div>
              <span className={`pc-deck-hotx-proj${variableHot.over ? ' is-over' : ''}`}>
                {variableHot.projText}
              </span>
            </div>
          )}

          <div className="pc-deck-controls">
            <Button
              size="compact"
              className="flex-1"
              onClick={controls.onActivate}
              disabled={controls.activateDisabled}
              title={controls.activateTitle}
            >
              {controls.activateLabel}
            </Button>
            <Button size="compact" className="flex-1" onClick={controls.onRoll}>
              Roll
            </Button>
            {controls.push && (
              <Button
                variant="danger"
                size="compact"
                className="flex-1"
                onClick={controls.push.onPush}
                disabled={controls.push.disabled}
                title="Reroll the d20, +2 Heat, forcing a Heat Check"
              >
                Push
              </Button>
            )}
            <Button
              size="compact"
              className="flex-1"
              onClick={controls.onApply}
              disabled={controls.applyDisabled}
              title="Commit this result"
            >
              {controls.applyLabel}
            </Button>
          </div>

          <div className="pc-deck-controls">
            <Button variant="ghost" size="compact" onClick={controls.onClear}>
              Clear
            </Button>
          </div>

          {roll && (
            <div className="pc-deck-roll" data-band={roll.band}>
              <span className="pc-deck-d20">{roll.roll}</span>
              <div className="pc-deck-band">
                <strong>{roll.bandLabel}</strong>
                <span>{roll.bandSummary}</span>
              </div>
            </div>
          )}
          {view.pushLog && <p className="pc-deck-pushlog">{view.pushLog}</p>}
          {view.applied && <p className="pc-deck-applied">Result applied ✓</p>}
          {view.applyRouted && (
            <p className="pc-deck-apply-route">
              Cascade Failure — a severe consequence. The Take-Damage control is open on the Active
              Item band above; confirm the hit there. Nothing was auto-applied.
            </p>
          )}
        </div>
      </div>
    )
  }

  // ---- List view ----
  return (
    <div className="pc-display-scroll">
      <div className="pc-deck-controls-bar">
        <div className="pc-deck-tabs" role="tablist" aria-label="Filter actions by timing">
          {view.tabs.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={view.activeTab === t}
              className={`pc-deck-tab${view.activeTab === t ? ' is-active' : ''}`}
              onClick={() => view.onTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pc-deck-toolrow">
          <div className="pc-deck-range">
            {view.rangeBands.map((band) => (
              <button
                key={band}
                type="button"
                aria-pressed={view.activeRange === band}
                className={`pc-deck-range-btn${view.activeRange === band ? ' is-active' : ''}`}
                onClick={() => view.onRange(band)}
                title={`Set engagement range to ${band}`}
              >
                {band[0]}
              </button>
            ))}
            <span className="pc-deck-reach">{view.reachText}</span>
          </div>
        </div>

        {view.sources.length > 1 && (
          <div className={`pc-deck-sources ${view.familyClass}`}>
            <button
              type="button"
              aria-pressed={view.sourceFilter === null}
              className={`pc-deck-source${view.sourceFilter === null ? ' is-active' : ''}`}
              onClick={() => view.onSourceFilter(null)}
            >
              All
            </button>
            {view.sources.map((src) => (
              <button
                key={`${src.stamp}:${src.label}`}
                type="button"
                aria-pressed={view.sourceFilter === src.label}
                className={`pc-deck-source${view.sourceFilter === src.label ? ' is-active' : ''}`}
                onClick={() =>
                  view.onSourceFilter(view.sourceFilter === src.label ? null : src.label)
                }
                title={`Filter the deck to “${src.label}” actions.`}
              >
                <Badge shape="stamp" size="mini" className="rounded-card px-1 py-px text-label">
                  {src.stamp}
                </Badge>
                {src.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {view.rows.length === 0 ? (
        <div className="pc-deck-empty">No actions match this filter.</div>
      ) : (
        <div className="pc-deck">
          {/*
           * ONE masonry grid over the whole deck — no source/timing headings, so
           * an action is never filed under a name of its own; the tile already
           * states what it is. The cards are the canonical CATALOG tile
           * (`medium` + `catalog`), the same index tile the SRD catalog renders:
           * it keeps the description but suppresses every nested element
           * (sub-entities, roll tables, choices), which is what makes it safe
           * inside this card's own `role="button"` wrapper — the full extent
           * would embed buttons whose clicks bubble into `onOpen`. Tile heights
           * differ with description length, which is what the masonry packing is
           * for. `<ul>/<li>` stays — a set of actions IS a list semantically;
           * "grid" is purely the layout.
           */}
          <ul className="pc-deck-grid">
            {view.rows.map((row) => (
              // Lock (out of range / overheat) is a caller-resolved overlay,
              // layered on the canonical card — dim + tooltip — never a
              // property of the action card itself.
              <li
                key={row.key}
                className={row.locked ? 'is-locked' : undefined}
                title={row.lockTitle}
              >
                <ReferenceEntityCard
                  data={row.entity}
                  size="medium"
                  extent="catalog"
                  // An action's roll table survives the catalog extent by design
                  // (it IS the content on an SRD index page), but its Show/Roll
                  // buttons cannot nest inside this tile's own `role="button"`.
                  // The table is one click away — the resolve panel renders the
                  // same action as a full card.
                  hide={{ rollTable: true }}
                  hostTone={view.hostTone}
                  disabled={row.locked}
                  cardClickLabel={row.name}
                  onCardClick={() => view.onOpen(row.key)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

type ActionsDeckProps = {
  mech: Mech
  /** The on-foot pilot; when `mount === 'pilot'` the deck lists their actions. */
  pilot?: Pilot | null
  /** The pilot's crawler — its tier drives Stat Training (max AP). */
  crawler?: Crawler | null
  /** Which entity owns the cockpit; defaults to the boarded mech. */
  mount?: MountState
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

const HUGE_HEAT_CAP = Number.MAX_SAFE_INTEGER

export function ActionsDeck({ mech, pilot, crawler, mount = 'mech', store }: ActionsDeckProps) {
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
    return { currentHeat: resolveGauge(fresh.currentHeat), heatCap: mechMaxHeat(fresh, chassis) }
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
      currentEP: resolvePoolStart(fresh.currentEP, mechMaxEP(fresh, chassis)),
      currentHeat: resolveGauge(fresh.currentHeat),
      heatCap,
      prevUses: fresh.itemUses,
    })
    if (Object.keys(patch).length > 0) {
      runWrite(() => s.update('mech', mech.id, patch, DASHBOARD_TXN))
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
      heat: resolveGauge(fresh.currentHeat, cap),
      heatCap: cap,
      // Unrecorded SP means undamaged. At 0 an Overheat wrote the mech straight
      // to SP 0 — one hit from destroyed — without it ever having taken damage.
      currentSP: resolvePoolStart(fresh.currentSP, mechMaxSP(fresh, chassis)),
      roll: defaultRoll,
    })
    runWrite(() => s.update('mech', mech.id, patch, DASHBOARD_TXN))
    setRoll(performCoreRoll(defaultRoll))
    setPushLog(describePushOutcome(nextHeat, effect))
    setApplied(false)
    setApplyRouted(false)
  }

  if (deck.length === 0) {
    const text = onFoot
      ? 'This pilot has no activatable actions.'
      : 'This mech and pilot have no activatable actions.'
    return <ActionsDeckFrame view={{ kind: 'empty', text }} />
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

    const view: ActionsDeckModel = {
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
    return <ActionsDeckFrame view={view} />
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

  const view: ActionsDeckModel = {
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
  return <ActionsDeckFrame view={view} />
}
