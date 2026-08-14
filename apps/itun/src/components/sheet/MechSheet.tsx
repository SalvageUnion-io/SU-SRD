/**
 * MechSheet — the mech variant BODY for the LiveSheet shell (design §4.3,
 * plan 4.5; redesigned to the poster layout, Phase 2).
 *
 * The body OWNS the identity band (Workshop-Manual mech sheet): it renders
 * `SheetHero` in band mode as its first region. Region order mirrors the
 * printed mech sheet:
 *
 *   Identity Band: edge wordmark ∥ the pattern-name/chassis fields + the
 *       8-lozenge chassis-stats strip ∥ SP/EP/Heat `VitalGauge`s + Conditions
 *       vitals rail — one toned frame (the printed top band).
 *   Chassis Ability + Quirk & Appearance live INSIDE the identity card: the
 *       chassis's ability is what the chassis IS (always visible, no fold), and
 *       quirk/appearance are two more identity Fields under the same Edit
 *       toggle. Tech Level is NOT a field — it is chassis-derived and reads off
 *       the static-stats strip.
 *   Systems & Modules — KEPT as two sections (each its own `SheetSectionSlab`,
 *       3-column card grids): different collections with different '+ Add'
 *       pickers/slot budgets, so folding them into one grid is not trivial.
 *   The Hold (`StorageManifest side='mech'`) reads BEFORE Systems & Modules —
 *       cargo is reached for mid-session and was buried under two long loadout
 *       lists at the printed sheet's bottom-of-page-2 placement.
 *   Linked Units closes the sheet.
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
 * ## What lives where
 *
 * This file is now the RENDER, and only the render. Its two siblings:
 *   - `mechSheetModel.ts` — the derived model (SP/EP/Heat maxima and their
 *     provenance ledgers, slot capacity, the chassis-stats strip, cargo).
 *   - `mechSheetActions.ts` — every write, all of them through one `write()`
 *     that reads the freshest record and handles the offline refusal.
 *
 * Dep-injectable for tests: `chassis` (stats override), `store` (Zustand
 * stub), `crawler` (linked home crawler — null means no pool/stow target).
 * readOnly suppresses every edit affordance.
 */

import {
  EntityGridRow,
  EntitySearcher,
  Field,
  FieldError,
  heatDangerFrom,
  MasonryColumns,
  ReferenceEntityCard,
  SectionManageButton,
  SheetHero,
  SheetPickerModal,
  SheetSectionSlab,
  VitalGauge,
} from 'component-lib'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { Crawler } from '../../lib/schemas/crawler'
import type { Mech } from '../../lib/schemas/mech'
import { useEntityStore } from '../../stores/entityStore'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { MechConditionsEditor } from './MechConditionsEditor'
import { MechIdentityPanel } from './MechIdentity'
import { MechItemCard } from './MechItemCard'
import { resolveModule, resolveSystem } from './mechItemRules'
import type { ItemKind } from './mechSheetActions'
import { pinOrUndef, useMechSheetActions } from './mechSheetActions'
import type { ChassisLike } from './mechSheetModel'
import { useMechSheetModel } from './mechSheetModel'
import { PartnerCard } from './PartnerCard'
import { StorageManifest } from './StorageManifest'

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
  /**
   * The assigned pilot's ability refs, handed down by SheetMech from
   * `composition`. Beefcake is a PILOT ability that raises the piloted MECH's
   * Max SP and Cargo, so a mech's maxima cannot be derived from the mech alone
   * (ADR-029). Absent = unlinked, which correctly contributes nothing.
   */
  pilotAbilities?: string[]
}

