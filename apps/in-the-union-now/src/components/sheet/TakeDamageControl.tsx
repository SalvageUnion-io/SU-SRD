/**
 * TakeDamageControl — the mech "Take Damage" / Critical Damage loop
 * (design-review R-1; Core Book p.239-240). Follows the HeatCheckControl /
 * ADR-007 pattern: deterministic bookkeeping auto-applies (the SP reduction,
 * the recorded roll, 1 SP on Miraculous Survival, the destroyed flag on
 * Catastrophic, the 'Chassis Damaged' condition), while WHICH System/Module
 * is destroyed is marked by the player via the item status badges — this
 * component never auto-picks one.
 *
 * Damage intake: enter the weapon's listed damage, pick what it lists (SP
 * 1:1, or HP — mechs take HALF listed HP damage, p.240) and toggle
 * Vulnerable ×2 (defaults to the mech's own vulnerable flag — a shut-down
 * mech is Vulnerable). While the mech sits at 0 SP a prompt offers the
 * Critical Damage Table roll; the result is auto-recorded to
 * `lastCriticalDamage`.
 *
 * readOnly renders the last-result readout only — no inputs, no mutation.
 *
 * The d20 is dep-injectable via `roll` so tests are deterministic.
 */

import { useState } from 'react'
import { Btn, Slab } from 'suref-react'

import { cn } from '../../lib/utils'
import { defaultRoll } from '../../lib/rules/heatCheck'
import type { Roll } from '../../lib/rules/heatCheck'
import { applyMechDamage, performCriticalDamage } from '../../lib/rules/takeDamage'
import type { DamageKind } from '../../lib/rules/takeDamage'
import type { CriticalDamageOutcome, Mech } from '../../lib/schemas/mech'
import type { useEntityStore } from '../../stores/entityStore'
import { destroyedUndoToast } from './destroyedUndoToast'

type TakeDamageControlProps = {
  mech: Mech
  /** Current SP (derived fallback applied by the caller). */
  currentSP: number
  /** Injectable store — defaults to useEntityStore. */
  store: typeof useEntityStore
  /** Injectable d20 roller — defaults to a randsum-backed roll. */
  roll?: Roll
  /** When true, no controls render and nothing mutates. */
  readOnly?: boolean
}

const OUTCOME_LABEL: Record<CriticalDamageOutcome, string> = {
  catastrophic:
    'Catastrophic Damage — mech, mounted Systems/Modules and Cargo DESTROYED. Your Pilot dies unless they have a means to escape.',
  'system-destruction':
    'System Destruction — a System is destroyed; chassis Damaged and inoperable until repaired.',
  'module-destruction':
    'Module Destruction — a Module is destroyed; chassis Damaged and inoperable until repaired.',
  'core-damage':
    'Core Damage — chassis Damaged and inoperable until repaired. Your Pilot is reduced to 0 HP unless they can escape the mech.',
  'miraculous-survival': 'Miraculous Survival — mech Intact at 1 SP, still fully operational.',
}

/**
 * Severity tone for the critical-damage readout: a Catastrophic result must
 * not read the same ink as a Miraculous Survival (pre-attentive glanceability,
 * dataviz review — the outcome text still carries the meaning, colour only
 * reinforces it).
 */
const OUTCOME_TONE: Record<CriticalDamageOutcome, string> = {
  catastrophic: 'text-status-bad',
  'system-destruction': 'text-rust',
  'module-destruction': 'text-rust',
  'core-damage': 'text-rust',
  'miraculous-survival': 'text-ink',
}

const CHASSIS_DAMAGED_CONDITION = 'Chassis Damaged'

