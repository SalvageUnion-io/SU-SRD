/**
 * usePilotSheetActions — every write the pilot Live Sheet can make, in one
 * place.
 *
 * ## Why this is its own file
 *
 * Eleven handlers were interleaved with the derivations and the poster JSX in
 * `PilotSheet`, and each one re-spelled `storeState.update('pilot', pilot.id,
 * …, LIVE_SHEET_MANUAL)` by hand. That repetition is not cosmetic: it is the
 * reason a cross-cutting concern on the write path (the offline refusal added
 * in `sheetWrite.ts`) had to be applied at ~45 call sites across the two
 * sheets. Here there is exactly one.
 *
 * ## The two write helpers, and why there are two
 *
 * - `write(fields, meta?)` — fire-and-forget, rejection handled by `runWrite`.
 *   This is the default and what almost every handler wants.
 * - `writeAwait(fields, meta?)` — returns the promise, so a handler can
 *   sequence something AFTER the write lands (the destroyed-undo toast has to
 *   know the write happened before it offers the undo). Callers `void` it, so
 *   a rejection here is still uncaught — that is pre-existing behaviour, kept
 *   deliberately: swallowing it inside the helper would let the undo toast
 *   claim a change that never persisted.
 *
 * Every handler reads the FRESHEST record via `freshEntity` rather than the
 * render-time prop, so rapid sequential edits (and another tab's write landing
 * between renders) do not stomp each other.
 */

import { useState } from 'react'
import { enrichPilotSnapshot } from 'salvageunion-reference/rules'

import type { ItemCondition } from '../../lib/schemas/mech'
import type { GenericInventoryEntry, Pilot } from '../../lib/schemas/pilot'
import { pilotMaxAP } from '../../lib/rules/derivedStats'
import type { useEntityStore } from '../../stores/entityStore'
import type { ChangeMeta } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../../stores/surfaceProvenance'
import { useSoftWarnings } from '../shared/useSoftWarnings'
import type { SoftWarning } from '../../lib/rules/types'
import { freshEntity } from './controlPrimitives'
import { destroyedUndoToast } from './destroyedUndoToast'
import { resolveAbility } from './pilotAbilities'
import type { UsedToggleKey } from './PilotIdentity'
import { resolveEquipment } from './pilotInventory'
import type { SheetPatch, SheetStoreState } from './sheetViewProps'
import { runWrite } from './sheetWrite'

/** A pin equal to the derived value is not an override — clear it instead. */
export function pinOrUndef(next: number, derived: number): number | undefined {
  return next === derived ? undefined : next
}

type PilotSheetActionsOptions = {
  pilot: Pilot
  /** Injectable store hook — forwarded to `useSoftWarnings`. */
  store: typeof useEntityStore
  storeState: SheetStoreState
}

export type PilotSheetActions = {
  patchPilot: SheetPatch
  overridePilotMax: (fields: Partial<Pilot>) => void
  toggleUsed: (key: UsedToggleKey, next: boolean) => void
  handleConditionsChange: (next: string[]) => void
  toggleAbility: (abilityId: string) => void
  toggleEquipment: (equipmentId: string) => void
  handleEquipmentConditionChange: (slug: string, next: ItemCondition) => Promise<void>
  handleUsesChange: (slug: string, next: number) => Promise<void>
  handleSpendAP: (cost: number) => Promise<void>
  handleAbilityUsedChange: (slug: string, next: boolean) => Promise<void>
  handleGenericInventoryChange: (next: GenericInventoryEntry[]) => Promise<void>
  removePartner: (partnerId: string) => void
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
}: PilotSheetActionsOptions): PilotSheetActions {
  // Soft warnings (REQ-012, ADR-021) on BUILD edits only — ability add/remove
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
      void softWarnings.saveAnyway()
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

  // Cap overrides (ADR-022, Free Edit): pin HP/AP maxima via a signed
  // max*Modifier delta; the gauge shows "overridden from N" + a revert. Tagged
  // `override` for the Change Log.
  const overridePilotMax = (fields: Partial<Pilot>) => {
    write(fields, LIVE_SHEET_OVERRIDE)
  }

  /** Toggle one of the once-per-Downtime used flags (rules A8–A10). */
  function toggleUsed(key: UsedToggleKey, next: boolean) {
    const prev = freshPilot().usedToggles ?? {}
    write({ usedToggles: { ...prev, [key]: next } })
  }

  /** Persist the full conditions list (flat string set, no partial merge). */
  function handleConditionsChange(next: string[]) {
    write({ conditions: next })
  }

  // Collection add/remove (unified edit language archetype B) — always
  // available, writes through on toggle (ITUN auto-saves; no Save button).
  // Reads the FRESHEST record so rapid toggles in the picker grid don't race
  // the async store write.
  // Advisory only (soft warnings), never rule-GATED: the cap, tree order and
  // the Advanced/Legendary prerequisites surface in a confirm dialog and the
  // user may always proceed.
  function toggleAbility(abilityId: string) {
    const abilities = freshPilot().abilities
    const removing = abilities.includes(abilityId)
    const name = resolveAbility(abilityId)?.name ?? abilityId
    saveBuildEdit(
      {
        abilities: removing ? abilities.filter((a) => a !== abilityId) : [...abilities, abilityId],
      },
      `${removing ? 'Remove' : 'Add'} ${name}`
    )
  }

  function toggleEquipment(equipmentId: string) {
    const equipment = freshPilot().equipment
    write({
      equipment: equipment.includes(equipmentId)
        ? equipment.filter((e) => e !== equipmentId)
        : [...equipment, equipmentId],
    })
  }

  async function handleEquipmentConditionChange(slug: string, next: ItemCondition) {
    const prev = freshPilot().equipmentConditions ?? {}
    const prevCondition = prev[slug] ?? 'intact'
    await writeAwait({ equipmentConditions: { ...prev, [slug]: next } })
    // U-6: landing on 'destroyed' offers a one-tap Undo (mis-tap mid-combat).
    if (next === 'destroyed' && prevCondition !== 'destroyed') {
      const name = resolveEquipment(slug)?.name ?? slug
      destroyedUndoToast(name, () => {
        void handleEquipmentConditionChange(slug, prevCondition)
      })
    }
  }

  async function handleUsesChange(slug: string, next: number) {
    const prev = freshPilot().equipmentUses ?? {}
    await writeAwait({ equipmentUses: { ...prev, [slug]: next } })
  }

  async function handleSpendAP(cost: number) {
    const p = freshPilot()
    const current = p.currentAP ?? pilotMaxAP(p)
    const next = Math.max(0, current - cost)
    if (next === current) return
    await writeAwait({ currentAP: next })
  }

  async function handleAbilityUsedChange(slug: string, next: boolean) {
    const prev = new Set(freshPilot().usedAbilities ?? [])
    if (next) {
      prev.add(slug)
    } else {
      prev.delete(slug)
    }
    await writeAwait({ usedAbilities: Array.from(prev) })
  }

  async function handleGenericInventoryChange(next: GenericInventoryEntry[]) {
    await writeAwait({ genericInventory: next })
  }

  /** Drop one ability-granted partner instance. */
  function removePartner(partnerId: string) {
    const partners = pilot.partners ?? []
    write({ partners: partners.filter((p) => p.id !== partnerId) })
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
    removePartner,
    warnings: softWarnings.warnings,
    warningSubtitle,
    cancelBuildEdit: () => {
      softWarnings.fixIt()
      setWarningSubtitle(null)
    },
    confirmBuildEdit: () => {
      void softWarnings.saveAnyway()
      setWarningSubtitle(null)
    },
  }
}
