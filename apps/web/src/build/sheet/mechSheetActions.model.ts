import type { UnitsStore } from '../../replica/units'
/**
 * useMechSheetActions — every write the mech Live Sheet can make, in one place.
 *
 * The sibling of `pilotSheetActions.model.ts`, and the same rationale: nine handlers
 * each re-spelling `storeState.update('mech', mech.id, …, LIVE_SHEET_MANUAL)`
 * is what made the offline-refusal wrapper a ~45-site edit. There is one
 * `write()` here, and one `writeAwait()` for the handlers that must sequence
 * something after the write lands (the destroyed-undo toast, the scrap-pool
 * deduction that follows a repair).
 *
 * `writeAwait` deliberately does NOT catch: catching inside would let the undo
 * toast — and the pool deduction — proceed off a write that never landed. The
 * rejection propagates out of the handler instead, and the sheet runs each
 * awaited handler through `runWrite`, so a refused write is told to the player
 * rather than left as an unhandled rejection (CANTINA-D).
 *
 * Every handler reads the FRESHEST record via `freshEntity` rather than the
 * render-time prop, so rapid sequential edits do not stomp each other.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import type { Mech } from 'game-domain/schemas/mech'
import { useState } from 'react'
import type { SoftWarning } from 'salvageunion-reference/rules'
import { useSoftWarnings } from '../../components/shared/useSoftWarnings'
import { drawFromPool } from '../../lib/rules/crawlerEconomy'
import { cycleCondition, resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { mechRuleBreaks, ruleBreaksMade } from '../../lib/rules/ruleBreaks'
import { runWrite } from '../../lib/runWrite'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL, LIVE_SHEET_OVERRIDE, liveSheetFor } from '../../replica/provenance'
import type { ChangeMeta, UnitsState } from '../../replica/units'
import { takeBack } from './changeLog.model'
import { destroyedUndoToast } from './destroyedUndoToast.model'
import { changedFields, freshEntity } from './freshEntity.model'
import { ruleBreakToast } from './ruleBreakToast.model'
import type { SheetPatch } from './sheetViewProps.model'
import { undoToast } from './undoToast.model'

export type ItemKind = 'system' | 'module'

type MechSheetActionsOptions = {
  mech: Mech
  /** Injectable store hook — forwarded to `useSoftWarnings`. */
  store: UnitsStore
  storeState: UnitsState
  /** The linked home crawler, or null — the repair scrap-pool deduction target. */
  crawler: Crawler | null
  /** The assigned pilot's abilities: one can raise the mech's Cargo Capacity (ADR-029). */
  pilotAbilities?: string[]
}

