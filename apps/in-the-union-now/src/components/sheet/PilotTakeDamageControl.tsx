/**
 * PilotTakeDamageControl — the pilot "Take Damage" / Critical Injury loop
 * (design-review R-1; Core Book p.241). Follows the HeatCheckControl /
 * ADR-007 pattern: deterministic bookkeeping auto-applies (the HP reduction,
 * the recorded roll, 1 HP on Miraculous Survival, the recoverable
 * 'Unconscious' condition), while the max-HP-reducing injury is offered for
 * the player to ACCEPT into the injuries list — and a Fatal Injury (roll 1)
 * is advisory only: the app never kills a pilot automatically.
 *
 * Damage intake: enter the weapon's listed damage, pick what it lists (HP
 * 1:1, or SP — pilots take DOUBLE listed SP damage, p.241) and toggle
 * Vulnerable ×2 (defaults on when the pilot carries a Vulnerable condition).
 * While the pilot sits at 0 HP a prompt offers the Critical Injury Table
 * roll; the result is auto-recorded to `lastCriticalInjury`.
 *
 * readOnly renders the last-result readout only — no inputs, no mutation.
 *
 * The d20 is dep-injectable via `roll` so tests are deterministic.
 */

import { useState } from 'react'
import { Btn, Slab } from 'suref-react'

import { clampPilotCurrentStats, pilotMaxHP } from '../../lib/rules/derivedStats'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { Roll } from '../../lib/rules/heatCheck'
import { applyPilotDamage, performCriticalInjury } from '../../lib/rules/takeDamage'
import type { DamageKind } from '../../lib/rules/takeDamage'
import type { CriticalInjuryOutcome, Injury, Pilot } from '../../lib/schemas/pilot'
import type { useEntityStore } from '../../stores/entityStore'

type PilotTakeDamageControlProps = {
  pilot: Pilot
  /** Injectable store — defaults to useEntityStore. */
  store: typeof useEntityStore
  /** Injectable d20 roller — defaults to a randsum-backed roll. */
  roll?: Roll
  /** When true, no controls render and nothing mutates. */
  readOnly?: boolean
}

const OUTCOME_LABEL: Record<CriticalInjuryOutcome, string> = {
  fatal:
    'Fatal Injury — your Pilot dies. The app never marks this automatically; record it how your table plays it.',
  'major-injury':
    'Major Injury — −2 max HP until healed in a Tech 5-6 Med Bay. In addition, you are Unconscious.',
  'minor-injury':
    'Minor Injury — −1 max HP until healed in a Tech 3-4 Med Bay. In addition, you are Unconscious.',
  unconscious:
    'Unconscious — stable at 0 HP; you cannot move or act until you regain at least 1 HP.',
  'miraculous-survival':
    'Miraculous Survival — you have 1 HP, remain conscious and can act normally.',
}

const UNCONSCIOUS_CONDITION = 'Unconscious'

