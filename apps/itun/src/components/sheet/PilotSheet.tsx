/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * The body OWNS the identity band: it renders `SheetHero` in band mode as its
 * first region, which keeps the identity + vitals rendering (and all their
 * handlers) in one component. Region order mirrors the printed pilot sheet:
 *   - Identity Band: edge wordmark ∥ identity fields ∥ HP/AP/TP + Conditions
 *     vitals rail (one toned frame — the printed top band).
 *   - Abilities (full width, 3-column card grid) — entity cards with Spend AP
 *     (fixed costs only) and a used/recharge toggle in the card foot.
 *   - Inventory (full-width band) — equipment cards + generic entries.
 *   - Linked Units — the assigned-mech / home-crawler rail.
 *
 * Section containers follow the card-vs-slab rule (see `SheetSectionSlab`):
 * a section of inputs/gauges is a CARD (here, the identity band), a section of
 * entity cards is a SLAB (Abilities, Inventory, Linked Units) — cards already
 * carry their own frame, so a second frame around them reads as one opaque
 * block.
 *
 * Dropped (redesign D6 — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - `PilotTakeDamageControl` (#406) — Take Damage / Critical Injury loop.
 *   - the Injuries slab + `InjuryRow` (#408) — severity-enum list editor.
 *   - the Bio `SheetDescription` section (#409) — folded into the Identity
 *     card instead as an extra field (see `PilotIdentityPanel`'s Bio field).
 *   - the Crawler Level slab (#410) — `resolveEffectiveCrawlerLevel` is
 *     PRESERVED (in `pilotSheetModel`, still scaling the Modification-style
 *     choice caps); only the manual-fallback editor UI is dropped.
 * The always-live Vitals gauges and per-card activation (Spend AP, Use /
 * Restock, condition cycling) are KEPT — only the play-control PANELS drop.
 *
 * ## What lives where
 *
 * This file is now the RENDER, and only the render. The two jobs that used to
 * share it are its siblings:
 *   - `pilotSheetModel.ts` — everything derived (vitals maxima, provenance
 *     ledgers, ability grouping, inventory capacity, the linked crawler).
 *   - `pilotSheetActions.ts` — every write, all of them through one `write()`
 *     that reads the freshest record and handles the offline refusal.
 * Local UI state (which picker is open) stays here, because it is render state.
 *
 * All handlers read the freshest record from the store (never the render-time
 * prop) so rapid sequential edits don't stomp each other. readOnly suppresses
 * every edit affordance (published snapshots).
 */

import {
  Badge,
  ConditionsEditor,
  EmptyState,
  EntityGridRow,
  EntitySearcher,
  MasonryColumns,
  Panel,
  SectionManageButton,
  SheetHero,
  SheetPickerModal,
  SheetSectionSlab,
  Slab,
  Stat,
  VitalGauge,
} from 'component-lib'
import type { ReactNode } from 'react'
import { useState } from 'react'
import type { SURefAbility } from 'salvageunion-reference'
import { pilotMaxAP } from '../../lib/rules/derivedStats'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { PartnerCard } from './PartnerCard'
import { PilotIdentityPanel } from './PilotIdentity'
import {
  GenericEntryAdder,
  GenericEntryCard,
  PilotAbilityItem,
  PilotEquipmentItem,
} from './PilotSheetItems'
import { pinOrUndef, usePilotSheetActions } from './pilotSheetActions'
import { GENERIC_TREE, usePilotSheetModel } from './pilotSheetModel'

// ---------------------------------------------------------------------------
// TpBlock — pilot Training Points, in the Vitals card's dashed-topped `.vrow`
// beside Conditions.
//
// This was a hand-assembled `.tpblock` (stamp / 30px numeral / caption / a
// bespoke StepButton pair) arguing the poster's framed TP readout was its own
// thing. It is not: it is the canonical value box at its headline rung —
// `Stat` `size="full"` is stamp / 26px numeral / bottom stamp with the +/-
// stepper column, which is the same anatomy the HP and AP gauges above it
// already use. `ariaLabel` keeps the unbounded-counter accessible contract
// (role="group" named "Training Points {value}", with Increase/Decrease
// Training Points steppers — the visible label is split across the two lines).
// ---------------------------------------------------------------------------

function TpBlock({
  value,
  onChange,
  editable,
}: {
  value: number
  onChange?: (next: number) => void
  editable: boolean
}) {
  return (
    <Stat
      label="Training"
      value={value}
      bottomLabel="Points"
      size="full"
      ariaLabel={`Training Points ${value}`}
      // Without this the steppers would read "Increase Training" — the label is
      // now only the first half of the two-line readout.
      stepperLabel="Training Points"
      mode={editable ? 'edit' : 'read'}
      onChange={editable ? onChange : undefined}
    />
  )
}

// ---------------------------------------------------------------------------
// PilotSheet
// ---------------------------------------------------------------------------

type PilotSheetProps = {
  pilot: Pilot
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand/IndexedDB side effects.
   */
  store?: typeof useEntityStore
  /** When true, every edit affordance is suppressed (published snapshots). */
  readOnly?: boolean
  /**
   * The Linked Units rail content (mech + crawler RailChip/RailEmpty), built
   * by SheetPilot from `composition` — PilotSheet has no composition access
   * of its own, so this is passed straight through into the R3 section.
   */
  linkedUnits?: ReactNode
}

export function PilotSheet({
  pilot,
  store = useEntityStore,
  readOnly = false,
  linkedUnits,
}: PilotSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the SheetSectionCard header (Phase 2).
  const [picker, setPicker] = useState<'abilities' | 'equipment' | null>(null)

  const model = usePilotSheetModel({ pilot, storeState, picker })
  const actions = usePilotSheetActions({ pilot, store, storeState })

  const { hpParts, apParts, maxHP, maxAP, hp, ap, tp } = model

  /** One learned ability card — identical wherever its tree puts it. */
  function renderAbility({ slug, ability }: { slug: string; ability: SURefAbility }) {
    return (
      <PilotAbilityItem
        ability={ability}
        currentAP={pilot.currentAP ?? pilotMaxAP(pilot)}
        used={pilot.usedAbilities?.includes(slug) ?? false}
        onSpend={(cost) => {
          void actions.handleSpendAP(cost)
        }}
        onToggleUsed={(next) => {
          void actions.handleAbilityUsedChange(slug, next)
        }}
        readOnly={readOnly}
      />
    )
  }

  return (
    <section
      aria-label={`${pilot.name} pilot details`}
      // `.sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width (redesign D7), not the viewport.
      className="sheet-section @container flex flex-col gap-6"
    >
      {/* Dead state (rules A2: max HP 0 = death). Display-only — the record
          stays editable so an erroneous injury can be removed. */}
      {model.dead && (
        <div
          role="alert"
          className="rounded-card border-entity border-status-bad bg-paper px-4 py-3"
        >
          <p className="m-0 font-cond text-lg font-bold uppercase tracking-caps text-status-bad">
            Killed in Action
          </p>
          <p className="m-0 font-body text-sm text-ink">
            Injuries have reduced this pilot&rsquo;s maximum HP to 0. Remove an injury below if this
            was a bookkeeping error — otherwise, raise a glass.
          </p>
        </div>
      )}

      {/* ===== Identity Band (Workshop-Manual pilot sheet top region) =====
          Edge wordmark ∥ identity fields ∥ HP/AP/TP + Conditions vitals rail,
          in one toned frame — the printed pilot sheet's top band. */}
      <SheetHero
        cat="Pilot"
        name={pilot.name}
        meta={
          model.dead ? (
            <Badge surface="tone" tone="bad">
              Dead
            </Badge>
          ) : undefined
        }
        fields={
          <PilotIdentityPanel
            pilot={pilot}
            onToggleUsed={readOnly ? undefined : actions.toggleUsed}
            patch={readOnly ? undefined : actions.patchPilot}
          />
        }
        vitals={
          <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
            <VitalGauge
              label="HP"
              value={hp}
              max={maxHP}
              onChange={readOnly ? undefined : (v) => actions.patchPilot({ currentHP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) =>
                      actions.overridePilotMax({
                        maxHpOverride: pinOrUndef(next, hpParts.derived),
                      })
              }
              overriddenFrom={readOnly || !hpParts.overridden ? undefined : hpParts.derived}
              provenance={model.hpLines}
              onRevertOverride={
                readOnly ? undefined : () => actions.overridePilotMax({ maxHpOverride: undefined })
              }
              readOnly={readOnly}
            />
            <VitalGauge
              label="AP"
              value={ap}
              max={maxAP}
              onChange={readOnly ? undefined : (v) => actions.patchPilot({ currentAP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) =>
                      actions.overridePilotMax({
                        maxApOverride: pinOrUndef(next, apParts.derived),
                      })
              }
              overriddenFrom={readOnly || !apParts.overridden ? undefined : apParts.derived}
              provenance={model.apLines}
              onRevertOverride={
                readOnly ? undefined : () => actions.overridePilotMax({ maxApOverride: undefined })
              }
              readOnly={readOnly}
            />
            {/* TP and Conditions SHARE a row. Stacked, the vitals column ran
                well past the identity card beside it; TP is a single narrow
                plate and Conditions is a short chip list, so neither needs a
                full row of its own and pairing them squares the two cards up. */}
            <div className="flex w-full min-w-0 items-start gap-3">
              <TpBlock
                value={tp}
                onChange={readOnly ? undefined : (v) => actions.patchPilot({ trainingPoints: v })}
                editable={!readOnly}
              />
              <div className="min-w-0 flex-1">
                <span
                  className="mb-2 block font-cond text-label font-bold uppercase leading-none tracking-caps"
                  style={{ color: 'var(--tone-deep, var(--color-ink))' }}
                >
                  Conditions
                </span>
                <ConditionsEditor
                  conditions={pilot.conditions}
                  onChange={actions.handleConditionsChange}
                  readOnly={readOnly}
                />
              </div>
            </div>
          </div>
        }
      />

      {/* ===== Abilities — one sub-slab per ABILITY TREE =====
          A SLAB, not a card: the grid is entity cards, which carry their own
          frame. Inside it the abilities group by tree, because a pilot's
          abilities ARE a set of trees and a flat grid lost that: GENERIC (the
          eight every pilot can take) reads as a full-width row of its own, then
          each class tree takes a single column, three trees to a row. The
          per-tree leader is the DASHED `Slab`, subordinate to the section's own
          solid stamp. */}
      <SheetSectionSlab
        title="Abilities"
        count={`${pilot.abilities.length} known`}
        controls={
          readOnly ? undefined : (
            <SectionManageButton label="abilities" onClick={() => setPicker('abilities')} />
          )
        }
      >
        {pilot.abilities.length === 0 && model.genericAbilities.length === 0 ? (
          <EmptyState variant="quiet" body="No abilities learned yet." />
        ) : (
          <div className="flex flex-col gap-5">
            {model.genericAbilities.length > 0 && (
              <div>
                {/* No count: the class trees show how many you have TAKEN,
                    which is a number worth reading. Generic is intrinsic and
                    fixed, so a tally beside it is noise. */}
                <Slab label={GENERIC_TREE} />
                <MasonryColumns maxColumns={3}>
                  {model.genericAbilities.map((entry) => (
                    <EntityGridRow key={entry.slug}>{renderAbility(entry)}</EntityGridRow>
                  ))}
                </MasonryColumns>
              </div>
            )}

            {model.abilityGroups.trees.length > 0 && (
              // One COLUMN per tree, three to a row — a tree's abilities stack
              // under their own leader instead of being interleaved with
              // another tree's by a masonry flow.
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                {model.abilityGroups.trees.map(([tree, entries]) => (
                  <div key={tree} className="min-w-0">
                    <Slab label={tree} count={entries.length} />
                    <div className="flex flex-col gap-4">
                      {entries.map((entry) => (
                        <div key={entry.slug} className="min-w-0">
                          {renderAbility(entry)}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {model.unresolvedAbilities.length > 0 && (
              <div className="flex flex-col gap-2">
                {model.unresolvedAbilities.map((slug) => (
                  <Panel key={slug} className="px-3 py-2.5 font-body text-sm text-wk-muted">
                    {slug}
                  </Panel>
                ))}
              </div>
            )}
          </div>
        )}
      </SheetSectionSlab>

      {/* ===== Inventory (full-width band, printed pilot sheet bottom) ===== */}
      <SheetSectionSlab
        title="Inventory"
        count={
          <span className={model.overCapacity ? 'text-status-bad' : undefined}>
            {model.slotsUsed} / {model.slotsCap} slots
          </span>
        }
        controls={
          readOnly ? undefined : (
            <SectionManageButton label="equipment" onClick={() => setPicker('equipment')} />
          )
        }
      >
        {pilot.equipment.length === 0 && model.genericInventory.length === 0 ? (
          <EmptyState variant="quiet" body="Nothing carried." />
        ) : (
          <MasonryColumns maxColumns={2}>
            {model.ordinaryEquipment.map((slug) => (
              <EntityGridRow key={slug}>
                <PilotEquipmentItem
                  slug={slug}
                  pilotId={pilot.id}
                  seedSelections={pilot.equipmentChoices?.[slug]}
                  condition={pilot.equipmentConditions?.[slug] ?? 'intact'}
                  usesLeft={pilot.equipmentUses?.[slug]}
                  onConditionChange={(itemSlug, next) => {
                    void actions.handleEquipmentConditionChange(itemSlug, next)
                  }}
                  onUsesChange={(itemSlug, next) => {
                    void actions.handleUsesChange(itemSlug, next)
                  }}
                  onRemove={
                    readOnly
                      ? undefined
                      : () => {
                          actions.toggleEquipment(slug)
                        }
                  }
                  readOnly={readOnly}
                  scalingParent={model.scalingParent}
                  store={store}
                />
              </EntityGridRow>
            ))}
            {model.genericInventory.map((entry, index) => (
              <EntityGridRow key={entry.id}>
                <GenericEntryCard
                  entry={entry}
                  onRemove={
                    readOnly
                      ? undefined
                      : () => {
                          void actions.handleGenericInventoryChange(
                            model.genericInventory.filter((_, i) => i !== index)
                          )
                        }
                  }
                />
              </EntityGridRow>
            ))}
          </MasonryColumns>
        )}
        {/* Ability-granted PARTNERS — full width, deliberately outside the
            masonry above. Each carries a nested loadout and a cargo hold, so a
            column would crush it, and a partner acts on its own turn rather
            than being one item among the pilot's carried gear. */}
        {model.partners.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {model.partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                found={{ partner, hostKind: 'pilot', host: pilot }}
                crawler={model.linkedCrawler}
                crawlerTechLevel={model.effectiveCrawlerLevel}
                hostAbilityRefs={pilot.abilities}
                fielded={model.fieldedByRef[partner.hostRef] ?? 1}
                readOnly={readOnly}
                store={store}
                onRemove={
                  readOnly
                    ? undefined
                    : () => {
                        actions.removePartner(partner.id)
                      }
                }
              />
            ))}
          </div>
        )}
        {!readOnly && (
          <div className="mt-3">
            <GenericEntryAdder
              onAdd={(entry) => {
                void actions.handleGenericInventoryChange([...model.genericInventory, entry])
              }}
            />
          </div>
        )}
      </SheetSectionSlab>

      {/* ===== R4: Linked Units (full width, stacked beneath all other sections) =====
          Already a bare slab leader + rail stack in the poster; now expressed
          through the shared slab container like every other card section. */}
      <SheetSectionSlab
        id="linked-units"
        title="Linked Units"
        // Side by side: each linked unit is one roster row, and two of them stack
        // to a wasteful column on a sheet that has the width for both.
        bodyClassName="flex flex-col gap-4 @3xl:flex-row"
      >
        {linkedUnits}
      </SheetSectionSlab>

      {/* The ONE shared picker modal — abilities & equipment '+ Add' both open
          it (multi-select grids write through on toggle; no Save button). */}
      <SheetPickerModal
        open={picker === 'abilities'}
        onClose={() => setPicker(null)}
        title="Add Abilities"
        maxWidth="max-w-5xl"
        floating
      >
        <EntitySearcher
          schema="abilities"
          selected={pilot.abilities}
          onToggle={actions.toggleAbility}
          idOf={(item) => item.id}
          filter={
            model.abilityTrees
              ? (item) => model.abilityTrees?.has((item as SURefAbility).tree) ?? false
              : undefined
          }
          facets={{
            category: { label: 'Tree', of: (item) => (item as SURefAbility).tree },
          }}
          railName={pilot.name}
          chosenLabel="Learned"
          emptyMessage="No abilities match those filters."
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title="Add Equipment"
        maxWidth="max-w-5xl"
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={actions.toggleEquipment}
          idOf={(item) => item.id}
          railName={pilot.name}
          chosenLabel="Equipped"
          emptyMessage="No equipment matches those filters."
          budget={{ label: 'Inventory slots', used: model.slotsUsed, max: model.slotsCap }}
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