export type MechSheetActions = {
  patchMech: SheetPatch
  /** A play-state write made for one of the mech's items, which the Change Log names (r5 C9). */
  patchFor: (fields: Partial<Mech>, did: string) => void
  overrideMechMax: (fields: Partial<Mech>) => void
  addItem: (kind: ItemKind, slug: string) => void
  removeItem: (kind: ItemKind, index: number) => void
  cycleItemCondition: (kind: ItemKind, slug: string) => Promise<void>
  setItemUses: (slug: string, next: number) => Promise<void>
  repairItem: (
    kind: ItemKind,
    slug: string,
    payFromTl: number | null,
    cost: number
  ) => Promise<void>
  saveQuirk: (next: string) => void
  saveAppearance: (next: string) => void
  saveDescription: (next: string) => void
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
  pilotAbilities,
}: MechSheetActionsOptions): MechSheetActions {
  // Soft warnings (ADR-021) on the one mech BUILD edit the rules
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

  /**
   * The one fire-and-forget write on this sheet — see the header note. A write
   * that takes the loadout over its slots or the hold over its Cargo, or
   * further over, still saves, and says so as it does (R71).
   */
  function write(fields: Partial<Mech>, meta: ChangeMeta = LIVE_SHEET_MANUAL): void {
    if ('systems' in fields || 'modules' in fields || 'chassisRef' in fields) {
      const before = freshMech()
      ruleBreakToast(
        mech.id,
        ruleBreaksMade(
          mechRuleBreaks(before, pilotAbilities),
          mechRuleBreaks({ ...before, ...fields }, pilotAbilities)
        )
      )
    }
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
  // A pin is its own field, never a signed delta: one field carrying both a
  // hand pin and every rules modifier would render an automatic contribution as
  // an override. See ADR-029.
  //
  // Callers normalise the pin with `pinFor` (a pin equal to the derivation is
  // written as none); a commit that changes nothing is not written at all.
  const overrideMechMax = (fields: Partial<Mech>) => {
    const changed = changedFields(freshMech(), fields)
    if (changed) write(changed, LIVE_SHEET_OVERRIDE)
  }

  // Collection add/remove (unified edit language archetype B) — always
  // available, writes through immediately (The app auto-saves; no Save button).
  // Reads the FRESHEST record so rapid picker clicks don't race the async
  // store write. Duplicates are rules-legal; capacity stays soft.
  // Hand-editing the loadout never clears startingPatternRef: it is where the mech
  // started, not what it is now. Free Edit: add/remove is not rule-gated (ADR-021).
  function addItem(kind: ItemKind, slug: string) {
    const fresh = freshMech()
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
    // A removal lands at once and offers its own Undo (r4 E3): that one item
    // back, choices and all, on the loadout as it is by then.
    const offerUndo = (name: string | undefined, after: Partial<Mech>) =>
      undoToast(
        buildSheetCopy('removedName', { name: name ?? buildSheetCopy('item') }),
        () => write(takeBack(freshMech(), fresh, after)),
        mech.id,
        { stack: true, wrote: after }
      )
    if (kind === 'module') {
      const gone = fresh.modules[index]
      const modules = fresh.modules.filter((_, i) => i !== index)
      const after = { modules, ...choicesLeft(fresh, gone, modules) }
      write(after)
      offerUndo((gone && resolveModule(gone)?.name) || gone, after)
      return
    }
    const removed = fresh.systems[index]
    const systems = fresh.systems.filter((_, i) => i !== index)
    const patch = { systems, ...choicesLeft(fresh, removed, systems) }
    if (softWarnings.preview(patch).length === 0) {
      runWrite(() => softWarnings.saveAnyway())
      offerUndo((removed && resolveSystem(removed)?.name) || removed, patch)
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
    // Landing on 'destroyed' offers a one-tap Undo (mis-tap mid-combat).
    if (next === 'destroyed') {
      const name = (kind === 'system' ? resolveSystem(slug) : resolveModule(slug))?.name ?? slug
      destroyedUndoToast(name, () => {
        runWrite(() => setItemCondition(kind, slug, prevCondition))
      })
    }
  }

  async function setItemUses(slug: string, next: number) {
    const prevUses = freshMech().itemUses ?? {}
    await writeAwait({ itemUses: { ...prevUses, [slug]: Math.max(0, next) } })
  }

  /**
   * Repair to Intact (half SV in Scrap — the cost is shown on the button).
   * `payFromTl` (the item's Tech Level) draws the cost from the crawler pool at
   * that Tech Level or higher; a short pool spends what it has (advisory), and
   * null repairs without paying.
   */
  async function repairItem(kind: ItemKind, slug: string, payFromTl: number | null, cost: number) {
    const fresh = freshMech()
    const prev = (kind === 'system' ? fresh.systemConditions : fresh.moduleConditions) ?? {}
    const nextMap: Record<string, ItemCondition> = {
      ...prev,
      [slug]: 'intact',
    }
    await writeAwait(
      kind === 'system' ? { systemConditions: nextMap } : { moduleConditions: nextMap }
    )
    if (payFromTl !== null && crawler) {
      const freshCrawler = freshEntity(storeState, 'crawler', crawler)
      const drawn = drawFromPool(freshCrawler.scrapPool ?? {}, payFromTl, cost, { partial: true })
      await storeState.update('crawler', crawler.id, { scrapPool: drawn.pool }, LIVE_SHEET_MANUAL)
    }
  }

  /** Quirk / Appearance / Description field save: trimmed, blank clears it. */
  function saveQuirk(next: string) {
    write({ quirk: next.trim() || undefined })
  }

  function saveAppearance(next: string) {
    write({ appearance: next.trim() || undefined })
  }

  function saveDescription(next: string) {
    write({ description: next.trim() || undefined })
  }

  return {
    patchMech,
    patchFor: (fields, did) => write(fields, liveSheetFor(did)),
    overrideMechMax,
    addItem,
    removeItem,
    cycleItemCondition,
    setItemUses,
    repairItem,
    saveQuirk,
    saveAppearance,
    saveDescription,
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

/**
 * The item choices left once `slug`'s copy goes: its picks go with the last
 * copy, so re-installing it starts fresh, as the wizard's do (`madeChoices`).
 */
function choicesLeft(
  mech: Mech,
  slug: string | undefined,
  remaining: readonly string[]
): Pick<Mech, 'itemChoices'> | Record<string, never> {
  const choices = mech.itemChoices
  if (!slug || !choices || !(slug in choices) || remaining.includes(slug)) return {}
  const { [slug]: _gone, ...kept } = choices
  return { itemChoices: kept }
}