export function PilotTakeDamageControl({
  pilot,
  store,
  roll = defaultRoll,
  readOnly = false,
}: PilotTakeDamageControlProps) {
  const storeState = store()
  const [amountText, setAmountText] = useState('')
  const [kind, setKind] = useState<DamageKind>('hp')
  // Vulnerable ×2 tracks the pilot's condition list until the player overrides.
  const [vulnerableOverride, setVulnerableOverride] = useState<boolean | null>(null)
  const vulnerable =
    vulnerableOverride ?? pilot.conditions.some((c) => c.trim().toLowerCase() === 'vulnerable')
  const [lastApplied, setLastApplied] = useState<string | null>(null)
  const [pendingInjury, setPendingInjury] = useState<'minor' | 'major' | null>(null)

  const maxHP = Math.max(0, pilotMaxHP(pilot))
  const currentHP = Math.min(pilot.currentHP ?? maxHP, maxHP)

  const amount = Number.parseInt(amountText, 10)
  const amountValid = Number.isInteger(amount) && amount > 0

  /** Freshest pilot record from the store, falling back to the render prop. */
  function freshPilot(): Pilot {
    return storeState.get('pilot', pilot.id) ?? pilot
  }

  async function applyDamage() {
    if (!amountValid) return
    const fresh = freshPilot()
    const hp = Math.min(fresh.currentHP ?? maxHP, maxHP)
    const effect = applyPilotDamage({ currentHP: hp, amount, kind, vulnerable })
    setLastApplied(
      `Took ${effect.effectiveDamage} HP damage — HP ${hp} → ${effect.nextHP}` +
        (effect.criticalDue ? '. Roll on the Critical Injury Table.' : '')
    )
    setPendingInjury(null)
    setAmountText('')
    await storeState.update('pilot', pilot.id, { currentHP: effect.nextHP })
  }

  async function rollCritical() {
    const effect = performCriticalInjury({ roll })
    const fresh = freshPilot()
    const patch: Partial<Pilot> = { lastCriticalInjury: effect.result }
    if (effect.nextHP !== null) {
      patch.currentHP = effect.nextHP
    }
    if (effect.unconscious) {
      const has = fresh.conditions.some(
        (c) => c.trim().toLowerCase() === UNCONSCIOUS_CONDITION.toLowerCase()
      )
      if (!has) {
        patch.conditions = [...fresh.conditions, UNCONSCIOUS_CONDITION]
      }
    }
    setPendingInjury(effect.injury)
    setLastApplied(null)
    await storeState.update('pilot', pilot.id, patch)
  }

  /** Player accepts the rolled injury — appended to the injuries schema
   *  (severity drives the derived max HP) with current stats re-clamped. */
  async function acceptInjury() {
    if (!pendingInjury) return
    const fresh = freshPilot()
    const rolled = fresh.lastCriticalInjury?.roll
    const injuries: Injury[] = [
      ...(fresh.injuries ?? []),
      {
        severity: pendingInjury,
        note: `Critical Injury${rolled !== undefined ? ` (rolled ${rolled})` : ''}`,
      },
    ]
    const clamp = clampPilotCurrentStats({ ...fresh, injuries })
    setPendingInjury(null)
    await storeState.update('pilot', pilot.id, { injuries, ...clamp })
  }

  const last = pilot.lastCriticalInjury
  const inputClass =
    'w-16 rounded-[3px] border-[1.5px] border-ink bg-paper px-2 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

  return (
    <div>
      <Slab label="Take Damage" />

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={1}
            value={amountText}
            aria-label="Damage amount"
            placeholder="0"
            onChange={(e) => setAmountText(e.target.value)}
            className={inputClass}
          />
          <span role="group" aria-label="Weapon damage type" className="inline-flex gap-1">
            <Btn
              size="sm"
              variant={kind === 'hp' ? 'primary' : undefined}
              aria-pressed={kind === 'hp'}
              title="Weapon lists HP damage — applies 1:1"
              onClick={() => setKind('hp')}
            >
              HP damage
            </Btn>
            <Btn
              size="sm"
              variant={kind === 'sp' ? 'primary' : undefined}
              aria-pressed={kind === 'sp'}
              title="Weapon lists SP damage — pilots take double"
              onClick={() => setKind('sp')}
            >
              SP damage (×2)
            </Btn>
          </span>
          <label className="flex items-center gap-1.5 font-cond text-xs font-bold uppercase text-wk-muted">
            <input
              type="checkbox"
              checked={vulnerable}
              aria-label="Vulnerable — takes double damage"
              onChange={(e) => setVulnerableOverride(e.target.checked)}
              className="accent-rust"
            />
            Vulnerable ×2
          </label>
          <Btn
            size="sm"
            variant="primary"
            disabled={!amountValid}
            aria-label="Apply damage"
            onClick={() => {
              void applyDamage()
            }}
          >
            Apply
          </Btn>
        </div>
      )}

      <div className="mt-2 min-h-[1.5rem]">
        {lastApplied && (
          <p role="status" className="font-body text-sm text-ink">
            {lastApplied}
          </p>
        )}

        {last && (
          <p role="status" className="font-body text-sm text-ink" data-outcome={last.outcome}>
            Critical Injury {last.roll}: {OUTCOME_LABEL[last.outcome]}
          </p>
        )}

        {!readOnly && currentHP === 0 && maxHP > 0 && (
          <div
            role="alert"
            className="mt-2 rounded-[3px] border-[1.5px] border-status-warn bg-paper px-3 py-2"
          >
            <p className="m-0 font-body text-sm text-rust">
              0 HP — roll on the Critical Injury Table.
            </p>
            <Btn
              size="sm"
              variant="danger"
              className="mt-1.5"
              aria-label="Roll Critical Injury"
              onClick={() => {
                void rollCritical()
              }}
            >
              Roll Critical Injury
            </Btn>
          </div>
        )}

        {!readOnly && pendingInjury && (
          <div
            role="alert"
            className="mt-2 rounded-[3px] border-[1.5px] border-status-warn bg-paper px-3 py-2"
          >
            <p className="m-0 font-body text-sm text-rust">
              {pendingInjury === 'major'
                ? 'Major Injury — accept to record −2 max HP (heals in a Tech 5-6 Med Bay).'
                : 'Minor Injury — accept to record −1 max HP (heals in a Tech 3-4 Med Bay).'}
            </p>
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <Btn
                size="sm"
                variant="primary"
                aria-label={`Accept ${pendingInjury} injury`}
                onClick={() => {
                  void acceptInjury()
                }}
              >
                Accept Injury
              </Btn>
              <Btn size="sm" variant="ghost" onClick={() => setPendingInjury(null)}>
                Dismiss
              </Btn>
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
