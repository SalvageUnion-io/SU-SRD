/**
 * HeatCheckControl — the Heat Check / Reactor Overload live-play loop (Slice C, #199).
 *
 * Core Book p.233-235. Renders two controls — "Heat Check" and "Push" — plus a
 * readout of the last result. Semi-automated: deterministic effects (SP damage,
 * shutdown/vulnerable, destroyed) are applied to the mech via the store, but the
 * 2-5 / 6-10 bands (System / Module destroyed) only show an advisory prompting
 * the player to mark the affected item via the existing ConditionToggle — this
 * component never auto-picks a System/Module.
 *
 * Heat Check: rolls d20 vs current Heat; overloads when roll <= heat, then rolls
 * the Reactor Overload Table and applies/records the outcome.
 *
 * Push: +2 Heat (clamped to cap), then an immediate Heat Check.
 *
 * readOnly: renders the last-result readout only — no roll buttons, no mutation.
 *
 * The d20 is dep-injectable via `roll` so tests are deterministic.
 */

import { useState } from 'react'

import { performHeatCheck, performPush } from '../../lib/rules/heatCheck'
import type { HeatCheckEffect, Roll } from '../../lib/rules/heatCheck'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { HeatCheckResult, Mech, ReactorOverloadOutcome } from '../../lib/schemas/mech'
import type { useEntityStore } from '../../stores/entityStore'

type HeatCheckControlProps = {
  mech: Mech
  /** Heat Cap from the resolved chassis (current heat is clamped to this). */
  heatCap: number
  /** Current SP — used for overheat damage. */
  currentSP: number
  /** Current Heat — the value the d20 is compared against. */
  currentHeat: number
  /** Injectable store — defaults to useEntityStore. */
  store: typeof useEntityStore
  /** Injectable d20 roller — defaults to a Math.random-backed roll. */
  roll?: Roll
  /** When true, no roll controls render and nothing mutates. */
  readOnly?: boolean
}

const OUTCOME_LABEL: Record<ReactorOverloadOutcome, string> = {
  meltdown: 'Catastrophic Meltdown — mech DESTROYED',
  'system-destroyed': 'A System is destroyed — mark one below',
  'module-destroyed': 'A Module is destroyed — mark one below',
  overheat: 'Reactor Overheat — mech shuts down, Vulnerable, takes SP damage',
  safe: 'Safe — no effect',
}

function describeResult(result: HeatCheckResult): string {
  if (!result.overloaded) {
    return `Heat Check: rolled ${result.heatCheckRoll} vs Heat ${result.heatAtCheck} — passed (no overload)`
  }
  const band = result.outcome ? OUTCOME_LABEL[result.outcome] : ''
  return `OVERLOAD: rolled ${result.heatCheckRoll} vs Heat ${result.heatAtCheck}. Reactor Overload ${result.overloadRoll}: ${band}`
}

export function HeatCheckControl({
  mech,
  heatCap,
  currentSP,
  currentHeat,
  store,
  roll = defaultRoll,
  readOnly = false,
}: HeatCheckControlProps) {
  const storeState = store()
  const [choicePrompt, setChoicePrompt] = useState<ReactorOverloadOutcome | null>(null)

  async function applyEffect(effect: HeatCheckEffect, heatToPersist?: number) {
    // Read the freshest mech from the store so rapid actions don't stomp.
    const fresh = (storeState.get('mech', mech.id) ?? mech) as Mech
    const patch: Partial<Mech> = { lastHeatCheck: effect.result }

    if (heatToPersist !== undefined && heatToPersist !== fresh.currentHeat) {
      patch.currentHeat = heatToPersist
    }
    if (effect.shutdown) {
      patch.shutdown = true
      patch.vulnerable = true
      patch.currentSP = effect.nextSP
    }
    if (effect.destroyed) {
      patch.destroyed = true
    }

    setChoicePrompt(effect.requiresPlayerChoice ? (effect.result.outcome ?? null) : null)
    await storeState.update('mech', mech.id, patch)
  }

  async function handleHeatCheck() {
    const effect = performHeatCheck({ heat: currentHeat, currentSP, roll })
    await applyEffect(effect)
  }

  async function handlePush() {
    const { nextHeat, effect } = performPush({
      heat: currentHeat,
      heatCap,
      currentSP,
      roll,
    })
    await applyEffect(effect, nextHeat)
  }

  const last = mech.lastHeatCheck

  return (
    <div className="rounded border-[1.5px] border-su-black bg-su-paper p-3">
      <h3 className="font-cond text-sm font-bold uppercase tracking-wide text-su-ink-soft mb-2">
        Heat Check
      </h3>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              void handleHeatCheck()
            }}
            className="rounded border-[1.5px] border-su-black bg-su-black px-3 py-1.5 font-cond text-xs font-bold uppercase tracking-wide text-su-paper transition-colors hover:bg-su-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          >
            Heat Check
          </button>
          <button
            type="button"
            onClick={() => {
              void handlePush()
            }}
            className="rounded border-[1.5px] border-su-rust bg-su-paper px-3 py-1.5 font-cond text-xs font-bold uppercase tracking-wide text-su-rust transition-colors hover:bg-su-rust hover:text-su-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            title="+2 Heat, then a Heat Check"
          >
            Push (+2 Heat)
          </button>
        </div>
      )}

      {last && (
        <p
          role="status"
          className="mt-2 text-sm text-su-black"
          data-overloaded={last.overloaded}
          data-outcome={last.outcome ?? ''}
        >
          {describeResult(last)}
        </p>
      )}

      {!readOnly && choicePrompt && (
        <p
          role="alert"
          className="mt-2 rounded border-[1.5px] border-su-sickly-yellow bg-su-paper px-3 py-2 text-sm text-su-rust"
        >
          {choicePrompt === 'system-destroyed'
            ? 'Mark one System as Destroyed using its condition toggle below.'
            : 'Mark one Module as Destroyed using its condition toggle below.'}
        </p>
      )}

      {mech.destroyed && (
        <p role="alert" className="mt-2 font-cond text-sm font-bold uppercase text-su-rust">
          Mech destroyed
        </p>
      )}
      {mech.shutdown && !mech.destroyed && (
        <p className="mt-1 font-cond text-xs font-bold uppercase text-su-rust">
          Shut down · Vulnerable
        </p>
      )}
    </div>
  )
}
