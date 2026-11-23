/**
 * Pilot wizard form-state contract + entity mappers.
 *
 * WizardFormState is the layout-agnostic seam between the wizard UI and the
 * persisted Pilot entity:
 *   - `pilotFormToUpdatePatch` projects the wizard-owned fields.
 *   - `pilotFormToCreateInput` builds the create() payload: those fields plus
 *     the fresh pilot's starting live-play state.
 *
 * All functions are pure — no store, no React.
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { ChoiceSelections } from 'salvageunion-reference'
import { pilotMaxAP, pilotMaxHP } from 'salvageunion-reference/rules'
import { pilotPartnerSeeds, syncPartners } from '../rules/partnerGrants'
import { madeChoices } from './itemChoices'

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
  /**
   * The options chosen on a piece of equipment that asks a choice, by its slug
   * (maps to Pilot.equipmentChoices). Unset until one is made, as on the pilot.
   */
  equipmentChoices?: Record<string, ChoiceSelections>
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
  | 'equipmentChoices'
>

/**
 * The Callsign a new pilot is stored with: left blank, it is the Name (r6 F5),
 * which the rules allow. A stored value, not a display fallback: the pilot is
 * still named through `pilotLabel`. The blank create's rule.
 */
export function storedCallsign(callsign: string, name: string): string {
  const typed = callsign.trim()
  return typed === '' ? name.trim() : typed
}

/** One of a pilot's two names. */
export type PilotNameField = 'name' | 'callsign'

/**
 * The owner's ruling (r7 F7): which name the Pilot wizard needs before Review. The Callsign, the name the game uses; the Name is optional,
 * and left blank it is stored as the Callsign (a pilot's record keeps both).
 * `'name'` puts back r6 F5's rule (Name required, a blank Callsign is the Name).
 */
export const REQUIRED_PILOT_NAME: PilotNameField = 'callsign'

/** A new pilot's two names as stored: the optional one, left blank, is the required one. */
export function storedPilotNames(
  form: Pick<PilotWizardFormState, PilotNameField>,
  required: PilotNameField = REQUIRED_PILOT_NAME
): Record<PilotNameField, string> {
  const name = form.name.trim()
  const callsign = form.callsign.trim()
  return required === 'callsign'
    ? { callsign, name: name || callsign }
    : { name, callsign: callsign || name }
}

export function pilotFormToUpdatePatch(form: PilotWizardFormState): PilotWizardPatch {
  // A dropped item's choices go with it: only what is carried keeps its own.
  const equipmentChoices = madeChoices(form.equipmentChoices, form.equipment)
  return {
    ...storedPilotNames(form),
    classRef: form.classId,
    abilities: form.abilities,
    equipment: form.equipment,
    motto: form.motto.trim(),
    keepsake: form.keepsake.trim(),
    appearance: form.appearance.trim(),
    background: form.background.trim(),
    description: form.description.trim(),
    ...(equipmentChoices ? { equipmentChoices } : {}),
  }
}

/**
 * The partners a fresh pilot's equipment grants.
 *
 * Equipment gates, abilities count: Mecha Packmaster turns one Mecha Companion
 * entry into two companions (`partnerGrantCount`).
 */
function pilotFormToPartners(form: PilotWizardFormState) {
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
