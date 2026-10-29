import type { UnitsStore } from '../../replica/units'
/**
 * usePilotSheetActions — every write the pilot Live Sheet can make, in one
 * place.
 *
 * ## Why this is its own file
 *
 * Eleven handlers were interleaved with the derivations and the poster JSX in
 * `PilotSheet`, and each one re-spelled `storeState.update('pilot', pilot.id,
 * …, LIVE_SHEET_MANUAL)` by hand. That repetition is not cosmetic: it is the
 * reason a cross-cutting concern on the write path (the offline refusal in
 * `runWrite`) had to be applied at ~45 call sites across the two sheets. Here
 * there is exactly one.
 *
 * ## The two write helpers, and why there are two
 *
 * - `write(fields, meta?)` — fire-and-forget, rejection handled by `runWrite`.
 *   This is the default and what almost every handler wants.
 * - `writeAwait(fields, meta?)` — returns the promise, so a handler can
 *   sequence something AFTER the write lands (the destroyed-undo toast has to
 *   know the write happened before it offers the undo). Only
 *   `handleEquipmentConditionChange` uses it, and its callers run it through
 *   `runWrite`, so a refusal is said and the undo toast is never offered for a
 *   change that did not persist.
 *
 * Every handler reads the FRESHEST record via `freshEntity` rather than the
 * render-time prop, so rapid sequential edits (and another tab's write landing
 * between renders) do not stomp each other.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { GenericInventoryEntry, Pilot } from 'game-domain/schemas/pilot'
import { useState } from 'react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SoftWarning } from 'salvageunion-reference/rules'
import { enrichPilotSnapshot, pilotMaxAP, resolvePoolStart } from 'salvageunion-reference/rules'
import { useSoftWarnings } from '../../components/shared/useSoftWarnings'
import { pilotActivationPatch } from '../../lib/rules/actionPatches'
import { isPartnerEquipment, pilotPartnerSeeds, syncPartners } from '../../lib/rules/partnerGrants'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import { runWrite } from '../../lib/runWrite'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../../replica/provenance'
import type { ChangeMeta, UnitsState } from '../../replica/units'
import { destroyedUndoToast } from './destroyedUndoToast.model'
import { changedFields, freshEntity } from './freshEntity.model'
import type { UsedTraitKey } from './PilotIdentity'
import type { SheetPatch } from './sheetViewProps.model'

type PilotSheetActionsOptions = {
  pilot: Pilot
  /** Injectable store hook — forwarded to `useSoftWarnings`. */
  store: UnitsStore
  storeState: UnitsState
  /**
   * The pilot's effective crawler Tech Level (`resolveEffectiveCrawlerLevel`),
   * so a Spend AP on an unset pool starts from the same max the sheet shows.
   */
  crawlerTechLevel?: number
}

export type PilotSheetActions = {
  patchPilot: SheetPatch
  overridePilotMax: (fields: Partial<Pilot>) => void
  toggleUsed: (key: UsedTraitKey, next: boolean) => void
  handleConditionsChange: (next: string[]) => void
  toggleAbility: (slug: string) => void
  toggleEquipment: (slug: string) => void
  handleEquipmentConditionChange: (slug: string, next: ItemCondition) => Promise<void>
  handleUsesChange: (slug: string, next: number) => void
  handleSpendAP: (cost: number) => void
  handleAbilityUsedChange: (slug: string, next: boolean) => void
  handleGenericInventoryChange: (next: GenericInventoryEntry[]) => void
  /** Advisory soft-warning state for the confirm dialog. */
  warnings: SoftWarning[]
  warningSubtitle: string | null
  /** Discard the pending build edit (dialog "Fix it"). */
  cancelBuildEdit: () => void
  /** Persist the pending build edit despite its warnings (dialog "Save anyway"). */
  confirmBuildEdit: () => void
}

