/**
 * ActionsDeck — the Actions instrument on the ONE light display surface
 * (plan §5, workstream D1). It lists the active entity's activatable actions and
 * opens a resolve panel for the selected one:
 *
 *   Activate  → pay EP/AP + Hot Heat, decrement Uses (auto bookkeeping, ADR-007)
 *   Roll      → the Core Mechanic d20 + its band (component state, never stored)
 *   Push      → reroll the d20, +2 Heat, forcing a Heat Check (mech deck only)
 *   Close     → back to the list
 *
 * The deck is a filterable instrument:
 *   - Timing tabs (All / Turn / Short / Long / Free / React) filter by actionType.
 *   - A grouping toggle switches between grouping-by-timing and grouping-by-source.
 *   - Source tags filter the deck to one owner (chassis / a system / an ability …).
 *   - A range selector (C/M/L/F) + reach readout compares each action's declared
 *     range to the self-declared band; out-of-range / heat-locked / destroyed
 *     actions are DIMMED in place, never hidden (mockup `acell`).
 *
 * On foot (`mount === 'pilot'`) the deck is the pilot's abilities + equipment on
 * the AP economy; boarded, it is the mech's chassis + systems + modules on EP.
 * Each card reuses suref-react's `ActionCard` verbatim in the resolve panel — the
 * deck layers Dashboard controls around it, never replaces it.
 */

