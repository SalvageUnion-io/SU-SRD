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

import type { Pilot } from '../schemas/pilot'
import { PILOT_BASE_AP, PILOT_BASE_HP } from '../rules/derivedStats'

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
  }
}

/** Wizard-owned pilot fields — the only fields an edit save may touch. */
export type PilotWizardPatch = Pick<
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
  }
}

/**
 * Create payload for a fresh pilot. Fresh pilots start at full HP/AP
 * (core-rules base — no injuries or training modifiers exist at creation).
 */
export function pilotFormToCreateInput(form: PilotWizardFormState) {
  return {
    schemaVersion: 1 as const,
    ...pilotFormToUpdatePatch(form),
    conditions: [],
    currentHP: PILOT_BASE_HP,
    currentAP: PILOT_BASE_AP,
  }
}
