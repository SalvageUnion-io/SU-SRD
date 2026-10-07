/**
 * Pilot wizard form-state contract + entity mappers (plan 3.1).
 *
 * WizardFormState is the layout-agnostic seam between the wizard UI and the
 * persisted Pilot entity:
 *   - `pilotFormToUpdatePatch` projects the wizard-owned fields.
 *   - `pilotFormToCreateInput` builds the create() payload: those fields plus
 *     the fresh pilot's starting live-play state.
 *
 * All functions are pure — no store, no React.
 */

import { pilotMaxAP, pilotMaxHP } from 'salvageunion-reference/rules'
import { pilotPartnerSeeds, syncPartners } from '../rules/partnerGrants'
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

/** Wizard-owned pilot fields — the ones the form captures. */
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
 * The partners a fresh pilot's equipment grants.
 *
 * Equipment gates, abilities count: Mecha Packmaster turns one Mecha Companion
 * entry into two companions (`partnerGrantCount`).
 */
export function pilotFormToPartners(form: PilotWizardFormState) {
  return syncPartners(undefined, pilotPartnerSeeds(form.equipment, form.abilities))
}

/**
 * Create payload for a fresh pilot. Fresh pilots start at their FULL derived
 * max HP/AP, so an ability that raises the max (Bionic Arms, Beefcake) is
 * filled at creation rather than reading as damage.
 *
 * The values are stored, not left unset, on purpose (product decision): a
 * later rise in max — linking to a higher-tier crawler — does not heal the
 * pilot. Only creation starts at max. A new pilot has no crawler link yet, so
 * this is the Tech 1 max.
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
    currentHP: pilotMaxHP({ abilities: form.abilities }),
    currentAP: pilotMaxAP({ abilities: form.abilities }),
    ...(partners !== undefined ? { partners } : {}),
  }
}
