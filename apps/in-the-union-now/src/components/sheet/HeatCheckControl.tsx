/**
 * HeatCheckControl — the Heat Check / Reactor Overload live-play loop (Slice C, #199;
 * restyled onto the LiveSheet body in plan 4.5).
 *
 * Core Book p.233-235. Renders two controls — "Heat Check" and "Push" — plus a
 * readout of the last result. Semi-automated: deterministic effects (SP damage,
 * shutdown/vulnerable, destroyed) are applied to the mech via the store, but the
 * 2-5 / 6-10 bands (System / Module destroyed) only show an advisory prompting
 * the player to mark the affected item via its status badge — this component
 * never auto-picks a System/Module.
 *
 * Heat Check: rolls d20 vs current Heat; overloads when roll <= heat, then rolls
 * the Reactor Overload Table and applies/records the outcome.
 *
 * Push: +2 Heat (clamped to cap), then an immediate Heat Check.
 *
 * The automation-written shutdown / vulnerable / destroyed flags each carry a
 * manual 'Clear' affordance (gap 8) — restart-after-shutdown and hand-corrections
 * are player calls, never automated.
 *
 * readOnly: renders the last-result readout only — no roll buttons, no clears,
 * no mutation.
 *
 * The d20 is dep-injectable via `roll` so tests are deterministic.
 */

import { useState } from 'react'
import { Btn, MiniBtn, Slab, heatLevel } from 'suref-react'

import { performHeatCheck, performPush } from '../../lib/rules/heatCheck'
import type { HeatCheckEffect, Roll } from '../../lib/rules/heatCheck'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { HeatCheckResult, Mech, ReactorOverloadOutcome } from '../../lib/schemas/mech'
import type { useEntityStore } from '../../stores/entityStore'

type HeatCheckControlProps = {
  mech: Mech
  /** Derived Heat Cap (chassis + modifiers — current heat clamps to this). */
  heatCap: number
  /** Current SP — used for overheat damage. */
  currentSP: number
  /** Current Heat — the value the d20 is compared against. */
  currentHeat: number
  /** Injectable store — defaults to useEntityStore. */
  store: typeof useEntityStore
  /** Injectable d20 roller — defaults to a randsum-backed roll. */
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
    // Read the freshest mech from the store (not the render-time prop) so rapid
    // sequential actions don't stomp each other with a stale-closure overwrite.
    const fresh = storeState.get('mech', mech.id) ?? mech
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

  /** Manual clear for an automation-written flag (gap 8). */
  async function clearFlag(flag: 'shutdown' | 'vulnerable' | 'destroyed') {
    const patch: Partial<Mech> =
      flag === 'shutdown'
        ? { shutdown: false }
        : flag === 'vulnerable'
          ? { vulnerable: false }
          : { destroyed: false }
    await storeState.update('mech', mech.id, patch)
  }

  const last = mech.lastHeatCheck

  // Push gets riskier as heat climbs (U-1): danger styling at >= ~70% of cap.
  const pushIsRisky = heatLevel(currentHeat, heatCap) !== 'normal'

  return (
    <div>
      <Slab label="Heat Check" />

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Btn
            size="sm"
            variant="primary"
            onClick={() => {
              void handleHeatCheck()
            }}
          >
            Heat Check
          </Btn>
          <Btn
            size="sm"
            variant={pushIsRisky ? 'danger' : undefined}
            title="+2 Heat, then a Heat Check"
            onClick={() => {
              void handlePush()
            }}
          >
            Push (+2 Heat)
          </Btn>
        </div>
      )}

      <div className="mt-2 min-h-[1.5rem]">
        {last && (
          <p
            role="status"
            className="font-body text-sm text-ink"
            data-overloaded={last.overloaded}
            data-outcome={last.outcome ?? ''}
          >
            {describeResult(last)}
          </p>
        )}

        {!readOnly && choicePrompt && (
          <p
            role="alert"
            className="mt-2 rounded-[3px] border-[1.5px] border-status-warn bg-paper px-3 py-2 font-body text-sm text-rust"
          >
            {choicePrompt === 'system-destroyed'
              ? 'Mark one System as Destroyed using its status badge below.'
              : 'Mark one Module as Destroyed using its status badge below.'}
          </p>
        )}
      </div>

      {mech.destroyed && (
        <p
          role="alert"
          className="mt-1.5 flex flex-wrap items-center gap-2 font-cond text-xs font-bold uppercase text-status-bad"
        >
          Mech destroyed
          {!readOnly && (
            <MiniBtn
              aria-label="Clear destroyed"
              onClick={() => {
                void clearFlag('destroyed')
              }}
            >
              Clear
            </MiniBtn>
          )}
        </p>
      )}
      {mech.shutdown && !mech.destroyed && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 font-cond text-xs font-bold uppercase text-rust">
          Shut down
          {!readOnly && (
            <MiniBtn
              aria-label="Clear shutdown"
              onClick={() => {
                void clearFlag('shutdown')
              }}
            >
              Clear
            </MiniBtn>
          )}
        </p>
      )}
      {mech.vulnerable && !mech.destroyed && (
        <p className="mt-1.5 flex flex-wrap items-center gap-2 font-cond text-xs font-bold uppercase text-rust">
          Vulnerable
          {!readOnly && (
            <MiniBtn
              aria-label="Clear vulnerable"
              onClick={() => {
                void clearFlag('vulnerable')
              }}
            >
              Clear
            </MiniBtn>
          )}
        </p>
      )}
    </div>
  )
}
