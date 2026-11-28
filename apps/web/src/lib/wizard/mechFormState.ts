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

import type { CargoLot } from 'game-domain/schemas/cargoLot'
import { makeScrapLot } from 'game-domain/schemas/cargoLot'
import type { Mech } from 'game-domain/schemas/mech'
import { startingPatternRef } from 'game-domain/startingPattern'
import type { ChoiceSelections, RefChassis } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { mechMaxCargo } from 'salvageunion-reference/rules'
import { carrierCargoUsage } from '../cargo/cargoTransfer'
import { mechPartnerSeeds, syncPartners } from '../rules/partnerGrants'
import { madeChoices } from './itemChoices'

/** Shape of form state carried through the mech wizard. */
export type MechWizardFormState = {
  name: string
  /** Chassis SLUG ref (matching Mech.chassisRef); '' while unchosen. */
  chassisName: string
  /**
   * The chassis pattern the loadout started from (stored as its slug,
   * Mech.startingPatternRef, provenance never shown): the chosen pattern's
   * name; '' for a custom build or while unchosen.
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
  /**
   * The options chosen on a System or Module that asks a choice, by its slug
   * (maps to Mech.itemChoices). Unset until one is made, as on the mech.
   */
  itemChoices?: Record<string, ChoiceSelections>
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
export type MechPattern = RefChassis['patterns'][number]

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

/**
 * Where unspent starting Scrap goes (r3 F1): into the hold up to its free
 * Cargo Slots, each Scrap taking one (Core Book p.246), and the rest to the
 * Union Crawler, which stores spare Scrap (Workshop Manual p.94). The hold's
 * capacity is the build's own: its chassis and whatever it installed.
 */
export function leftoverScrapSplit(
  form: MechWizardFormState,
  leftover: number
): { stowed: number; banked: number } {
  const left = Math.max(0, leftover)
  if (form.chassisName === '') return { stowed: 0, banked: left }
  const cap = mechMaxCargo({
    chassisRef: form.chassisName,
    systems: form.systems,
    modules: form.modules,
  })
  const stowed = Math.min(left, carrierCargoUsage(form.cargoLots, cap).free)
  return { stowed, banked: left - stowed }
}

/**
 * The form with its unspent starting Scrap carried in the hold: one Tech 1
 * Scrap line of what fits (`leftoverScrapSplit`), never more than the hold's
 * free Cargo Slots. Unchanged where none is left or none fits.
 */
export function withLeftoverScrap(
  form: MechWizardFormState,
  leftover: number
): MechWizardFormState {
  const { stowed } = leftoverScrapSplit(form, leftover)
  if (stowed <= 0) return form
  return { ...form, cargoLots: [...form.cargoLots, makeScrapLot(1, stowed)] }
}

/** Wizard-owned mech fields — the ones the form captures. */
type MechWizardPatch = Pick<
  Mech,
  | 'name'
  | 'chassisRef'
  | 'startingPatternRef'
  | 'systems'
  | 'modules'
  | 'cargoLots'
  | 'quirk'
  | 'appearance'
  | 'itemChoices'
>

export function mechFormToUpdatePatch(form: MechWizardFormState): MechWizardPatch {
  // A removed item's choices go with it: only what is installed keeps its own.
  const itemChoices = madeChoices(form.itemChoices, [...form.systems, ...form.modules])
  return {
    name: form.name.trim(),
    chassisRef: form.chassisName,
    startingPatternRef: startingPatternRef(form.chassisName, form.patternName),
    systems: form.systems,
    modules: form.modules,
    cargoLots: form.cargoLots,
    quirk: form.quirk.trim() || undefined,
    appearance: form.appearance.trim() || undefined,
    ...(itemChoices ? { itemChoices } : {}),
  }
}

/** The drones a fresh mech's chassis grants, kitted by its pattern. */
function mechFormToPartners(form: MechWizardFormState) {
  return syncPartners(undefined, mechPartnerSeeds(form.chassisName, form.patternName))
}

/**
 * Create payload for a fresh mech. Its SP, EP and Heat stay unset: an unset
 * pool reads full and an unset gauge reads 0 (`resolvePool`, `resolveGauge`),
 * so the fresh mech starts at its derived maxima, loadout included.
 *
 * Drones granted by the chassis ability (and kitted by the pattern) are seeded
 * here: they are part of the machine being built, not something the player adds
 * afterwards — there is no "add a drone" control, by design.
 */
export function mechFormToCreateInput(form: MechWizardFormState) {
  const partners = mechFormToPartners(form)
  return {
    schemaVersion: 1 as const,
    ...mechFormToUpdatePatch(form),
    conditions: [],
    ...(partners !== undefined ? { partners } : {}),
  }
}
