/**
 * Pilot creation step gates (wizard-refresh Phase 3, plan §5.1 app half).
 *
 * THIN ADAPTER only: destructures wizard form state into neutral inputs
 * (resolved reference records + counts) and calls the package predicates in
 * `salvageunion-reference/rules` — rule logic is never duplicated here, so
 * a SelCard's filter, the trackers' numbers, and the Next gate can never
 * drift apart.
 *
 * Pure TypeScript — no React. Requires `classes`/`abilities`/`equipment`
 * preloaded (the wizard route loader already does).
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefAbility, SURefClass, SURefEquipment } from 'salvageunion-reference'
import {
  isLegalCreationAbility,
  isLegalCreationClass,
  isLegalCreationEquipment,
  isPilotAbilityPickComplete,
  isPilotEquipmentPickComplete,
  PILOT_CREATION_ABILITY_PICKS,
  PILOT_CREATION_EQUIPMENT_PICKS,
  pilotEquipmentPicksRemaining,
} from 'salvageunion-reference/rules'
import type { PilotWizardFormState } from '../wizard/pilotFormState'

/** Book-order pilot wizard step ids (Pilot Bay pp.18–19 + Review). */
export type PilotWizardStepId =
  | 'stats'
  | 'classAbility'
  | 'equipment'
  | 'callsign'
  | 'background'
  | 'motto'
  | 'keepsake'
  | 'appearance'
  | 'review'

/** Gate verdict: `reason` is the human footerNote text when blocked. */
export type StepGateResult = { ok: boolean; reason?: string }

const OK: StepGateResult = { ok: true }

function findClass(classId: string): SURefClass | undefined {
  if (!classId) return undefined
  return SalvageUnionReference.Classes.find((c) => c.id === classId)
}

/**
 * The neutral input the package predicates read: a class's core ability trees,
 * or `undefined`. Narrowing the `SURefClass` union to `coreTrees` HERE (the
 * specialisation branch has no such property) keeps the package predicates
 * free of the union entirely.
 */
function coreTreesOf(cls: SURefClass | undefined): readonly string[] | undefined {
  return cls && 'coreTrees' in cls ? cls.coreTrees : undefined
}

function findAbility(abilityId: string): SURefAbility | undefined {
  return SalvageUnionReference.Abilities.find((a) => a.id === abilityId)
}

function findEquipment(equipmentId: string): SURefEquipment | undefined {
  return SalvageUnionReference.Equipment.find((e) => e.id === equipmentId)
}

function classAbilityGate(form: PilotWizardFormState): StepGateResult {
  const coreTrees = coreTreesOf(findClass(form.classId))
  if (!isLegalCreationClass(coreTrees)) {
    return { ok: false, reason: 'Choose your class to continue' }
  }
  if (!isPilotAbilityPickComplete(form.abilities.length)) {
    return { ok: false, reason: 'Choose your first Ability to continue' }
  }
  const abilityId = form.abilities[0]
  const ability = abilityId === undefined ? undefined : findAbility(abilityId)
  if (!ability || !isLegalCreationAbility(ability, coreTrees)) {
    return { ok: false, reason: 'Choose your first Ability to continue' }
  }
  return OK
}

function equipmentGate(form: PilotWizardFormState): StepGateResult {
  const count = form.equipment.length
  if (isPilotEquipmentPickComplete(count)) {
    const allLegal = form.equipment.every((id) => {
      const item = findEquipment(id)
      return item !== undefined && isLegalCreationEquipment(item)
    })
    if (allLegal) return OK
    return { ok: false, reason: 'Only Tech 1 equipment is legal at creation' }
  }
  if (count > PILOT_CREATION_EQUIPMENT_PICKS) {
    const excess = count - PILOT_CREATION_EQUIPMENT_PICKS
    return {
      ok: false,
      reason: `Remove ${excess} equipment item${excess === 1 ? '' : 's'} to continue`,
    }
  }
  const remaining = pilotEquipmentPicksRemaining(count)
  return {
    ok: false,
    reason: `Choose ${remaining} more equipment item${remaining === 1 ? '' : 's'} to continue`,
  }
}