export function usePilotSheetActions({
  pilot,
  store,
  storeState,
  crawlerTechLevel,
}: PilotSheetActionsOptions): PilotSheetActions {
  // Soft warnings (ADR-021) on BUILD edits only — ability add/remove
  // and the class change. Advisory, never blocking: a clean edit saves straight
  // through and the dialog never appears. Vitals/live-play writes (HP, AP, TP,
  // conditions, uses, Spend AP) deliberately bypass this — they are transient
  // state, not the build these rules evaluate, and would warn on every tick.
  // `enrichPilotSnapshot` is REQUIRED: Pilot.abilities is a slug array, and the
  // tier/tree checks need the resolved ability structs.
  const softWarnings = useSoftWarnings({
    entityType: 'pilot',
    entityId: pilot.id,
    toSnapshot: (p) => enrichPilotSnapshot(p),
    store,
  })
  const [warningSubtitle, setWarningSubtitle] = useState<string | null>(null)

  /** Freshest pilot record from the store, falling back to the render prop. */
  function freshPilot(): Pilot {
    return freshEntity(storeState, 'pilot', pilot)
  }

  /** The one fire-and-forget write on this sheet — see the header note. */
  function write(fields: Partial<Pilot>, meta: ChangeMeta = LIVE_SHEET_MANUAL): void {
    runWrite(() => storeState.update('pilot', pilot.id, fields, meta))
  }

  /** The one awaited write on this sheet — see the header note. */
  function writeAwait(
    fields: Partial<Pilot>,
    meta: ChangeMeta = LIVE_SHEET_MANUAL
  ): Promise<unknown> {
    return storeState.update('pilot', pilot.id, fields, meta)
  }

  /**
   * Preview a build patch: save immediately when clean, otherwise raise the
   * confirm-and-proceed dialog. `label` describes the pending edit.
   */
  function saveBuildEdit(fields: Partial<Pilot>, label: string) {
    if (softWarnings.preview(fields).length === 0) {
      runWrite(() => softWarnings.saveAnyway())
      return
    }
    setWarningSubtitle(label)
  }

  /**
   * Partial merge on this pilot, reading the freshest record when needed.
   *
   * A `classRef` change is a BUILD edit (it can trip CLASS_PREREQUISITE —
   * switching to an Advanced/Hybrid specialisation without the 6-core gate),
   * so it routes through the soft-warning flow. Every other field here
   * (vitals, TP, identity text) writes straight through.
   */
  const patchPilot: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(freshPilot()) : input
    if ('classRef' in fields) {
      saveBuildEdit(fields, 'Change class')
      return
    }
    write(fields)
  }

  // Cap overrides (ADR-022, Free Edit): pin HP/AP maxima as an absolute
  // `max*Override`; the gauge shows "overridden from N" + a revert. Tagged
  // `override` for the Change Log. Callers normalise the pin with `pinFor`
  // (a pin equal to the derivation is written as none); a commit that changes
  // nothing — the number already shown, re-entered — is not written at all.
  const overridePilotMax = (fields: Partial<Pilot>) => {
    const changed = changedFields(freshPilot(), fields)
    if (changed) write(changed, LIVE_SHEET_OVERRIDE)
  }

  /** Toggle one of the once-per-Downtime used flags. */
  function toggleUsed(key: UsedTraitKey, next: boolean) {
    const prev = freshPilot().usedToggles ?? {}
    write({ usedToggles: { ...prev, [key]: next } })
  }

  /** Persist the full conditions list (flat string set, no partial merge). */
  function handleConditionsChange(next: string[]) {
    write({ conditions: next })
  }

  // Collection add/remove (unified edit language archetype B) — always
  // available, writes through on toggle (The app auto-saves; no Save button).
  // Reads the FRESHEST record so rapid toggles in the picker grid don't race
  // the async store write.
  // Advisory only (soft warnings), never rule-GATED: the cap, tree order and
  // the Advanced/Legendary prerequisites surface in a confirm dialog and the
  // user may always proceed.
  function toggleAbility(slug: string) {
    const current = freshPilot()
    const removing = current.abilities.includes(slug)
    const name = SalvageUnionReference.Abilities.getBySlug(slug)?.name ?? slug
    const abilities = removing
      ? current.abilities.filter((a) => a !== slug)
      : [...current.abilities, slug]
    saveBuildEdit(
      {
        abilities,
        // Abilities are the second grant-lifecycle edge, because they carry the
        // COUNT: Mecha Packmaster's `grants` lists Mecha Companion twice, so
        // taking it fields a second companion and dropping it retires one. The
        // equipment slug does not move either way — it is a set, and it was
        // already there.
        partners: syncPartners(current.partners, pilotPartnerSeeds(current.equipment, abilities)),
      },
      `${removing ? 'Remove' : 'Add'} ${name}`
    )
  }

  /**
   * Equip / unequip, granting or revoking a partner in the SAME write.
   *
   * Auto-Turret, Survey Drone and Mecha Companion are not inventory: each is a
   * statted partner that renders in place of its equipment card (ADR-028). The
   * equipment slug IS the grant, so unequipping it takes the partner with it and
   * re-equipping grants a fresh one — that is the only lifecycle a partner has,
   * which is why no card offers a bare "remove" of its own.
   */
  function toggleEquipment(slug: string) {
    const current = freshPilot()
    const equipment = current.equipment.includes(slug)
      ? current.equipment.filter((e) => e !== slug)
      : [...current.equipment, slug]
    write({
      equipment,
      ...(isPartnerEquipment(slug)
        ? {
            partners: syncPartners(
              current.partners,
              pilotPartnerSeeds(equipment, current.abilities)
            ),
          }
        : {}),
    })
  }

  async function handleEquipmentConditionChange(slug: string, next: ItemCondition) {
    const prev = freshPilot().equipmentConditions ?? {}
    const prevCondition = prev[slug] ?? 'intact'
    await writeAwait({ equipmentConditions: { ...prev, [slug]: next } })
    // Landing on 'destroyed' offers a one-tap Undo (mis-tap mid-combat).
    if (next === 'destroyed' && prevCondition !== 'destroyed') {
      const name = resolveEquipment(slug)?.name ?? slug
      destroyedUndoToast(name, () => {
        runWrite(() => handleEquipmentConditionChange(slug, prevCondition))
      })
    }
  }

  function handleUsesChange(slug: string, next: number) {
    const prev = freshPilot().equipmentUses ?? {}
    write({ equipmentUses: { ...prev, [slug]: next } })
  }

  function handleSpendAP(cost: number) {
    const p = freshPilot()
    // Spent from the stored value, not the clamped display (`resolvePoolStart`).
    const current = resolvePoolStart(p.currentAP, pilotMaxAP({ ...p, crawlerTechLevel }))
    const patch = pilotActivationPatch({ apCost: cost, currentAP: current })
    if (patch.currentAP === undefined || patch.currentAP === current) return
    write(patch)
  }

  function handleAbilityUsedChange(slug: string, next: boolean) {
    const prev = new Set(freshPilot().usedAbilities ?? [])
    if (next) {
      prev.add(slug)
    } else {
      prev.delete(slug)
    }
    write({ usedAbilities: Array.from(prev) })
  }

  function handleGenericInventoryChange(next: GenericInventoryEntry[]) {
    write({ genericInventory: next })
  }

  return {
    patchPilot,
    overridePilotMax,
    toggleUsed,
    handleConditionsChange,
    toggleAbility,
    toggleEquipment,
    handleEquipmentConditionChange,
    handleUsesChange,
    handleSpendAP,
    handleAbilityUsedChange,
    handleGenericInventoryChange,
    warnings: softWarnings.warnings,
    warningSubtitle,
    cancelBuildEdit: () => {
      softWarnings.fixIt()
      setWarningSubtitle(null)
    },
    confirmBuildEdit: () => {
      runWrite(() => softWarnings.saveAnyway())
      setWarningSubtitle(null)
    },
  }
}
