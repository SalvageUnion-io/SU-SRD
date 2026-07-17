/**
 * MechSheet — the mech variant BODY for the LiveSheet shell (design §4.3,
 * plan 4.5; redesigned to the poster layout, Phase 2).
 *
 * Identity/Vitals moved OUT of the hero (SheetMech.tsx now carries only the
 * name row + meta) and into this body's poster region grid — a 12-col
 * `@container` grid mirroring PilotSheet's Phase 2 shape:
 *
 *   R1: Identity (span 7, the pattern-name/chassis fields + the 8-lozenge
 *       chassis-stats strip) ∥ Vitals (span 5, SP/EP/Heat `VitalGauge`s +
 *       Conditions).
 *   R2: Chassis Ability (span 7, the chassis's ability actions as Erow'd
 *       cards with a Use action that spends EP; blocked while shut down) ∥
 *       Quirk & Appearance (span 5, ONE combined field section as a 2-row
 *       dt/dd list — the poster has no separate Quirk/Appearance cards).
 *   R3: Systems & Modules — KEPT as the existing two-section split (each its
 *       own `SheetSectionCard`) rather than unified into one grid: Systems
 *       and Modules are different collections with different '+ Add'
 *       pickers/slot budgets, so folding them into one card/grid is not a
 *       trivial change (see plan Phase 2 item 2's "unify-vs-split" note).
 *   R4: Linked Units (span 5, a bare `.sect` header + rail stack — no card
 *       frame, matching PilotSheet's Linked Units) ∥ The Hold (span 7,
 *       `StorageManifest side='mech'` unchanged, now framed in a
 *       `SheetSectionCard`).
 *
 * Every collection/field section is framed by `SheetSectionCard` (the poster
 * `.dcard`) except Linked Units.
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
import type { ReactNode } from 'react'
import { SalvageUnionReference, nameToSlug } from 'salvageunion-reference'
import { Stat, VitalGauge, heatDangerFrom } from 'component-lib'

import { useCargo } from '../../lib/cargo/useCargo'
import { computeMechCapacity } from '../../lib/rules/capacity'
import { mechMaxEP, mechMaxHeat, mechMaxSP } from '../../lib/rules/derivedStats'
import { addToScrapPool } from '../../lib/cargo/cargoTransfer'
import type { Crawler } from '../../lib/schemas/crawler'
import type { ItemCondition, Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { EntitySearcher } from '../shared/EntitySearcher'
import { ActionCardErow } from './ActionCardErow'
import { destroyedUndoToast } from './destroyedUndoToast'
import { Ecflow, Erow } from './Erow'
import { InlineEditTextArea } from './InlineEditTextArea'
import { MechConditionsEditor } from './MechConditionsEditor'
import { MechIdentityPanel } from './MechIdentity'
import { MechItemCard } from './MechItemCard'
import { cycleCondition, resolveModule, resolveSystem } from './mechItemRules'
import { SectionAddButton, SectionChead, SectionEditButton, SheetPickerModal } from './SheetSection'
import { SheetSectionCard } from './SheetSectionCard'
import type { ChassisStatItem } from './SheetHero'
import { ChassisStats } from './SheetHero'
import { StorageManifest } from './StorageManifest'
import { resolveChassisRef } from '../../lib/rules/resolveRefs'
import { AdvisoryText, freshEntity } from './controlPrimitives'
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
  // Tech Level, Salvage Value — number-only lozenges (`pips: false`), a
  // bounded 4-col grid rather than a free-wrapped strip.
  const specs: ChassisStatItem[] = [
    { code: 'SP', name: 'Structure Pts', value: maxSP, pips: false },
    { code: 'EP', name: 'Energy Pts', value: maxEP, pips: false },
    { code: 'HEAT', name: 'Heat Cap', value: heatCap, pips: false },
    {
      code: 'SYS',
      name: 'System Slots',
      value: capacity.systemSlotsUsed,
      max: capacity.systemSlotsMax,
      pips: false,
    },
    {
      code: 'MOD',
      name: 'Module Slots',
      value: capacity.moduleSlotsUsed,
      max: capacity.moduleSlotsMax,
      pips: false,
    },
    {
      code: 'CARGO',
      name: 'Cargo Cap',
      value: cargo.usage.used,
      max: cargo.usage.cap,
      pips: false,
    },
    ...(techLevel !== undefined
      ? [{ code: 'TL', name: 'Tech Level', value: techLevel, pips: false }]
      : []),
    ...(typeof chassisEntity?.salvageValue === 'number'
      ? [{ code: 'SV', name: 'Salvage Value', value: chassisEntity.salvageValue, pips: false }]
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
            <InlineEditTextArea
              value={text}
              ariaLabel={`Edit ${label.toLowerCase()}`}
              onSave={async (next) => onSave(next)}
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
      <Ecflow>
        {slugs.map((slug, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same system/module slug may be installed more than once, so the slug alone is not unique; install order is stable
          <Erow key={`${slug}-${index}`}>
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
          </Erow>
        ))}
      </Ecflow>
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
        <AdvisoryText>
          Unknown chassis &ldquo;{mech.chassisRef}&rdquo; — using stored/zero defaults
        </AdvisoryText>
      )}

      {/* ===== R1: Identity ∥ Vitals (poster top band) ===== */}
      <div className="grid grid-cols-1 gap-[22px] @5xl:grid-cols-12 @5xl:gap-6">
        <div className="@5xl:col-span-7">
          <SheetSectionCard
            title="Identity"
            controls={
              !readOnly ? (
                <SectionEditButton
                  section="Identity"
                  editing={identityEditing}
                  onToggle={() => setIdentityEditing((v) => !v)}
                />
              ) : undefined
            }
          >
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
          </SheetSectionCard>
        </div>

        <div className="@5xl:col-span-5">
          <SheetSectionCard title="Vitals">
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
                    : (next) =>
                        overrideMechMax({ maxHeatModifier: modOrUndef(next, derivedHeatCap) })
                }
                overriddenFrom={readOnly ? undefined : derivedHeatCap}
                onRevertOverride={
                  readOnly ? undefined : () => overrideMechMax({ maxHeatModifier: undefined })
                }
                readOnly={readOnly}
              />
            </div>
            <div className="mt-4 flex w-full flex-col gap-2 border-t border-dashed border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] pt-[14px]">
              <span
                className="font-cond text-label font-bold uppercase tracking-caps"
                style={{ color: 'var(--tone-deep, var(--color-ink))' }}
              >
                Conditions
              </span>
              <MechConditionsEditor mech={mech} store={store} readOnly={readOnly} />
            </div>
          </SheetSectionCard>
        </div>
      </div>

      {/* ===== R2: Chassis Ability ∥ Quirk & Appearance ===== */}
      <div className="grid grid-cols-1 gap-[22px] @5xl:grid-cols-12 @5xl:gap-6">
        {chassisAbilities.length > 0 && (
          <div className="@5xl:col-span-7">
            <SheetSectionCard
              title="Chassis Ability"
              count={
                <Stat
                  orientation="horizontal"
                  compact
                  label="Actions"
                  value={chassisAbilities.length}
                />
              }
            >
              <Ecflow>
                {chassisAbilities.map((ability) => {
                  // Activating an ability (spending its EP) is a Guided-Play
                  // transaction — it lives on the Dashboard, not the Free-Edit
                  // Live Sheet (ADR-021). The sheet shows the ability + its EP
                  // cost; EP is spent by hand-editing the EP gauge (free state).
                  const epCost =
                    typeof ability.activationCost === 'number' ? ability.activationCost : 0
                  return (
                    <ActionCardErow
                      key={ability.id}
                      ability={ability}
                      footMeta={epCost > 0 ? [{ label: 'EP Cost', value: epCost }] : undefined}
                    />
                  )
                })}
              </Ecflow>
            </SheetSectionCard>
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
          collections/pickers; not a trivial unify), each framed in its own
          SheetSectionCard. ===== */}
      <SheetSectionCard
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
      </SheetSectionCard>

      <SheetSectionCard
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
      </SheetSectionCard>

      {/* ===== R4: Linked Units ∥ The Hold =====
          DOM order is Hold THEN Linked Units — the poster's own mobile stack
          puts `.bcargo` (Hold) before `.blinks` (Linked Units) even though
          both share `grid-row:1` at the desktop breakpoint (`.bcargo{grid-
          column:6/13}` / `.blinks{grid-column:1/6}`, clean-mech.html:547-548)
          — Linked Units reads LAST on mobile. `@5xl:order-*` restores the
          desktop visual (Linked Units left/span5, Hold right/span7) without
          reordering the DOM. */}
      <div className="grid grid-cols-1 gap-[22px] @5xl:grid-cols-12 @5xl:gap-6">
        <div className="@5xl:order-2 @5xl:col-span-7">
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
        </div>

        <div className="@5xl:order-1 @5xl:col-span-5">
          {/* Linked Units — poster renders this as a bare section header + rail
              stack (no `.dcard` frame), matching PilotSheet. */}
          <SectionChead title="Linked Units" />
          <div className="flex flex-col gap-4">{linkedUnits}</div>
        </div>
      </div>

      {/* The ONE shared picker modal — Systems & Modules '+ Add' both open it
          (the wizard's install grid writes through on click; no Save button). */}
      <SheetPickerModal
        open={picker === 'system'}
        onClose={() => setPicker(null)}
        title="Add Systems"
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
    </section>
  )
}