import { useState } from 'react'
import { ActionCard } from 'suref-react'

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
  actionMicroMeta,
  actionReachable,
  buildMechActions,
  buildPilotActions,
  groupBySource,
  groupByTiming,
  pilotActivationPatch,
  pushPatch,
  reachSummary,
  tabMatchesAction,
  RANGE_BANDS,
  TIMING_TABS,
} from './dashboardRules'
import type { PlayAction, RangeBand, TimingTab } from './dashboardRules'

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

  const [tab, setTab] = useState<TimingTab>('All')
  const [grouping, setGrouping] = useState<'source' | 'timing'>('source')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)

  const selected = deck.find((a) => a.key === selectedKey) ?? null

  function open(action: PlayAction) {
    setSelectedKey(action.key)
    setRoll(null)
    setActivated(false)
    setPushLog(null)
  }

  function close() {
    setSelectedKey(null)
    setRoll(null)
    setActivated(false)
    setPushLog(null)
  }

  function activate(action: PlayAction) {
    if (action.currency === 'AP') {
      if (!pilot) return
      const fresh = s.get('pilot', pilot.id) ?? pilot
      const patch = pilotActivationPatch({
        apCost: action.economy.epCost,
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
      economy: action.economy,
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

  function doRoll() {
    setRoll(performCoreRoll(defaultRoll))
    setPushLog(null)
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
  }

  if (deck.length === 0) {
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-empty">
          {isPilotDeck
            ? 'This pilot has no activatable actions.'
            : 'This mech has no activatable actions.'}
        </div>
      </div>
    )
  }

  if (selected) {
    const eco = selected.economy
    const cost: string[] = []
    if (eco.epCost > 0) cost.push(`${eco.epCost} ${selected.currency}`)
    if (eco.heat > 0) cost.push(`+${eco.heat} Heat`)
    if (eco.maxUses > 0) cost.push(`Uses ${eco.maxUses}`)

    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-panel">
          <div className="pc-deck-panel-head">
            <button type="button" className="pc-deck-back" onClick={close}>
              ‹ All actions
            </button>
            <span className="pc-deck-cost">{cost.length > 0 ? cost.join(' · ') : 'No cost'}</span>
          </div>

          <ActionCard data={selected.action} />

          <div className="pc-deck-controls">
            <button
              type="button"
              className="pc-deck-btn"
              onClick={() => activate(selected)}
              disabled={activated}
            >
              {activated ? 'Activated' : 'Activate'}
            </button>
            <button type="button" className="pc-deck-btn" onClick={doRoll}>
              Roll
            </button>
            {!isPilotDeck && (
              <button
                type="button"
                className="pc-deck-btn pc-deck-btn-danger"
                onClick={doPush}
                disabled={roll === null}
                title="Reroll the d20, +2 Heat, forcing a Heat Check"
              >
                Push
              </button>
            )}
          </div>

          {roll && (
            <div className="pc-deck-roll" data-band={roll.band}>
              <span className="pc-deck-d20">{roll.roll}</span>
              <div className="pc-deck-band">
                <strong>{CORE_ROLL_BANDS[roll.band].label}</strong>
                <span>{CORE_ROLL_BANDS[roll.band].summary}</span>
              </div>
            </div>
          )}
          {pushLog && <p className="pc-deck-pushlog">{pushLog}</p>}
        </div>
      </div>
    )
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
    kind: g.items[0]?.kind ?? 'system',
  }))
  const familyClass = isPilotDeck ? 'pc-deck-fam-pilot' : 'pc-deck-fam-mech'

  return (
    <div className="pc-display-scroll">
      <div className="pc-deck-controls-bar">
        <div className="pc-deck-tabs" role="tablist" aria-label="Filter actions by timing">
          {TIMING_TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`pc-deck-tab${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="pc-deck-toolrow">
          <button
            type="button"
            className="pc-deck-tool"
            onClick={() => setGrouping((g) => (g === 'source' ? 'timing' : 'source'))}
            title={grouping === 'source' ? 'Group by timing' : 'Group by source'}
          >
            Group: {grouping === 'source' ? 'Source' : 'Timing'}
          </button>
          <div className="pc-deck-range">
            {RANGE_BANDS.map((band: RangeBand) => (
              <button
                key={band}
                type="button"
                aria-pressed={range === band}
                className={`pc-deck-range-btn${range === band ? ' is-active' : ''}`}
                onClick={() => setRange(band)}
                title={`Set engagement range to ${band}`}
              >
                {band[0]}
              </button>
            ))}
            <span className="pc-deck-reach">
              {reach.inReach} / {reach.total} in reach
            </span>
          </div>
        </div>

        {sources.length > 1 && (
          <div className={`pc-deck-sources ${familyClass}`}>
            <button
              type="button"
              aria-pressed={sourceFilter === null}
              className={`pc-deck-source${sourceFilter === null ? ' is-active' : ''}`}
              onClick={() => setSourceFilter(null)}
            >
              All
            </button>
            {sources.map((src) => (
              <button
                key={`${src.stamp}:${src.label}`}
                type="button"
                aria-pressed={sourceFilter === src.label}
                className={`pc-deck-source${sourceFilter === src.label ? ' is-active' : ''}`}
                onClick={() => setSourceFilter((cur) => (cur === src.label ? null : src.label))}
                title={`Filter the deck to “${src.label}” actions.`}
              >
                <span className="pc-deck-stamp">{src.stamp}</span>
                {src.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="pc-deck-empty">No actions match this filter.</div>
      ) : (
        <div className="pc-deck">
          {groups.map((group) => (
            <section key={group.label} className="pc-deck-group">
              <h3 className="pc-deck-group-lab">{group.label}</h3>
              <ul className="pc-deck-list">
                {group.items.map((action) => {
                  const reachable = actionReachable(
                    action,
                    range,
                    heatCtx.currentHeat,
                    heatCtx.heatCap
                  )
                  const meta = actionMicroMeta(action)
                  const lockTitle =
                    action.condition === 'destroyed'
                      ? 'Destroyed'
                      : !reachable
                        ? 'Out of range / overheat'
                        : undefined
                  return (
                    <li key={action.key}>
                      <button
                        type="button"
                        className={`pc-deck-item${reachable ? '' : ' is-locked'}`}
                        onClick={() => open(action)}
                        title={lockTitle}
                      >
                        <span className="pc-deck-item-main">
                          <span className="pc-deck-stamp">{action.stamp}</span>
                          <span className="pc-deck-item-name">{action.name}</span>
                          {meta.length > 0 && (
                            <span className="pc-deck-item-meta">{meta.join(' · ')}</span>
                          )}
                        </span>
                        {action.economy.epCost > 0 && (
                          <span className="pc-deck-item-cost">
                            {action.economy.epCost} {action.currency}
                          </span>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
