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

import { resolveChassisRef } from 'salvageunion-reference/rules'
import { mechPartnerSeeds, syncPartners } from '../rules/partnerGrants'
import type { CargoLot } from '../schemas/cargoLot'
import type { Mech } from '../schemas/mech'
import type { PartnerInstance } from '../schemas/partner'

/** Shape of form state carried through the mech wizard. */
export type MechWizardFormState = {
  name: string
  /** Chassis SLUG ref (matching Mech.chassisRef); '' while unchosen. */
  chassisName: string
  /**
   * Loadout pattern name (maps to Mech.patternName): the chosen chassis
   * pattern's name, or the user-supplied name for a custom build. '' while
   * unchosen.
   */
  patternName: string
  /** Installed system slug refs. */
  systems: string[]
  /** Installed module slug refs. */
  modules: string[]
  cargoLots: CargoLot[]
  /** Short freeform quirk note (maps to Mech.quirk). */
  quirk: string
  /** Freeform appearance note (maps to Mech.appearance). */
  appearance: string
}

export const EMPTY_MECH_FORM_STATE: MechWizardFormState = {
  name: '',
  chassisName: '',
  patternName: '',
  systems: [],
  modules: [],
  cargoLots: [],
  quirk: '',
  appearance: '',
}

/** Maps a stored mech onto wizard initial state (edit-mode prefill). */
export function mechToFormState(mech: Mech): MechWizardFormState {
  return {
    name: mech.name,
    chassisName: mech.chassisRef,
    patternName: mech.patternName ?? '',
    systems: [...mech.systems],
    modules: [...mech.modules],
    cargoLots: mech.cargoLots.map((lot) => ({ ...lot })),
    quirk: mech.quirk ?? '',
    // Read-fallback: pre-split mechs carry their notes in the deprecated
    // `description`; surface them under Appearance (heals on next save).
    appearance: mech.appearance ?? mech.description ?? '',
  }
}

/** Wizard-owned mech fields — the only fields an edit save may touch. */
type MechWizardPatch = Pick<
  Mech,
  | 'name'
  | 'chassisRef'
  | 'patternName'
  | 'systems'
  | 'modules'
  | 'cargoLots'
  | 'quirk'
  | 'appearance'
  | 'description'
>

export function mechFormToUpdatePatch(form: MechWizardFormState): MechWizardPatch {
  return {
    name: form.name.trim(),
    chassisRef: form.chassisName,
    patternName: form.patternName.trim() || undefined,
    systems: form.systems,
    modules: form.modules,
    cargoLots: form.cargoLots,
    quirk: form.quirk.trim() || undefined,
    appearance: form.appearance.trim() || undefined,
    // Clear the deprecated field on save (its content moved to `appearance`).
    description: undefined,
  }
}

/**
 * Reconcile a mech's drones against the chassis + pattern it now carries.
 *
 * Kept OUT of `mechFormToUpdatePatch` on purpose: that patch is the set of
 * fields an edit may overwrite blind, and a partner carries live-play state
 * (structure, energy, heat, per-item conditions, cargo) that an edit must
 * preserve. Reconciliation needs the stored partners as input, so the wizard
 * runs it on the update path via `afterUpdate` instead.
 *
 * `exact` because a mech's drone roster is fully determined by its chassis and
 * pattern — see `syncPartners`.
 */
export function mechFormToPartners(
  form: MechWizardFormState,
  existing?: readonly PartnerInstance[]
) {
  return syncPartners(existing, mechPartnerSeeds(form.chassisName, form.patternName), {
    exact: true,
  })
}

/**
 * Create payload for a fresh mech. Fresh mechs start at full SP/EP from the
 * chassis and Heat 0 (plan 2.3, gap 7) — never Heat-at-capacity.
 *
 * Drones granted by the chassis ability (and kitted by the pattern) are seeded
 * here: they are part of the machine being built, not something the player adds
 * afterwards — there is no "add a drone" control, by design.
 */
export function mechFormToCreateInput(form: MechWizardFormState) {
  const chassis = resolveChassisRef(form.chassisName)
  const partners = mechFormToPartners(form)
  return {
    schemaVersion: 1 as const,
    ...mechFormToUpdatePatch(form),
    conditions: [],
    currentSP: chassis?.structurePoints,
    currentEP: chassis?.energyPoints,
    currentHeat: 0,
    ...(partners !== undefined ? { partners } : {}),
  }
}