export function TakeDamageControl({
  mech,
  currentSP,
  store,
  roll = defaultRoll,
  readOnly = false,
}: TakeDamageControlProps) {
  const storeState = store()
  const [amountText, setAmountText] = useState('')
  const [kind, setKind] = useState<DamageKind>('sp')
  // Vulnerable ×2 tracks the mech's own flag until the player overrides it.
  const [vulnerableOverride, setVulnerableOverride] = useState<boolean | null>(null)
  const vulnerable = vulnerableOverride ?? mech.vulnerable === true
  const [lastApplied, setLastApplied] = useState<string | null>(null)
  const [choicePrompt, setChoicePrompt] = useState<'system' | 'module' | null>(null)

  const amount = Number.parseInt(amountText, 10)
  const amountValid = Number.isInteger(amount) && amount > 0

  /** Freshest mech from the store — rapid actions must not stomp each other. */
  function freshMech(): Mech {
    return storeState.get('mech', mech.id) ?? mech
  }

  async function applyDamage() {
    if (!amountValid) return
    const fresh = freshMech()
    const sp = fresh.currentSP ?? currentSP
    const effect = applyMechDamage({ currentSP: sp, amount, kind, vulnerable })
    setLastApplied(
      `Took ${effect.effectiveDamage} SP damage — SP ${sp} → ${effect.nextSP}` +
        (effect.criticalDue ? '. Roll on the Critical Damage Table.' : '')
    )
    setChoicePrompt(null)
    setAmountText('')
    await storeState.update('mech', mech.id, { currentSP: effect.nextSP })
  }

  async function rollCritical() {
    const effect = performCriticalDamage({ roll })
    const fresh = freshMech()
    const patch: Partial<Mech> = { lastCriticalDamage: effect.result }
    if (effect.nextSP !== null) {
      patch.currentSP = effect.nextSP
    }
    if (effect.destroyed) {
      patch.destroyed = true
    }
    if (effect.chassisDamaged) {
      const has = fresh.conditions.some(
        (c) => c.trim().toLowerCase() === CHASSIS_DAMAGED_CONDITION.toLowerCase()
      )
      if (!has) {
        patch.conditions = [...fresh.conditions, CHASSIS_DAMAGED_CONDITION]
      }
    }
    setChoicePrompt(effect.requiresPlayerChoice)
    setLastApplied(null)
    await storeState.update('mech', mech.id, patch)
    // Destructive-write policy (audit item 25): automation-written destroyed
    // flags surface the same one-click Undo as item destruction (U-6), on
    // top of HeatCheckControl's persistent Clear strip — a mis-rolled or
    // mis-read table result shouldn't require hunting for the Clear button.
    if (effect.destroyed) {
      destroyedUndoToast(mech.name || 'Mech', () => {
        void storeState.update('mech', mech.id, { destroyed: undefined })
      })
    }
  }

  const last = mech.lastCriticalDamage
  const inputClass =
    'w-16 rounded-[3px] border-chrome border-ink bg-paper px-2 py-1.5 font-body text-sm text-ink focus:outline-none focus:ring-[3px] focus:ring-rust/[0.22]'

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
              variant={kind === 'sp' ? 'primary' : undefined}
              aria-pressed={kind === 'sp'}
              title="Weapon lists SP damage — applies 1:1"
              onClick={() => setKind('sp')}
            >
              SP damage
            </Btn>
            <Btn
              size="sm"
              variant={kind === 'hp' ? 'primary' : undefined}
              aria-pressed={kind === 'hp'}
              title="Weapon lists HP damage — mechs take half"
              onClick={() => setKind('hp')}
            >
              HP damage (½)
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
          <p
            role="status"
            className={cn('font-body text-sm', OUTCOME_TONE[last.outcome])}
            data-outcome={last.outcome}
          >
            Critical Damage {last.roll}: {OUTCOME_LABEL[last.outcome]}
          </p>
        )}

        {!readOnly && currentSP === 0 && !mech.destroyed && (
          <div
            role="alert"
            className="mt-2 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2"
          >
            <p className="m-0 font-body text-sm text-rust">
              0 SP — roll on the Critical Damage Table.
            </p>
            <Btn
              size="sm"
              variant="danger"
              className="mt-1.5"
              aria-label="Roll Critical Damage"
              onClick={() => {
                void rollCritical()
              }}
            >
              Roll Critical Damage
            </Btn>
          </div>
        )}

        {!readOnly && choicePrompt && (
          <p
            role="alert"
            className="mt-2 rounded-[3px] border-chrome border-status-warn bg-paper px-3 py-2 font-body text-sm text-rust"
          >
            {choicePrompt === 'system'
              ? 'Mark one System as Destroyed using its status badge below (Mediator picks, or roll it at the table).'
              : 'Mark one Module as Destroyed using its status badge below (Mediator picks, or roll it at the table).'}
          </p>
        )}
      </div>
    </div>
  )
}
