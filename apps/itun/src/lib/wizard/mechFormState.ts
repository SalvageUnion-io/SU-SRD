/**
 * Mech wizard form-state contract + entity mappers.
 *
 * MechWizardFormState is the layout-agnostic seam between the wizard UI and
 * the persisted Mech entity:
 *   - `mechFormToUpdatePatch` projects the wizard-owned fields.
 *   - `mechFormToCreateInput` builds the create() payload: those fields plus
 *     the fresh mech's starting live-play state.
 *
 * All functions are pure — no store, no React. `mechFormToCreateInput` reads
 * the reference ORM (chassis stats) and so requires `chassis` preloaded.
 */

import type { CargoLot } from 'itun-domain/schemas/cargoLot'
import type { Mech } from 'itun-domain/schemas/mech'
import type { SURefChassis } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { mechPartnerSeeds, syncPartners } from '../rules/partnerGrants'

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

/** One of a chassis's printed patterns: a name and its loadout. */
export type MechPattern = SURefChassis['patterns'][number]

/**
 * The canonical starting-pattern prefill: the pattern's name (and the mech's,
 * while it has none) and its loadout as slug refs, one per copy (`count`).
 */
export function withPatternPrefill(
  form: MechWizardFormState,
  pattern: MechPattern
): MechWizardFormState {
  return {
    ...form,
    patternName: pattern.name,
    name: form.name.trim() === '' ? pattern.name : form.name,
    systems: pattern.systems.flatMap((s) =>
      new Array<string>(s.count ?? 1).fill(nameToSlug(s.name))
    ),
    modules: pattern.modules.flatMap((m) =>
      new Array<string>(m.count ?? 1).fill(nameToSlug(m.name))
    ),
  }
}

/** Wizard-owned mech fields — the ones the form captures. */
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
  }
}

/** The drones a fresh mech's chassis grants, kitted by its pattern. */
function mechFormToPartners(form: MechWizardFormState) {
  return syncPartners(undefined, mechPartnerSeeds(form.chassisName, form.patternName))
}

/**
 * Create payload for a fresh mech. Fresh mechs start at full SP/EP from the
 * chassis and Heat 0 — never Heat-at-capacity.
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
