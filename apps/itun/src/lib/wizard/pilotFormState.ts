/**
 * Pilot wizard form-state contract + entity mappers (plan 3.1).
 *
 * WizardFormState is the layout-agnostic seam between the wizard UI and the
 * persisted Pilot entity:
 *   - `pilotToFormState` maps a stored pilot onto initial wizard state
 *     (edit mode prefill — greenfield per plan 3.1).
 *   - `pilotFormToCreateInput` builds the create() payload.
 *   - `pilotFormToUpdatePatch` builds the update() patch for the upsert
 *     branch. It contains ONLY wizard-owned fields — live-play state
 *     (currentHP/AP, conditions, equipment conditions/uses/choices,
 *     injuries, trainingPoints, …) is never clobbered by an edit pass.
 *
 * All functions are pure — no store, no React.
 */

import { PILOT_BASE_AP, PILOT_BASE_HP } from '../rules/derivedStats'
import { pilotPartnerSeeds, syncPartners } from '../rules/partnerGrants'
import type { PartnerInstance } from '../schemas/partner'
import type { Pilot } from '../schemas/pilot'

/** Shape of form state carried through the pilot wizard. */
export type PilotWizardFormState = {
  name: string
  classId: string
  abilities: string[]
  equipment: string[]
  callsign: string
  motto: string
  keepsake: string
  appearance: string
  background: string
  description: string
}

export const EMPTY_PILOT_FORM_STATE: PilotWizardFormState = {
  name: '',
  classId: '',
  abilities: [],
  equipment: [],
  callsign: '',
  motto: '',
  keepsake: '',
  appearance: '',
  background: '',
  description: '',
}

/** Maps a stored pilot onto wizard initial state (edit-mode prefill). */
export function pilotToFormState(pilot: Pilot): PilotWizardFormState {
  return {
    name: pilot.name,
    classId: pilot.classRef,
    abilities: [...pilot.abilities],
    equipment: [...pilot.equipment],
    callsign: pilot.callsign,
    motto: pilot.motto,
    keepsake: pilot.keepsake,
    appearance: pilot.appearance,
    background: pilot.background,
    description: pilot.description ?? '',
  }
}

/** Wizard-owned pilot fields — the only fields an edit save may touch. */
type PilotWizardPatch = Pick<
  Pilot,
  | 'name'
  | 'callsign'
  | 'classRef'
  | 'abilities'
  | 'equipment'
  | 'motto'
  | 'keepsake'
  | 'appearance'
  | 'background'
  | 'description'
>

export function pilotFormToUpdatePatch(form: PilotWizardFormState): PilotWizardPatch {
  return {
    name: form.name.trim(),
    callsign: form.callsign.trim(),
    classRef: form.classId,
    abilities: form.abilities,
    equipment: form.equipment,
    motto: form.motto.trim(),
    keepsake: form.keepsake.trim(),
    appearance: form.appearance.trim(),
    background: form.background.trim(),
    description: form.description.trim(),
  }
}

/**
 * Reconcile a pilot's partners against the equipment they now carry.
 *
 * Kept OUT of `pilotFormToUpdatePatch` for the same reason as the mech's: a
 * partner holds live-play state an edit must not clobber, and reconciliation
 * needs the stored partners as input. The wizard runs it via `afterUpdate`.
 *
 * Additive, not exact — `pilot.equipment` says which stat blocks are granted,
 * never how many are fielded (Mecha Packmaster). See `syncPartners`.
 */
export function pilotFormToPartners(
  form: PilotWizardFormState,
  existing?: readonly PartnerInstance[]
) {
  return syncPartners(existing, pilotPartnerSeeds(form.equipment))
}

/**
 * Create payload for a fresh pilot. Fresh pilots start at full HP/AP
 * (core-rules base — no injuries or training modifiers exist at creation).
 *
 * Equipment carrying a mech-shaped stat block (Auto-Turret, Survey Drone, Mecha
 * Companion) is granted as a live partner here rather than as an inert
 * inventory card.
 */
export function pilotFormToCreateInput(form: PilotWizardFormState) {
  const partners = pilotFormToPartners(form)
  return {
    schemaVersion: 1 as const,
    ...pilotFormToUpdatePatch(form),
    conditions: [],
    currentHP: PILOT_BASE_HP,
    currentAP: PILOT_BASE_AP,
    ...(partners !== undefined ? { partners } : {}),
  }
}
