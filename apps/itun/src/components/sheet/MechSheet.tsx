/**
 * MechSheet — the mech variant BODY for the LiveSheet shell (design §4.3,
 * plan 4.5; redesigned to the poster layout, Phase 2).
 *
 * The body OWNS the identity band now (Workshop-Manual mech sheet): SheetMech
 * passes NO `renderHero`, and this body renders `SheetHero` in band mode as
 * its first region (wrapped with the shell's `heroRef`). Region order mirrors
 * the printed mech sheet:
 *
 *   Identity Band: edge wordmark ∥ the pattern-name/chassis fields + the
 *       8-lozenge chassis-stats strip ∥ SP/EP/Heat `VitalGauge`s + Conditions
 *       vitals rail — one toned frame (the printed top band).
 *   Chassis Ability ∥ Quirk & Appearance — the chassis's ability actions as
 *       EntityGridRow'd cards (Use spends EP; blocked while shut down) and one
 *       combined Quirk/Appearance field section.
 *   Systems & Modules — KEPT as two sections (each its own `SheetSectionSlab`,
 *       3-column card grids): different collections with different '+ Add'
 *       pickers/slot budgets, so folding them into one grid is not trivial.
 *   Linked Units (bare `.sect` header + rail stack) then The Hold — the full-
 *       width Cargo band at the BOTTOM (`StorageManifest side='mech'`),
 *       matching the printed sheet.
 *
 * Section containers follow the card-vs-slab rule (see `SheetSectionSlab`):
 * inputs/gauges get a CARD (the identity band, Quirk & Appearance, The Hold),
 * entity-card collections get a SLAB (Chassis Ability, Systems, Modules,
 * Linked Units) — cards already carry their own frame, so a second frame
 * around them reads as one opaque block.
 *
 * Dropped (redesign D6 — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - `HeatCheckControl` (#407) — Heat Check / Push / Reactor Overload loop.
 *   - `TakeDamageControl` (#406) — Take Damage / Critical Damage loop.
 *   - the Retire slab + `ScrapMechControl` (#411) — the scrap-a-mech helper.
 * The always-live Vitals gauges (SP/EP/Heat) and per-card activation (Use /
 * Repair / uses economy on System/Module cards, chassis-ability Use) are
 * KEPT — only the play-control PANELS drop. Shutdown/Vulnerable/Destroyed
 * still surface (and clear) through the unified Conditions chips in the
 * Vitals card (`MechConditionsEditor`), which already merges those flags.
 *
 * Dep-injectable for tests: `chassis` (stats override), `store` (Zustand
 * stub), `crawler` (linked home crawler — null means no pool/stow target).
 * readOnly suppresses every edit affordance.
 */

import { useState } from 'react'
import type { ReactNode, Ref } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import {
  VitalGauge,
  heatDangerFrom,
  FieldError,
  ReferenceEntityCard,
  SheetHero,
} from 'component-lib'

