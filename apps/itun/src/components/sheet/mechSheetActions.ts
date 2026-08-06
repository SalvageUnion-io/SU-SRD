/**
 * useMechSheetActions — every write the mech Live Sheet can make, in one place.
 *
 * The sibling of `pilotSheetActions.ts`, and the same rationale: nine handlers
 * each re-spelling `storeState.update('mech', mech.id, …, LIVE_SHEET_MANUAL)`
 * is what made the offline-refusal wrapper a ~45-site edit. There is one
 * `write()` here, and one `writeAwait()` for the handlers that must sequence
 * something after the write lands (the destroyed-undo toast, the scrap-pool
 * deduction that follows a repair).
 *
 * `writeAwait` deliberately does NOT catch: its callers `void` it, so a
 * rejection stays uncaught exactly as before. Catching inside would let the
 * undo toast — and the pool deduction — proceed off a write that never landed.
 *
 * Every handler reads the FRESHEST record via `freshEntity` rather than the
 * render-time prop, so rapid sequential edits do not stomp each other.
 */

import { useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { addToScrapPool } from '../../lib/cargo/cargoTransfer'
import type { SoftWarning } from '../../lib/rules/types'
import type { Crawler } from '../../lib/schemas/crawler'
import type { ItemCondition, Mech } from '../../lib/schemas/mech'
import type { ChangeMeta, useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE } from '../../stores/surfaceProvenance'
import { useSoftWarnings } from '../shared/useSoftWarnings'
import { freshEntity } from './controlPrimitives'
import { destroyedUndoToast } from './destroyedUndoToast'
import { cycleCondition, resolveModule, resolveSystem } from './mechItemRules'
import type { SheetPatch, SheetStoreState } from './sheetViewProps'
import { runWrite } from './sheetWrite'

export type ItemKind = 'system' | 'module'

/** A pin equal to the derived value is not an override — clear it instead. */
export function pinOrUndef(next: number, derived: number): number | undefined {
  return next === derived ? undefined : next
}

type MechSheetActionsOptions = {
  mech: Mech
  /** Injectable store hook — forwarded to `useSoftWarnings`. */
  store: typeof useEntityStore
  storeState: SheetStoreState
  /** The linked home crawler, or null — the repair scrap-pool deduction target. */
  crawler: Crawler | null
}

export type MechSheetActions = {
  patchMech: SheetPatch
  overrideMechMax: (fields: Partial<Mech>) => void
  addItem: (kind: ItemKind, name: string) => void
  removeItem: (kind: ItemKind, index: number) => void
  cycleItemCondition: (kind: ItemKind, slug: string) => Promise<void>
  setItemUses: (slug: string, next: number) => Promise<void>
  repairItem: (kind: ItemKind, slug: string, deductTl: number | null, cost: number) => Promise<void>
  saveQuirk: (next: string) => void
  saveAppearance: (next: string) => void
  /** Advisory soft-warning state for the confirm dialog. */
  warnings: SoftWarning[]
  warningSubtitle: string | null
  /** Discard the pending build edit (dialog "Fix it"). */
  cancelBuildEdit: () => void
  /** Persist the pending build edit despite its warnings (dialog "Save anyway"). */
  confirmBuildEdit: () => void
}

export function useMechSheetActions({
  mech,
  store,
  storeState,
  crawler,
}: MechSheetActionsOptions): MechSheetActions {
  // Soft warnings (REQ-012, ADR-021) on the one mech BUILD edit the rules
  // evaluate: system removal. Play-state writes (SP/EP/heat, conditions, item
  // activation) deliberately bypass this — they are transient combat state.
  // `toSnapshot` is REQUIRED: Mech.systems is a slug array, while the rules
  // read `{ ref, requires }` structs.
  const softWarnings = useSoftWarnings({
    entityType: 'mech',
    entityId: mech.id,
    toSnapshot: (m) => ({ systems: m.systems.map((ref) => ({ ref })) }),
    store,
  })
  const [warningSubtitle, setWarningSubtitle] = useState<string | null>(null)

  /** Freshest mech from the store — rapid actions must not stomp each other. */
  function freshMech(): Mech {
    return freshEntity(storeState, 'mech', mech)
  }

  /** The one fire-and-forget write on this sheet — see the header note. */
  function write(fields: Partial<Mech>, meta: ChangeMeta = LIVE_SHEET_MANUAL): void {
    runWrite(() => storeState.update('mech', mech.id, fields, meta))
  }

  /** The one awaited write on this sheet — see the header note. */
  function writeAwait(
    fields: Partial<Mech>,
    meta: ChangeMeta = LIVE_SHEET_MANUAL
  ): Promise<unknown> {
    return storeState.update('mech', mech.id, fields, meta)
  }

  /** Partial merge on this mech, reading the freshest record when needed. */
  const patchMech: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(freshMech()) : input
    write(fields)
  }

  // Cap overrides (ADR-022 amendment, Free Edit): a pinned maximum is stored
  // ABSOLUTELY in max*Override. The derivation keeps running underneath, so the
  // gauge can show "overridden from N" and revert by clearing the pin.
  //
  // These used to be signed max*Modifier deltas with the baseline recovered by
  // subtraction — which meant the same field carried both a hand pin and every
  // rules modifier, so an automatic contribution would have rendered as an
  // override. max*Modifier now means only "manual adjustment" and contributes to
  // the derivation. See ADR-029.
  const overrideMechMax = (fields: Partial<Mech>) => {
    write(fields, LIVE_SHEET_OVERRIDE)
  }

  // Collection add/remove (unified edit language archetype B) — always
  // available, writes through immediately (ITUN auto-saves; no Save button).
  // Reads the FRESHEST record so rapid picker clicks don't race the async
  // store write. Duplicates are rules-legal; capacity stays soft.
  // Unlike the old build editor, hand-editing the loadout no longer clears
  // patternName — the pattern name IS the mech's identity now (redesign).
  // TODO(redesign): rule-gate add/remove (slot budgets / scrap economy) —
  // deferred; users self-manage for now.
  function addItem(kind: ItemKind, name: string) {
    const fresh = freshMech()
    const slug = nameToSlug(name)
    write(
      kind === 'system'
        ? { systems: [...fresh.systems, slug] }
        : { modules: [...fresh.modules, slug] }
    )
  }

  /**
   * Remove one installed item. System removal is the one mech BUILD edit the
   * soft-warning rules evaluate (SYSTEM_DEPENDENCY_REMOVED — "a system another
   * system depends on is being removed"), so it previews first and confirms
   * only when something is flagged. Module removal has no such rule and writes
   * straight through.
   */
  function removeItem(kind: ItemKind, index: number) {
    const fresh = freshMech()
    if (kind === 'module') {
      write({ modules: fresh.modules.filter((_, i) => i !== index) })
      return
    }
    const removed = fresh.systems[index]
    const patch = { systems: fresh.systems.filter((_, i) => i !== index) }
    if (softWarnings.preview(patch).length === 0) {
      void softWarnings.saveAnyway()
      return
    }
    setWarningSubtitle(`Remove ${(removed && resolveSystem(removed)?.name) || removed || 'system'}`)
  }

  /** Write one item's condition (used by the cycle and the toast Undo). */
  async function setItemCondition(kind: ItemKind, slug: string, condition: ItemCondition) {
    const fresh = freshMech()
    const prev = (kind === 'system' ? fresh.systemConditions : fresh.moduleConditions) ?? {}
    const nextMap = { ...prev, [slug]: condition }
    await writeAwait(
      kind === 'system' ? { systemConditions: nextMap } : { moduleConditions: nextMap }
    )
  }

  async function cycleItemCondition(kind: ItemKind, slug: string) {
    const fresh = freshMech()
    const prev = (kind === 'system' ? fresh.systemConditions : fresh.moduleConditions) ?? {}
    const prevCondition = prev[slug] ?? 'intact'
    const next = cycleCondition(prevCondition)
    await setItemCondition(kind, slug, next)
    // U-6: landing on 'destroyed' offers a one-tap Undo (mis-tap mid-combat).
    if (next === 'destroyed') {
      const name = (kind === 'system' ? resolveSystem(slug) : resolveModule(slug))?.name ?? slug
      destroyedUndoToast(name, () => {
        void setItemCondition(kind, slug, prevCondition)
      })
    }
  }

  async function setItemUses(slug: string, next: number) {
    const prevUses = freshMech().itemUses ?? {}
    await writeAwait({ itemUses: { ...prevUses, [slug]: Math.max(0, next) } })
  }

  /**
   * Repair to Intact (half SV in Scrap — the cost is shown on the button).
   * `deductTl` is the optional crawler pool bucket to decrement; the repair
   * itself never blocks on the pool (S12).
   */
  async function repairItem(kind: ItemKind, slug: string, deductTl: number | null, cost: number) {
    const fresh = freshMech()
    const prev = (kind === 'system' ? fresh.systemConditions : fresh.moduleConditions) ?? {}
    const nextMap: Record<string, ItemCondition> = {
      ...prev,
      [slug]: 'intact',
    }
    await writeAwait(
      kind === 'system' ? { systemConditions: nextMap } : { moduleConditions: nextMap }
    )
    if (deductTl !== null && crawler) {
      const freshCrawler = freshEntity(storeState, 'crawler', crawler)
      await storeState.update(
        'crawler',
        crawler.id,
        {
          scrapPool: addToScrapPool(freshCrawler.scrapPool ?? {}, deductTl, -cost),
        },
        LIVE_SHEET_MANUAL
      )
    }
  }

  /** Quirk / Appearance field save — mirrors the old SheetDescription saves. */
  function saveQuirk(next: string) {
    write({ quirk: next.trim() || undefined })
  }

  /** Appearance heals the deprecated `description` field into `appearance`. */
  function saveAppearance(next: string) {
    write({ appearance: next.trim() || undefined, description: undefined })
  }

  return {
    patchMech,
    overrideMechMax,
    addItem,
    removeItem,
    cycleItemCondition,
    setItemUses,
    repairItem,
    saveQuirk,
    saveAppearance,
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
