/**
 * MechSheet — the mech variant BODY for the LiveSheet shell (design §4.3,
 * plan 4.5; redesigned to the poster layout, phase 2).
 *
 * The hero (identity block, chassis-stats strip, SP/EP/Heat gauges, rail)
 * lives in SheetMech.tsx on the shared shell; this component renders the
 * body slabs in the poster's reading order:
 *
 *   Heat Check panel  — the preserved Heat Check / Push / Reactor Overload
 *                       automation (lib/rules/heatCheck), wired to the same
 *                       derived maxima the hero trackers edit, plus manual
 *                       Clear affordances for the shutdown / vulnerable /
 *                       destroyed flags (gap 8).
 *   Take Damage       — SP intake with the p.240 conversions (R-1).
 *   Chassis Ability   — the chassis's ability actions as Erow'd cards with a
 *                       Use action (spends EP; blocked while shut down).
 *   Quirk / Appearance — the poster's two identity FIELD sections, each with
 *                       its own per-section Edit (archetype A). Appearance
 *                       read-falls-back to the deprecated `description` for
 *                       pre-split mechs and heals into `appearance` on save.
 *   Systems / Modules — compact entity cards (MechItemCard, max 2 columns)
 *                       with Intact/Damaged status, Use / Repair / uses
 *                       economy, per-card remove, and an always-available
 *                       '+ Add' opening the shared picker modal (archetype B).
 *   The Hold          — StorageManifest side='mech' over the useCargo
 *                       boundary (Stow →; SCRAP deposits the TL pool).
 *   Retire            — the scrap-a-mech helper (live-play only).
 *
 * Dep-injectable for tests: `chassis` (stats override), `store` (Zustand
 * stub), `roll` (deterministic d20), `crawler` (linked home crawler — null
 * means no pool/stow target). readOnly suppresses every edit affordance.
 */

import { useState } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import { Btn, Slab } from 'suref-react'