import { useCargo } from '../../lib/cargo/useCargo'
import { computeMechCapacity, resolveChassisRef } from 'salvageunion-reference/rules'
import { mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { addToScrapPool } from '../../lib/cargo/cargoTransfer'
import type { Crawler } from '../../lib/schemas/crawler'
import type { ItemCondition, Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { EntitySearcher } from 'component-lib'
import { destroyedUndoToast } from './destroyedUndoToast'
import { EntityGrid, EntityGridRow } from 'component-lib'
import { InlineEditField } from 'component-lib'
import { MechConditionsEditor } from './MechConditionsEditor'
import { MechIdentityPanel } from './MechIdentity'
import { MechItemCard } from './MechItemCard'
import { cycleCondition, resolveModule, resolveSystem } from './mechItemRules'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { useSoftWarnings } from '../shared/useSoftWarnings'
import { SectionAddButton, SectionEditButton, SheetPickerModal } from 'component-lib'
import { SheetSectionCard, SheetSectionSlab } from 'component-lib'
import type { ChassisStatItem } from 'component-lib'
import { ChassisStats } from 'component-lib'
import { StorageManifest } from './StorageManifest'
import { freshEntity } from './controlPrimitives'
import type { SheetPatch } from './sheetViewProps'

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
   * Condense sentinel from the LiveSheet shell — wraps the identity band (the
   * body's first region) so the sticky bar still condenses when it scrolls
   * away. Undefined in bare test renders (no shell).
   */
  heroRef?: Ref<HTMLElement>
  /**
   * The linked home crawler (composition resolver) — powers The Hold's stow
   * target and the optional repair scrap-pool deduction. Null = unlinked.
   */
  crawler?: Crawler | null
  /**
   * The Linked Units rail content (pilot + crawler RailChip/RailEmpty), built
   * by SheetMech from `composition` — MechSheet has no composition access of
   * its own, so this is passed straight through into the R4 section.
   */
  linkedUnits?: ReactNode
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
  heroRef,
  crawler = null,
  linkedUnits,
}: MechSheetProps) {
  const chassis = resolveChassis(mech, chassisOverride)
  const storeState = store()
  const cargo = useCargo({ mech, crawler, store, readOnly })
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  const [picker, setPicker] = useState<ItemKind | null>(null)
  // Identity / Quirk+Appearance are FIELD sections (unified edit language
  // archetype A): their own Edit/Done toggle, rendered in the
  // SheetSectionCard header (Phase 2).
  const [identityEditing, setIdentityEditing] = useState(false)
  const [flavourEditing, setFlavourEditing] = useState(false)

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

  // Derived maxima (plan 2.5): chassis stat + hand-edited modifiers.
  const maxSP = mechMaxSP(mech, chassis)
  const maxEP = mechMaxEP(mech, chassis)
  const heatCap = mechMaxHeat(mech, chassis)
  const currentSP = mech.currentSP ?? maxSP
  const currentEP = mech.currentEP ?? maxEP
  const currentHeat = mech.currentHeat ?? heatCap

  // Slot budgets for the picker's loadout panel (soft — never blocks).
  const capacity = computeMechCapacity({
    chassisRef: mech.chassisRef,
    systems: mech.systems.map((ref) => ({ ref })),
    modules: mech.modules.map((ref) => ({ ref })),
  })

  // Chassis abilities AND the identity meta (chassis name, Tech Level, Salvage
  // Value) come from the FULL reference chassis — the injectable `chassis`
  // override only carries the narrow stat subset above.
  const chassisEntity = resolveChassisRef(mech.chassisRef)
  const chassisAbilities = chassisEntity
    ? (SalvageUnionReference.resolveActions(chassisEntity) ?? [])
    : []
  const chassisName = chassisEntity?.name ?? chassis?.name ?? mech.chassisRef
  const techLevel =
    typeof chassisEntity?.techLevel === 'number' ? chassisEntity.techLevel : undefined

  // The poster's 8-lozenge chassis-stats strip (identity card body):
  // Structure/Energy/Heat maxima, System/Module slot usage, Cargo usage,
  // Tech Level, Salvage Value — number-only lozenges, a bounded 4-col grid
  // rather than a free-wrapped strip.
  const specs: ChassisStatItem[] = [
    { code: 'SP', value: maxSP },
    { code: 'EP', value: maxEP },
    { code: 'HEAT', value: heatCap },
    { code: 'SYS', value: capacity.systemSlotsUsed, max: capacity.systemSlotsMax },
    { code: 'MOD', value: capacity.moduleSlotsUsed, max: capacity.moduleSlotsMax },
    { code: 'CARGO', value: cargo.usage.used, max: cargo.usage.cap },
    ...(techLevel !== undefined ? [{ code: 'TL', value: techLevel }] : []),
    ...(typeof chassisEntity?.salvageValue === 'number'
      ? [{ code: 'SV', value: chassisEntity.salvageValue }]
      : []),
  ]

  const scrapPool = crawler ? (crawler.scrapPool ?? {}) : null

  /** Freshest mech from the store — rapid actions must not stomp each other. */
  function freshMech(): Mech {
    return freshEntity(storeState, 'mech', mech)
  }

  /** Partial merge on this mech, reading the freshest record when needed. */
  const patchMech: SheetPatch = (input) => {
    const fields = typeof input === 'function' ? input(freshMech()) : input
    void storeState.update('mech', mech.id, fields)
  }

  // Cap overrides (ADR-022, Free Edit): a derived maximum is pinned by storing
  // a signed max*Modifier delta; the gauge shows "overridden from N" + a revert
  // that clears the delta. Tagged `override` so the Change Log records it as one.
  const derivedMaxSP = maxSP - (mech.maxSpModifier ?? 0)
  const derivedMaxEP = maxEP - (mech.maxEpModifier ?? 0)
  const derivedHeatCap = heatCap - (mech.maxHeatModifier ?? 0)
  const overrideMechMax = (fields: Partial<Mech>) => {
    void storeState.update('mech', mech.id, fields, { kind: 'override' })
  }
  const modOrUndef = (next: number, derived: number): number | undefined => {
    const mod = next - derived
    return mod === 0 ? undefined : mod
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
      void storeState.update('mech', mech.id, {
        modules: fresh.modules.filter((_, i) => i !== index),
      })
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

  /** Quirk / Appearance field save — mirrors the old SheetDescription saves. */
  function saveQuirk(next: string) {
    void storeState.update('mech', mech.id, { quirk: next.trim() || undefined })
  }

  /** Appearance heals the deprecated `description` field into `appearance`. */
  function saveAppearance(next: string) {
    void storeState.update('mech', mech.id, {
      appearance: next.trim() || undefined,
      description: undefined,
    })
  }

  /** One dt/dd row of the combined Quirk & Appearance card. */
  function flavourField(label: string, value: string | undefined, onSave: (next: string) => void) {
    const text = value ?? ''
    return (
      <div>
        <dt className="mb-1 font-cond text-label font-bold uppercase leading-none tracking-caps text-[color:var(--tone-deep)]">
          {label}
        </dt>
        <dd className="m-0">
          {!readOnly && flavourEditing ? (
            <InlineEditField
              multiline
              value={text}
              ariaLabel={`Edit ${label.toLowerCase()}`}
              placeholder="Add a description…"
              onSave={(next) => onSave(String(next))}
            />
          ) : text.trim().length > 0 ? (
            <p className="m-0 whitespace-pre-wrap font-body text-sm text-ink">{text}</p>
          ) : (
            <p className="m-0 font-body text-caption italic text-wk-muted">
              Nothing written yet{!readOnly && ' — hit Edit to add one'}.
            </p>
          )}
        </dd>
      </div>
    )
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
      <EntityGrid columns={3}>
        {slugs.map((slug, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same system/module slug may be installed more than once, so the slug alone is not unique; install order is stable
          <EntityGridRow key={`${slug}-${index}`}>
            <MechItemCard
              slug={slug}
              entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
              condition={conditions[slug] ?? 'intact'}
              usesRemaining={mech.itemUses?.[slug]}
              scrapPool={scrapPool}
              readOnly={readOnly}
              onStatusCycle={() => {
                void cycleItemCondition(kind, slug)
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
          </EntityGridRow>
        ))}
      </EntityGrid>
    )
  }

  return (
    <section
      aria-labelledby="mech-sheet-heading"
      // `.sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width (redesign D7), not the viewport.
      className="sheet-section @container flex flex-col gap-6"
    >
      {/* The hero already shows the name — this heading is for a11y/print. */}
      <h2 id="mech-sheet-heading" className="sr-only">
        {mech.name}
      </h2>

      {!chassis && (
        <FieldError>
          Unknown chassis &ldquo;{mech.chassisRef}&rdquo; — using stored/zero defaults
        </FieldError>
      )}

      {/* ===== Identity Band (Workshop-Manual mech sheet top region) =====
          Edge wordmark ∥ Chassis/Pattern fields + Chassis-Stats strip ∥
          SP/EP/Heat + Conditions vitals rail, in one toned frame. Carries the
          shell's condense sentinel (heroRef). */}
      <SheetHero
        heroRef={heroRef}
        cat="Mech"
        name={mech.name}
        controls={
          !readOnly ? (
            <SectionEditButton
              section="Identity"
              editing={identityEditing}
              onToggle={() => setIdentityEditing((v) => !v)}
            />
          ) : undefined
        }
        fields={
          <div className="flex min-w-0 flex-col gap-3">
            <MechIdentityPanel
              mech={mech}
              chassisName={chassisName}
              techLevel={techLevel}
              editing={identityEditing}
              patch={readOnly ? undefined : patchMech}
            />
            <ChassisStats items={specs} className="grid grid-cols-2 gap-2 @sm:grid-cols-4" />
          </div>
        }
        vitals={
          <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
            <VitalGauge
              label="SP"
              subLabel="Structure"
              value={currentSP}
              max={maxSP}
              onChange={readOnly ? undefined : (v) => patchMech({ currentSP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) => overrideMechMax({ maxSpModifier: modOrUndef(next, derivedMaxSP) })
              }
              overriddenFrom={readOnly ? undefined : derivedMaxSP}
              onRevertOverride={
                readOnly ? undefined : () => overrideMechMax({ maxSpModifier: undefined })
              }
              readOnly={readOnly}
            />
            <VitalGauge
              label="EP"
              subLabel="Energy"
              value={currentEP}
              max={maxEP}
              onChange={readOnly ? undefined : (v) => patchMech({ currentEP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) => overrideMechMax({ maxEpModifier: modOrUndef(next, derivedMaxEP) })
              }
              overriddenFrom={readOnly ? undefined : derivedMaxEP}
              onRevertOverride={
                readOnly ? undefined : () => overrideMechMax({ maxEpModifier: undefined })
              }
              readOnly={readOnly}
            />
            <VitalGauge
              label="Heat"
              value={currentHeat}
              max={heatCap}
              danger={heatCap > 0 ? heatDangerFrom(heatCap) : undefined}
              onChange={readOnly ? undefined : (v) => patchMech({ currentHeat: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) => overrideMechMax({ maxHeatModifier: modOrUndef(next, derivedHeatCap) })
              }
              overriddenFrom={readOnly ? undefined : derivedHeatCap}
              onRevertOverride={
                readOnly ? undefined : () => overrideMechMax({ maxHeatModifier: undefined })
              }
              readOnly={readOnly}
            />
            <div className="flex w-full flex-col gap-2">
              <span
                className="font-cond text-label font-bold uppercase tracking-caps"
                style={{ color: 'var(--tone-deep, var(--color-ink))' }}
              >
                Conditions
              </span>
              <MechConditionsEditor mech={mech} store={store} readOnly={readOnly} />
            </div>
          </div>
        }
      />

      {/* ===== R2: Chassis Ability ∥ Quirk & Appearance ===== */}
      <div className="grid grid-cols-1 gap-[22px] @5xl:grid-cols-12 @5xl:gap-6">
        {chassisAbilities.length > 0 && (
          <div className="@5xl:col-span-7">
            <SheetSectionSlab
              title="Chassis Ability"
              count={`${chassisAbilities.length} ${chassisAbilities.length === 1 ? 'action' : 'actions'}`}
            >
              <EntityGrid>
                {chassisAbilities.map((ability) => {
                  // Activating an ability (spending its EP) is a Guided-Play
                  // transaction — it lives on the Dashboard, not the Free-Edit
                  // Live Sheet (ADR-021). The sheet shows the ability + its EP
                  // cost; EP is spent by hand-editing the EP gauge (free state).
                  const epCost =
                    typeof ability.activationCost === 'number' ? ability.activationCost : 0
                  return (
                    // The ability's action card is not an entity card (no card
                    // foot / controls of its own), so the EP cost renders in
                    // the row's 'rail' callout beside it.
                    <EntityGridRow
                      key={ability.id}
                      mode="rail"
                      footMeta={epCost > 0 ? [{ label: 'EP Cost', value: epCost }] : undefined}
                    >
                      <ReferenceEntityCard data={ability} hostTone="var(--color-sheet-mech-deep)" />
                    </EntityGridRow>
                  )
                })}
              </EntityGrid>
            </SheetSectionSlab>
          </div>
        )}

        <div className="@5xl:col-span-5">
          <SheetSectionCard
            title="Quirk & Appearance"
            controls={
              !readOnly ? (
                <SectionEditButton
                  section="Quirk & Appearance"
                  editing={flavourEditing}
                  onToggle={() => setFlavourEditing((v) => !v)}
                />
              ) : undefined
            }
          >
            <dl className="m-0 flex flex-col [&>div+div]:mt-2.5 [&>div+div]:border-t [&>div+div]:border-dashed [&>div+div]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>div+div]:pt-2.5">
              {flavourField('Quirk', mech.quirk, saveQuirk)}
              {flavourField('Appearance', mech.appearance ?? mech.description, saveAppearance)}
            </dl>
          </SheetSectionCard>
        </div>
      </div>

      {/* ===== R3: Systems & Modules — kept as two sections (different
          collections/pickers; not a trivial unify), each led by its own
          SheetSectionSlab. ===== */}
      <SheetSectionSlab
        title="Systems"
        count={
          <span className="tabular-nums">
            {capacity.systemSlotsUsed}/{capacity.systemSlotsMax} slots
          </span>
        }
        controls={
          readOnly ? undefined : (
            <SectionAddButton label="system" onClick={() => setPicker('system')} />
          )
        }
      >
        {renderItems('system', mech.systems)}
      </SheetSectionSlab>

      <SheetSectionSlab
        title="Modules"
        count={
          <span className="tabular-nums">
            {capacity.moduleSlotsUsed}/{capacity.moduleSlotsMax} slots
          </span>
        }
        controls={
          readOnly ? undefined : (
            <SectionAddButton label="module" onClick={() => setPicker('module')} />
          )
        }
      >
        {renderItems('module', mech.modules)}
      </SheetSectionSlab>

      {/* ===== Linked Units, then The Hold (full-width bottom band) =====
          The printed mech sheet puts Cargo as a full-width band at the bottom
          (p.2), so Linked Units reads first (bare `.sect` header + rail stack,
          matching PilotSheet) and The Hold is the full-width band below it. */}
      <SheetSectionSlab title="Linked Units" bodyClassName="flex flex-col gap-4">
        {linkedUnits}
      </SheetSectionSlab>

      <SheetSectionCard
        title="The Hold"
        count={
          <span className="tabular-nums">
            {cargo.state.mechLots.length} {cargo.state.mechLots.length === 1 ? 'lot' : 'lots'} ·{' '}
            {cargo.usage.used}/{cargo.usage.cap} slots
          </span>
        }
      >
        <StorageManifest
          side="mech"
          cargo={cargo}
          mechName={mech.name}
          crawlerName={crawler?.name ?? null}
          readOnly={readOnly}
        />
      </SheetSectionCard>

      {/* The ONE shared picker modal — Systems & Modules '+ Add' both open it
          (the wizard's install grid writes through on click; no Save button). */}
      <SheetPickerModal
        open={picker === 'system'}
        onClose={() => setPicker(null)}
        title="Add Systems"
        floating
      >
        <EntitySearcher
          schema="systems"
          mode="count"
          selected={mech.systems}
          onAdd={(name) => addItem('system', name)}
          onRemove={(index) => removeItem('system', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel="Installed"
          emptyMessage="No systems match those filters."
          budget={[
            { label: 'System Slots', used: capacity.systemSlotsUsed, max: capacity.systemSlotsMax },
            { label: 'Energy', used: currentEP, max: maxEP, tone: 'ap' },
          ]}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'module'}
        onClose={() => setPicker(null)}
        title="Add Modules"
        floating
      >
        <EntitySearcher
          schema="modules"
          mode="count"
          selected={mech.modules}
          onAdd={(name) => addItem('module', name)}
          onRemove={(index) => removeItem('module', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel="Installed"
          emptyMessage="No modules match those filters."
          budget={[
            { label: 'Module Slots', used: capacity.moduleSlotsUsed, max: capacity.moduleSlotsMax },
            { label: 'Energy', used: currentEP, max: maxEP, tone: 'ap' },
          ]}
        />
      </SheetPickerModal>

      {/* Advisory confirm — only mounts when a build edit tripped a rule. */}
      <SoftWarningDialog
        open={warningSubtitle !== null}
        warnings={softWarnings.warnings}
        subtitle={warningSubtitle ?? undefined}
        onCancel={() => {
          softWarnings.fixIt()
          setWarningSubtitle(null)
        }}
        onSaveAnyway={() => {
          void softWarnings.saveAnyway()
          setWarningSubtitle(null)
        }}
      />
    </section>
  )
}
