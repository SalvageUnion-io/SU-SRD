/**
 * ActionsDeck — the Actions resolve flow, reachable from the Dial's "actions"
 * focus and rendered on the ONE light display surface (plan §5.2). It lists the
 * boarded mech's available actions grouped by source (Chassis Ability / Systems
 * / Modules) via `SalvageUnionReference.resolveActions`, and opens a resolve
 * panel for the selected one:
 *
 *   Activate  → pay EP + Hot Heat, decrement Uses (auto bookkeeping, ADR-007)
 *   Roll      → the Core Mechanic d20 + its band (component state, never stored)
 *   Push      → reroll the d20, +2 Heat, forcing a Heat Check on the mech
 *   Close     → back to the list
 *
 * Only Activate and Push mutate, and both are explicit clicks. The selected
 * action's reference card reuses suref-react's `ActionCard` verbatim — the deck
 * layers Dashboard controls around it, never replaces it.
 */

import { useState } from 'react'
import { ActionCard } from 'suref-react'

import { CORE_ROLL_BANDS, describePushOutcome, performCoreRoll } from '../../lib/rules/coreMechanic'
import type { CoreRollResult } from '../../lib/rules/coreMechanic'
import { defaultRoll } from '../../lib/rules/heatCheck'
import { mechMaxHeat } from '../../lib/rules/derivedStats'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import type { PlayStore } from './ActiveItemBand'
import { activationPatch, buildMechActions, pushPatch } from './dashboardRules'
import type { PlayAction } from './dashboardRules'

type ActionsDeckProps = {
  mech: Mech
  /** Injectable store (defaults to the live entity store). */
  store?: PlayStore
}

export function ActionsDeck({ mech, store }: ActionsDeckProps) {
  const liveStore = useEntityStore()
  const s: PlayStore = store ?? liveStore

  const groups = buildMechActions(mech)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [roll, setRoll] = useState<CoreRollResult | null>(null)
  const [activated, setActivated] = useState(false)
  const [pushLog, setPushLog] = useState<string | null>(null)

  const selected = groups.flatMap((g) => g.items).find((a) => a.key === selectedKey) ?? null

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

  if (groups.length === 0) {
    return (
      <div className="pc-display-scroll">
        <div className="pc-deck-empty">This mech has no activatable actions.</div>
      </div>
    )
  }

  if (selected) {
    const eco = selected.economy
    const cost: string[] = []
    if (eco.epCost > 0) cost.push(`${eco.epCost} EP`)
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
            <button
              type="button"
              className="pc-deck-btn pc-deck-btn-danger"
              onClick={doPush}
              disabled={roll === null}
              title="Reroll the d20, +2 Heat, forcing a Heat Check"
            >
              Push
            </button>
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

  return (
    <div className="pc-display-scroll">
      <div className="pc-deck">
        {groups.map((group) => (
          <section key={group.source} className="pc-deck-group">
            <h3 className="pc-deck-group-lab">{group.source}</h3>
            <ul className="pc-deck-list">
              {group.items.map((action) => (
                <li key={action.key}>
                  <button type="button" className="pc-deck-item" onClick={() => open(action)}>
                    <span className="pc-deck-item-name">{action.name}</span>
                    {action.economy.epCost > 0 && (
                      <span className="pc-deck-item-cost">{action.economy.epCost} EP</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