export function MechSheet({
  mech,
  chassis: chassisOverride,
  store = useEntityStore,
  readOnly = false,
  crawler = null,
  linkedUnits,
  pilotAbilities,
}: MechSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  // Identity / Quirk+Appearance are FIELD sections (unified edit language
  // archetype A): their own Edit/Done toggle, rendered in the
  // SheetSectionCard header (Phase 2).
  // Quirk & Appearance now live inside the identity card, so they follow ITS
  // Edit toggle — a second Edit button inside the same frame would have been
  // two switches for one section.
  const [picker, setPicker] = useState<ItemKind | null>(null)

  const model = useMechSheetModel({
    mech,
    chassisOverride,
    store,
    readOnly,
    crawler,
    pilotAbilities,
  })
  const actions = useMechSheetActions({ mech, store, storeState, crawler })

  const { chassis, cargo, capacity, spParts, epParts, heatParts, maxSP, maxEP, heatCap } = model

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
      <MasonryColumns maxColumns={3}>
        {slugs.map((slug, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the same system/module slug may be installed more than once, so the slug alone is not unique; install order is stable
          <EntityGridRow key={`${slug}-${index}`}>
            <MechItemCard
              slug={slug}
              entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
              condition={conditions[slug] ?? 'intact'}
              usesRemaining={mech.itemUses?.[slug]}
              scrapPool={model.scrapPool}
              readOnly={readOnly}
              onStatusCycle={() => {
                void actions.cycleItemCondition(kind, slug)
              }}
              onUsesChange={(next) => {
                void actions.setItemUses(slug, next)
              }}
              onRepair={(deductTl, cost) => {
                void actions.repairItem(kind, slug, deductTl, cost)
              }}
              onRemove={
                readOnly
                  ? undefined
                  : () => {
                      actions.removeItem(kind, index)
                    }
              }
            />
          </EntityGridRow>
        ))}
      </MasonryColumns>
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
          SP/EP/Heat + Conditions vitals rail, in one toned frame. */}
      <SheetHero
        cat="Mech"
        name={mech.name}
        // On a mech this region IS the chassis: its name, its stats, its
        // ability, its quirk. "Identity" named the shape, not the subject.
        fieldsTitle="Chassis"
        fields={
          <div className="flex h-full min-w-0 flex-col gap-4">
            <MechIdentityPanel
              mech={mech}
              chassisName={model.chassisName}
              patch={readOnly ? undefined : actions.patchMech}
              besideChassis={
                <Field
                  label="Quirk"
                  value={mech.quirk ?? ''}
                  onSave={readOnly ? undefined : actions.saveQuirk}
                  placeholder="No quirk recorded."
                />
              }
              after={
                // The chassis's ability, carrying the CHASSIS STATS in its own
                // header: the numbers describe the machine the ability belongs
                // to, so the card that names it is where they read. That folds
                // what were two adjacent blocks (a bare stat strip and a card)
                // into one, full-width under the chassis name.
                //
                // Always visible, never folded — there is nothing to manage or
                // choose here, so a fold would hide the one thing that
                // distinguishes this chassis from another.
                model.chassisAbilities.length > 0 ? (
                  <div className="flex min-w-0 flex-col gap-4">
                    {model.chassisAbilities.map((ability, i) => {
                      // Activating an ability (spending its EP) is a Guided-Play
                      // transaction — it lives on the Dashboard, not the
                      // Free-Edit Live Sheet (ADR-021). EP is spent here by
                      // hand-editing the EP gauge (free state).
                      //
                      // No `footMeta`: the ability's EP cost is the CARD's to
                      // render and it already does, as its own "2 EP" box, so an
                      // "EP Cost 2" pair in the footer was the same number twice
                      // on one card.
                      return (
                        <EntityGridRow key={ability.id}>
                          <ReferenceEntityCard
                            data={ability}
                            size="large"
                            // Only the FIRST ability carries the stats — they
                            // belong to the chassis, not to each ability, and
                            // repeating them down a list would read as though
                            // each ability had its own.
                            statsOverride={
                              i === 0
                                ? model.specs.map((spec) => ({
                                    key: spec.code,
                                    label: spec.code,
                                    value: spec.value,
                                    outOfMax: spec.max,
                                  }))
                                : undefined
                            }
                            // `[(CHASSIS)]` in the ability's text resolves to
                            // the PATTERN name, not the chassis's: on a live
                            // sheet the reader is looking at this machine, and
                            // "Increases the Cargo Capacity of Bad Penny" is
                            // what the sentence is actually about.
                            chassisName={mech.name}
                          />
                        </EntityGridRow>
                      )
                    })}
                  </div>
                ) : undefined
              }
            />

            {/* Appearance closes the card: multi-line and full width, taking
                whatever height the slab has left (the identity slab stretches
                to match the vitals beside it, and that space should go to a
                field the reader can use rather than sitting as dead paper).
                Quirk is one line, so it rides the chassis row above instead. */}
            <Field
              label="Appearance"
              value={mech.appearance ?? mech.description ?? ''}
              multiline
              fill
              onSave={readOnly ? undefined : actions.saveAppearance}
              placeholder="No appearance recorded."
              className="flex-1"
            />
          </div>
        }
        vitals={
          <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
            <VitalGauge
              label="SP"
              subLabel="Structure"
              value={model.currentSP}
              max={maxSP}
              onChange={readOnly ? undefined : (v) => actions.patchMech({ currentSP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) =>
                      actions.overrideMechMax({ maxSpOverride: pinOrUndef(next, spParts.derived) })
              }
              overriddenFrom={readOnly || !spParts.overridden ? undefined : spParts.derived}
              provenance={model.spLines}
              onRevertOverride={
                readOnly ? undefined : () => actions.overrideMechMax({ maxSpOverride: undefined })
              }
              readOnly={readOnly}
            />
            <VitalGauge
              label="EP"
              subLabel="Energy"
              value={model.currentEP}
              max={maxEP}
              onChange={readOnly ? undefined : (v) => actions.patchMech({ currentEP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) =>
                      actions.overrideMechMax({ maxEpOverride: pinOrUndef(next, epParts.derived) })
              }
              overriddenFrom={readOnly || !epParts.overridden ? undefined : epParts.derived}
              provenance={model.epLines}
              onRevertOverride={
                readOnly ? undefined : () => actions.overrideMechMax({ maxEpOverride: undefined })
              }
              readOnly={readOnly}
            />
            <VitalGauge
              label="Heat"
              value={model.currentHeat}
              max={heatCap}
              danger={heatCap > 0 ? heatDangerFrom(heatCap) : undefined}
              onChange={readOnly ? undefined : (v) => actions.patchMech({ currentHeat: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) =>
                      actions.overrideMechMax({
                        maxHeatOverride: pinOrUndef(next, heatParts.derived),
                      })
              }
              overriddenFrom={readOnly || !heatParts.overridden ? undefined : heatParts.derived}
              provenance={model.heatLines}
              onRevertOverride={
                readOnly ? undefined : () => actions.overrideMechMax({ maxHeatOverride: undefined })
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

      {/* ===== The Hold — ABOVE Systems & Modules =====
          Cargo is the thing a crew reaches for mid-session, and the printed
          sheet's bottom-of-page-2 placement buried it under two long loadout
          lists. It reads before them here. */}
      <SheetSectionSlab
        title="The Hold"
        count={
          <span className="tabular-nums">
            {cargo.state.carrierLots.length} {cargo.state.carrierLots.length === 1 ? 'lot' : 'lots'}{' '}
            · {cargo.usage.used}/{cargo.usage.cap} slots
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
      </SheetSectionSlab>

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
            <SectionManageButton label="systems" onClick={() => setPicker('system')} />
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
            <SectionManageButton label="modules" onClick={() => setPicker('module')} />
          )
        }
      >
        {renderItems('module', mech.modules)}
      </SheetSectionSlab>

      {/* ===== Partners — drones this mech's CHASSIS ABILITY fields (Little
          Sestra's Sestra Drone, Big Brother's four). Its own region rather than
          a Linked Units row: a partner is not a linked roster entity, it is part
          of this mech's own kit — and it renders full width because it carries a
          nested loadout and a hold. No crawler tech level is threaded: a
          mech-granted drone is fixed by its stat block and never tracks the
          Union Crawler, unlike a pilot's ability-granted partners. ===== */}
      {(mech.partners ?? []).length > 0 && (
        <SheetSectionSlab title="Partners" count={(mech.partners ?? []).length}>
          <div className="flex flex-col gap-3">
            {(mech.partners ?? []).map((partner) => (
              <PartnerCard
                key={partner.id}
                found={{ partner, hostKind: 'mech', host: mech }}
                fielded={(mech.partners ?? []).filter((p) => p.hostRef === partner.hostRef).length}
                readOnly={readOnly}
                store={store}
              />
            ))}
          </div>
        </SheetSectionSlab>
      )}

      {/* ===== Linked Units — the last region ===== */}
      <SheetSectionSlab
        id="linked-units"
        title="Linked Units"
        // Side by side: each linked unit is one roster row, and two of them stack
        // to a wasteful column on a sheet that has the width for both.
        bodyClassName="flex flex-col gap-4 @3xl:flex-row"
      >
        {linkedUnits}
      </SheetSectionSlab>

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
          onAdd={(name) => actions.addItem('system', name)}
          onRemove={(index) => actions.removeItem('system', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel="Installed"
          emptyMessage="No systems match those filters."
          budget={[
            { label: 'System Slots', used: capacity.systemSlotsUsed, max: capacity.systemSlotsMax },
            { label: 'Energy', used: model.currentEP, max: maxEP, tone: 'ap' },
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
          onAdd={(name) => actions.addItem('module', name)}
          onRemove={(index) => actions.removeItem('module', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel="Installed"
          emptyMessage="No modules match those filters."
          budget={[
            { label: 'Module Slots', used: capacity.moduleSlotsUsed, max: capacity.moduleSlotsMax },
            { label: 'Energy', used: model.currentEP, max: maxEP, tone: 'ap' },
          ]}
        />
      </SheetPickerModal>

      {/* Advisory confirm — only mounts when a build edit tripped a rule. */}
      <SoftWarningDialog
        open={actions.warningSubtitle !== null}
        warnings={actions.warnings}
        subtitle={actions.warningSubtitle ?? undefined}
        onCancel={actions.cancelBuildEdit}
        onSaveAnyway={actions.confirmBuildEdit}
      />
    </section>
  )
}
