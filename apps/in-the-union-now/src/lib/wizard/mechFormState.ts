/**
 * Mech wizard form-state contract + entity mappers (plan 3.1).
 *
 * MechWizardFormState is the layout-agnostic seam between the wizard UI and
 * the persisted Mech entity:
 *   - `mechToFormState` maps a stored mech onto initial wizard state
 *     (edit-mode prefill — greenfield per plan 3.1).
 *   - `mechFormToCreateInput` builds the create() payload.
 *   - `mechFormToUpdatePatch` builds the update() patch for the upsert
 *     branch. It contains ONLY wizard-owned fields — live-play state
 *     (currentSP/EP/Heat, conditions, item conditions/uses, maxima
 *     modifiers, heat-check state, …) is never clobbered by an edit pass.
 *
 * All functions are pure — no store, no React. `mechFormToCreateInput` reads
 * the reference ORM (chassis stats) and so requires `chassis` preloaded.
 */

import type { CargoLot } from '../schemas/cargoLot'
import type { Mech } from '../schemas/mech'
import { findChassisByRef } from '../rules/derivedStats'

/** Shape of form state carried through the mech wizard. */
export type MechWizardFormState = {
  name: string
  /** Chassis NAME ref (matching Mech.chassisRef); '' while unchosen. */
  chassisName: string
  /** Installed system name refs. */
  systems: string[]
  /** Installed module name refs. */
  modules: string[]
  cargoLots: CargoLot[]
}

export const EMPTY_MECH_FORM_STATE: MechWizardFormState = {
  name: '',
  chassisName: '',
  systems: [],
  modules: [],
  cargoLots: [],
}

/** Maps a stored mech onto wizard initial state (edit-mode prefill). */
export function mechToFormState(mech: Mech): MechWizardFormState {
  return {
    name: mech.name,
    chassisName: mech.chassisRef,
    systems: [...mech.systems],
    modules: [...mech.modules],
    cargoLots: mech.cargoLots.map((lot) => ({ ...lot })),
  }
}

/** Wizard-owned mech fields — the only fields an edit save may touch. */
type MechWizardPatch = Pick<Mech, 'name' | 'chassisRef' | 'systems' | 'modules' | 'cargoLots'>

export function mechFormToUpdatePatch(form: MechWizardFormState): MechWizardPatch {
  return {
    name: form.name.trim(),
    chassisRef: form.chassisName,
    systems: form.systems,
    modules: form.modules,
    cargoLots: form.cargoLots,
  }
}

/**
 * Create payload for a fresh mech. Fresh mechs start at full SP/EP from the
 * chassis and Heat 0 (plan 2.3, gap 7) — never Heat-at-capacity.
 */
export function mechFormToCreateInput(form: MechWizardFormState) {
  const chassis = findChassisByRef(form.chassisName)
  return {
    schemaVersion: 1 as const,
    ...mechFormToUpdatePatch(form),
    conditions: [],
    currentSP: chassis?.structurePoints,
    currentEP: chassis?.energyPoints,
    currentHeat: 0,
  }
}