function callsignGate(form: PilotWizardFormState): StepGateResult {
  if (form.name.trim() === '' || form.callsign.trim() === '') {
    return { ok: false, reason: 'Enter a Name and Callsign to continue' }
  }
  return OK
}

/**
 * Next-gating for the pilot CREATE flow (guided mode is HARD — plan §5.3).
 * The wizard's `canAdvance()` is a call into this; the `reason` renders in
 * the WizShell footerNote beside the locked CTA.
 */
export function pilotCreationStepGate(
  step: PilotWizardStepId,
  form: PilotWizardFormState
): StepGateResult {
  switch (step) {
    case 'stats':
    case 'background':
    case 'motto':
    case 'keepsake':
    case 'appearance':
      return OK // display-only / optional flavor — Next always enabled
    case 'classAbility':
      return classAbilityGate(form)
    case 'equipment':
      return equipmentGate(form)
    case 'callsign':
      return callsignGate(form)
    case 'review': {
      // Everything re-checked; the first unmet gate names itself.
      for (const gate of [classAbilityGate, equipmentGate, callsignGate]) {
        const result = gate(form)
        if (!result.ok) return result
      }
      return OK
    }
  }
}

/** Result of a deterministic draft clamp: the healed form + what was dropped. */
export type PilotDraftClampResult = {
  form: PilotWizardFormState
  /** Human-readable names of everything removed (for the restore toast). */
  removed: string[]
}

function abilityName(id: string): string {
  return findAbility(id)?.name ?? id
}

function equipmentName(id: string): string {
  return findEquipment(id)?.name ?? id
}

/**
 * Deterministic clamp for a restored create-mode draft (plan §5.3): a draft
 * written before the hard-enforcement regime (or hand-edited) may violate the
 * creation rules. Violations resolve deterministically —
 *   - an illegal class (specialisation / unresolvable) is cleared along with
 *     every ability pick,
 *   - abilities illegal for the class are dropped, then excess picks are
 *     removed OLDEST-FIRST down to the 1-ability budget,
 *   - non-Tech-1 equipment is dropped, then excess removed OLDEST-FIRST down
 *     to the 2-item budget.
 * The caller shows one toast itemizing `removed`.
 */
export function clampPilotCreationDraft(form: PilotWizardFormState): PilotDraftClampResult {
  const removed: string[] = []
  let classId = form.classId
  let abilities = [...form.abilities]
  let equipment = [...form.equipment]

  if (classId !== '') {
    const cls = findClass(classId)
    const coreTrees = coreTreesOf(cls)
    if (!isLegalCreationClass(coreTrees)) {
      removed.push(cls?.name ?? 'class pick')
      removed.push(...abilities.map(abilityName))
      classId = ''
      abilities = []
    } else {
      const legal = abilities.filter((id) => {
        const ability = findAbility(id)
        return ability !== undefined && isLegalCreationAbility(ability, coreTrees)
      })
      removed.push(...abilities.filter((id) => !legal.includes(id)).map(abilityName))
      abilities = legal
    }
  } else if (abilities.length > 0) {
    removed.push(...abilities.map(abilityName))
    abilities = []
  }

  if (abilities.length > PILOT_CREATION_ABILITY_PICKS) {
    const excess = abilities.slice(0, abilities.length - PILOT_CREATION_ABILITY_PICKS)
    removed.push(...excess.map(abilityName))
    abilities = abilities.slice(abilities.length - PILOT_CREATION_ABILITY_PICKS)
  }

  const legalEquipment = equipment.filter((id) => {
    const item = findEquipment(id)
    return item !== undefined && isLegalCreationEquipment(item)
  })
  for (const id of equipment) {
    if (!legalEquipment.includes(id)) removed.push(equipmentName(id))
  }
  equipment = legalEquipment
  if (equipment.length > PILOT_CREATION_EQUIPMENT_PICKS) {
    const excess = equipment.slice(0, equipment.length - PILOT_CREATION_EQUIPMENT_PICKS)
    removed.push(...excess.map(equipmentName))
    equipment = equipment.slice(equipment.length - PILOT_CREATION_EQUIPMENT_PICKS)
  }

  if (removed.length === 0) return { form, removed }
  return { form: { ...form, classId, abilities, equipment }, removed }
}