import { useCargo } from '../../lib/cargo/useCargo'
import { computeMechCapacity } from '../../lib/rules/capacity'
import { mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { clampHeat } from '../../lib/rules/heatCheck'
import type { Roll } from '../../lib/rules/heatCheck'
import { addToScrapPool } from '../../lib/cargo/cargoTransfer'
import type { Crawler } from '../../lib/schemas/crawler'
import type { ItemCondition, Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { InstallStep } from '../mech/InstallStep'
import { ActionCardErow } from './ActionCardErow'
import { destroyedUndoToast } from './destroyedUndoToast'
import { Ecflow, Erow } from './Erow'
import { HeatCheckControl } from './HeatCheckControl'
import { MechItemCard } from './MechItemCard'
import { cycleCondition, resolveModule, resolveSystem } from './mechItemRules'
import type { MechItemEconomy } from './mechItemRules'
import { ScrapMechControl } from './ScrapMechControl'
import { SectionAddButton, SheetPickerModal } from './SheetSection'
import { SheetDescription } from './SheetDescription'
import { StorageManifest } from './StorageManifest'
import { TakeDamageControl } from './TakeDamageControl'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { AdvisoryText, freshEntity } from './controlPrimitives'

// Narrow subset of chassis data the stat derivations need
type ChassisLike = {
  name: string
  structurePoints?: number
  energyPoints?: number
  heatCapacity?: number
  systemSlots?: number
  moduleSlots?: number
  cargoCapacity?: number
}

type MechSheetProps = {
  mech: Mech
  /**
   * Injectable chassis for testing. When omitted, resolved from
   * SalvageUnionReference.Chassis.find() via mech.chassisRef.
   */
  chassis?: ChassisLike | null
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
  /** Suppresses every edit affordance (published snapshots). */
  readOnly?: boolean
  /**
   * Injectable d20 roller for the Heat Check loop — defaults to a randsum
   * roll. Pass a deterministic roller in tests.
   */
  roll?: Roll
  /**
   * The linked home crawler (composition resolver) — powers The Hold's stow
   * target and the optional repair scrap-pool deduction. Null = unlinked.
   */
  crawler?: Crawler | null
}

function resolveChassis(mech: Mech, override?: ChassisLike | null): ChassisLike | null {
  if (override !== undefined) return override
  return resolveChassisRef(mech.chassisRef)
}

type ItemKind = 'system' | 'module'

export function MechSheet({
  mech,
  chassis: chassisOverride,
  store = useEntityStore,
  readOnly = false,
  roll,
  crawler = null,
}: MechSheetProps) {
  const chassis = resolveChassis(mech, chassisOverride)
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  const [picker, setPicker] = useState<ItemKind | null>(null)

  // Derived maxima (plan 2.5): chassis stat + hand-edited modifiers.
  const maxEP = mechMaxEP(mech, chassis)
  const heatCap = mechMaxHeat(mech, chassis)
  const currentSP = mech.currentSP ?? mechMaxSP(mech, chassis)
  const currentEP = mech.currentEP ?? maxEP
  const currentHeat = mech.currentHeat ?? heatCap

  // Slot budgets for the picker's loadout panel (soft — never blocks).
  const capacity = computeMechCapacity({
    chassisRef: mech.chassisRef,
    systems: mech.systems.map((ref) => ({ ref })),
    modules: mech.modules.map((ref) => ({ ref })),
  })

  // Chassis abilities come from the FULL reference chassis (the injectable
  // override only carries stats). Unresolved chassis → no ability slab.
  const chassisEntity = resolveChassisRef(mech.chassisRef)
  const chassisAbilities = chassisEntity
    ? (SalvageUnionReference.resolveActions(chassisEntity) ?? [])
    : []

  const scrapPool = crawler ? (crawler.scrapPool ?? {}) : null

  /** Freshest mech from the store — rapid actions must not stomp each other. */
  function freshMech(): Mech {
    return freshEntity(storeState, 'mech', mech)
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
    void storeState.update(
      'mech',
      mech.id,
      kind === 'system'
        ? { systems: [...fresh.systems, slug] }
        : { modules: [...fresh.modules, slug] }
    )
  }

  function removeItem(kind: ItemKind, index: number) {
    const fresh = freshMech()
    void storeState.update(
      'mech',
      mech.id,
      kind === 'system'
        ? { systems: fresh.systems.filter((_, i) => i !== index) }
        : { modules: fresh.modules.filter((_, i) => i !== index) }
    )
  }

  /** Write one item's condition (used by the cycle and the toast Undo). */
  async function setItemCondition(kind: ItemKind, slug: string, condition: ItemCondition) {
    const fresh = freshMech()
    const prev = (kind === 'system' ? fresh.systemConditions : fresh.moduleConditions) ?? {}
    const nextMap = { ...prev, [slug]: condition }
    await storeState.update(
      'mech',
      mech.id,
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

  /** One activation: spend EP, take Hot heat, tick the uses counter down. */
  async function activateItem(slug: string, economy: MechItemEconomy) {
    const fresh = freshMech()
    const patch: Partial<Mech> = {}
    if (economy.epCost > 0) {
      patch.currentEP = Math.max(0, (fresh.currentEP ?? maxEP) - economy.epCost)
    }
    if (economy.heat > 0) {
      patch.currentHeat = clampHeat((fresh.currentHeat ?? heatCap) + economy.heat, heatCap)
    }
    if (economy.maxUses > 0) {
      const prevUses = fresh.itemUses ?? {}
      const remaining = Math.min(prevUses[slug] ?? economy.maxUses, economy.maxUses)
      patch.itemUses = { ...prevUses, [slug]: Math.max(0, remaining - 1) }
    }
    if (Object.keys(patch).length > 0) {
      await storeState.update('mech', mech.id, patch)
    }
  }

  async function setItemUses(slug: string, next: number) {
    const fresh = freshMech()
    const prevUses = fresh.itemUses ?? {}
    await storeState.update('mech', mech.id, {
      itemUses: { ...prevUses, [slug]: Math.max(0, next) },
    })
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
    await storeState.update(
      'mech',
      mech.id,
      kind === 'system' ? { systemConditions: nextMap } : { moduleConditions: nextMap }
    )
    if (deductTl !== null && crawler) {
      const freshCrawler = freshEntity(storeState, 'crawler', crawler)
      await storeState.update('crawler', crawler.id, {
        scrapPool: addToScrapPool(freshCrawler.scrapPool ?? {}, deductTl, -cost),
      })
    }
  }

  async function activateChassisAbility(epCost: number) {
    const fresh = freshMech()
    await storeState.update('mech', mech.id, {
      currentEP: Math.max(0, (fresh.currentEP ?? maxEP) - epCost),
    })
  }

  function renderItems(kind: ItemKind, slugs: string[]) {
    const conditions = (kind === 'system' ? mech.systemConditions : mech.moduleConditions) ?? {}
    if (slugs.length === 0) {
      return (
        <p className="font-body text-caption text-wk-muted">
          {kind === 'system' ? 'No systems installed.' : 'No modules installed.'}
        </p>
      )
    }
    return (
      <Ecflow>
        {slugs.map((slug, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same system/module slug may be installed more than once, so the slug alone is not unique; install order is stable
          <Erow key={`${slug}-${index}`}>
            <MechItemCard
              slug={slug}
              entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
              condition={conditions[slug] ?? 'intact'}
              usesRemaining={mech.itemUses?.[slug]}
              currentEP={currentEP}
              scrapPool={scrapPool}
              readOnly={readOnly}
              onStatusCycle={() => {
                void cycleItemCondition(kind, slug)
              }}
              onUse={(economy) => {
                void activateItem(slug, economy)
              }}
              onUsesChange={(next) => {
                void setItemUses(slug, next)
              }}
              onRepair={(deductTl, cost) => {
                void repairItem(kind, slug, deductTl, cost)
              }}
              onRemove={
                readOnly
                  ? undefined
                  : () => {
                      removeItem(kind, index)
                    }
              }
            />
          </Erow>
        ))}
      </Ecflow>
    )
  }

  return (
    <section aria-labelledby="mech-sheet-heading" className="flex flex-col gap-6">
      {/* The hero already shows the name — this heading is for a11y/print. */}
      <h2 id="mech-sheet-heading" className="sr-only">
        {mech.name}
      </h2>

      {!chassis && (
        <AdvisoryText>
          Unknown chassis &ldquo;{mech.chassisRef}&rdquo; — using stored/zero defaults
        </AdvisoryText>
      )}

      {/* Heat Check / Push / Reactor Overload loop — wired to the same
          derived maxima the hero trackers edit. */}
      <HeatCheckControl
        mech={mech}
        heatCap={heatCap}
        currentSP={currentSP}
        currentHeat={currentHeat}
        store={store}
        roll={roll}
        readOnly={readOnly}
      />

      {/* Take Damage / Critical Damage loop (R-1) — SP intake with the p.240
          conversions, prompting the Critical Damage Table roll at 0 SP. */}
      <TakeDamageControl
        mech={mech}
        currentSP={currentSP}
        store={store}
        roll={roll}
        readOnly={readOnly}
      />

      {chassisAbilities.length > 0 && (
        <div>
          <Slab label="Chassis Ability" count={chassisAbilities.length} />
          <Ecflow>
            {chassisAbilities.map((ability) => {
              const epCost = typeof ability.activationCost === 'number' ? ability.activationCost : 0
              const reason = mech.destroyed
                ? 'Mech destroyed'
                : mech.shutdown
                  ? 'Shut down — clear shutdown first'
                  : epCost > currentEP
                    ? `Not enough EP (needs ${epCost})`
                    : null
              return (
                <ActionCardErow
                  key={ability.id}
                  ability={ability}
                  footMeta={epCost > 0 ? [{ label: 'EP Cost', value: epCost }] : undefined}
                  actions={
                    !readOnly && epCost > 0 ? (
                      <Btn
                        size="sm"
                        variant="primary"
                        disabled={reason !== null}
                        title={reason ?? undefined}
                        aria-label={`Use ${ability.name}`}
                        onClick={() => {
                          void activateChassisAbility(epCost)
                        }}
                      >
                        Use
                      </Btn>
                    ) : undefined
                  }
                />
              )
            })}
          </Ecflow>
        </div>
      )}

      {/* Quirk + Appearance — the poster's two identity FIELD sections, each
          with its own per-section Edit (unified edit language archetype A).
          Appearance read-falls-back to the deprecated `description` for
          pre-split mechs and heals into `appearance` on save. */}
      <SheetDescription
        label="Quirk"
        text={mech.quirk}
        onSave={
          readOnly
            ? undefined
            : (next) => storeState.update('mech', mech.id, { quirk: next.trim() || undefined })
        }
      />
      <SheetDescription
        label="Appearance"
        text={mech.appearance ?? mech.description}
        onSave={
          readOnly
            ? undefined
            : (next) =>
                storeState.update('mech', mech.id, {
                  appearance: next.trim() || undefined,
                  description: undefined,
                })
        }
      />

      {/* Systems / Modules — collection sections: compact cards (max 2-up via
          Ecflow) with an always-available '+ Add' (archetype B). */}
      <div>
        <Slab
          label="Systems"
          count={
            <span className="tabular-nums">
              {capacity.systemSlotsUsed}/{capacity.systemSlotsMax} slots
            </span>
          }
          actions={
            readOnly ? undefined : (
              <SectionAddButton label="system" onClick={() => setPicker('system')} />
            )
          }
        />
        {renderItems('system', mech.systems)}
      </div>

      <div>
        <Slab
          label="Modules"
          count={
            <span className="tabular-nums">
              {capacity.moduleSlotsUsed}/{capacity.moduleSlotsMax} slots
            </span>
          }
          actions={
            readOnly ? undefined : (
              <SectionAddButton label="module" onClick={() => setPicker('module')} />
            )
          }
        />
        {renderItems('module', mech.modules)}
      </div>

      <div>
        <Slab
          label="The Hold"
          count={
            <span className="tabular-nums">
              {cargo.state.mechLots.length} {cargo.state.mechLots.length === 1 ? 'lot' : 'lots'} ·{' '}
              {cargo.usage.used}/{cargo.usage.cap} slots
            </span>
          }
        />
        <StorageManifest
          side="mech"
          cargo={cargo}
          mechName={mech.name}
          crawlerName={crawler?.name ?? null}
          readOnly={readOnly}
        />
      </div>

      {/* Retire — the scrap-a-mech helper (design-review R-7, p.248).
          Live-play only: it ends in a delete, so snapshots never show it. */}
      {!readOnly && (
        <div>
          <Slab label="Retire" count="full Salvage Value in Scrap · deletes the mech" />
          <ScrapMechControl mech={mech} crawler={crawler} store={store} />
        </div>
      )}

      {/* The ONE shared picker modal — Systems & Modules '+ Add' both open it
          (the wizard's install grid writes through on click; no Save button). */}
      <SheetPickerModal
        open={picker === 'system'}
        onClose={() => setPicker(null)}
        title="Add Systems"
        maxWidth="max-w-5xl"
      >
        <InstallStep
          kind="systems"
          selected={mech.systems}
          onAdd={(name) => addItem('system', name)}
          onRemove={(index) => removeItem('system', index)}
          loadoutName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          slotsUsed={capacity.systemSlotsUsed}
          slotsMax={capacity.systemSlotsMax}
          energyValue={currentEP}
          energyMax={maxEP}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'module'}
        onClose={() => setPicker(null)}
        title="Add Modules"
        maxWidth="max-w-5xl"
      >
        <InstallStep
          kind="modules"
          selected={mech.modules}
          onAdd={(name) => addItem('module', name)}
          onRemove={(index) => removeItem('module', index)}
          loadoutName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          slotsUsed={capacity.moduleSlotsUsed}
          slotsMax={capacity.moduleSlotsMax}
          energyValue={currentEP}
          energyMax={maxEP}
        />
      </SheetPickerModal>
    </section>
  )
}
