/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * Two columns, as board 10 prints the pilot sheet (issue 1255); one below the
 * container's 5xl, in this reading order:
 *   - wide: the Identity card (typeset in Read, fields in Edit), then
 *     Abilities — the Generic tree, then the pilot's own, as entity cards with
 *     Spend AP (fixed costs only) and a used/recharge toggle in a row under
 *     the body in Edit;
 *   - narrow: the Vitals card (HP/AP gauges, TP and Conditions), Inventory
 *     (shortform pills and free-slot boxes in Read; in Edit each pill with its
 *     controls in a row under it) and Linked Units (one line each in Read).
 * Ability-granted partners run full width under both columns.
 *
 * Read | Edit (`sheetMode.ts`) reaches here as `readOnly`: Read withdraws every
 * write affordance exactly as a sheet the viewer cannot write does.
 *
 * Section containers follow the card-vs-slab rule (see `SheetSectionSlab`):
 * a section of inputs/gauges is a CARD (here, the identity band), a section of
 * entity cards is a SLAB (Abilities, Inventory, Linked Units) — cards already
 * carry their own frame, so a second frame around them reads as one opaque
 * block.
 *
 * Dropped (the poster redesign — no poster counterpart; tracking issues filed for
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
 *     ledgers, the ability cards, inventory capacity, the linked crawler).
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
  Conditions,
  EmptyState,
  EntitySearcher,
  MasonryColumns,
  Panel,
  SheetSectionCard,
  SheetSectionSlab,
  Stat,
  tokens,
  VitalGauge,
} from 'component-lib'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { SURefAbility } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { pinFor } from 'salvageunion-reference/rules'
import type { Pilot } from '../../lib/schemas/pilot'
import { useEntityStore } from '../../stores/entityStore'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { ConditionsEditor } from './ConditionsEditor'
import { EntityGridRow } from './EntityGrid'
import { PartnerCard } from './PartnerCard'
import { PilotIdentityPanel } from './PilotIdentity'
import {
  GenericEntryAdder,
  GenericEntryCard,
  PilotAbilityItem,
  PilotEquipmentItem,
} from './PilotSheetItems'
import { usePilotSheetActions } from './pilotSheetActions'
import { usePilotSheetModel } from './pilotSheetModel'
import { SectionManageButton, SheetPickerModal } from './SheetSection'

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

/**
 * TP in the read state (board 10): a typeset row, the same anatomy as the HP
 * and AP rows above it — stamp, label, then the value at the right. No
 * stepper; Edit gives the stepper box back (`TpBlock`).
 */
function TpReadRow({ value }: { value: number }) {
  return (
    <div role="img" aria-label={`Training Points ${value}`} className="flex items-baseline gap-2">
      <Badge shape="stamp" size="full">
        TP
      </Badge>
      <span className="font-cond text-badge font-bold uppercase leading-none tracking-caps text-wk-muted">
        Training Points
      </span>
      <b className="ml-auto font-cond text-display-lg font-bold leading-none tabular-nums text-ink">
        {value}
      </b>
    </div>
  )
}

/** A free inventory slot in the read state: an empty dashed box (board 10). */
const FREE_SLOT = {
  borderColor: tokens.color.ink40,
  borderRadius: tokens.radius.badge,
  borderStyle: 'dashed',
  borderWidth: tokens.borderWidth.hairline,
  display: 'inline-block',
  height: '30px',
  width: '64px',
} satisfies CSSProperties

/** No more boxes than fit a line or two of the narrow column. */
const FREE_SLOT_BOXES = 8

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
   * The viewer may not write the linked crawler: a player in a Game, whose
   * crawler the Mediator keeps (ADR-038 §5). Closes the partners' Stow and Load.
   */
  crawlerReadOnly?: boolean
  /**
   * The Linked Units rail content (mech + crawler rail row/RailEmpty), built
   * by SheetPilot from `composition` — PilotSheet has no composition access
   * of its own, so this is passed straight through into the R3 section.
   */
  linkedUnits?: ReactNode
}

export function PilotSheet({
  pilot,
  store = useEntityStore,
  readOnly = false,
  crawlerReadOnly = false,
  linkedUnits,
}: PilotSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the SheetSectionCard header (Phase 2).
  const [picker, setPicker] = useState<'abilities' | 'equipment' | null>(null)

  const model = usePilotSheetModel({ pilot, storeState, picker })
  const actions = usePilotSheetActions({
    pilot,
    store,
    storeState,
    crawlerTechLevel: model.effectiveCrawlerLevel,
  })

  const { hpParts, apParts, maxHP, maxAP, hp, ap, tp } = model

  /** One learned ability card — identical wherever its tree puts it. */
  function renderAbility({ slug, ability }: { slug: string; ability: SURefAbility }) {
    return (
      <PilotAbilityItem
        ability={ability}
        currentAP={ap}
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
      // width, not the viewport.
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

      {/* The printed pilot sheet (board 10): identity and abilities down the
          wide column; vitals, inventory and linked units down the narrow one.
          One column below the container's 5xl, in that reading order. */}
      <div className="grid grid-cols-1 items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-6">
          <SheetSectionCard
            title="Identity"
            surface={readOnly ? 'paper' : 'frame'}
            count={
              model.dead ? (
                <Badge surface="tone" tone="bad">
                  Dead
                </Badge>
              ) : undefined
            }
          >
            <PilotIdentityPanel
              pilot={pilot}
              onToggleUsed={readOnly ? undefined : actions.toggleUsed}
              patch={readOnly ? undefined : actions.patchPilot}
            />
          </SheetSectionCard>
          {/* ===== Abilities — the Generic tree, then the ones this pilot owns =====
              A SLAB, not a card: the grid is entity cards, which carry their own
              frame. */}
          <SheetSectionSlab
            title="Abilities"
            // The rule's caption names the trees the cards come from (board 10).
            count={model.abilityTreeCaption ?? undefined}
            controls={
              readOnly ? undefined : (
                <SectionManageButton label="abilities" onClick={() => setPicker('abilities')} />
              )
            }
          >
            {model.abilityCards.length === 0 && model.unresolvedAbilities.length === 0 ? (
              <EmptyState variant="quiet" body="No abilities learned yet." />
            ) : (
              <div className="flex flex-col gap-5">
                {/* The Generic tree every pilot has, then what this pilot owns,
                    each a full medium card so the action and range line and the
                    body read in Read. */}
                {model.abilityCards.length > 0 && (
                  <MasonryColumns maxColumns={3}>
                    {model.abilityCards.map((entry) => (
                      <EntityGridRow key={entry.slug}>{renderAbility(entry)}</EntityGridRow>
                    ))}
                  </MasonryColumns>
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
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <SheetSectionCard title="Vitals" surface={readOnly ? 'paper' : 'frame'}>
            <div className="flex w-full flex-col [&>*+*]:mt-[14px] [&>*+*]:border-t [&>*+*]:border-dashed [&>*+*]:border-[color-mix(in_srgb,var(--tone-deep)_40%,transparent)] [&>*+*]:pt-[14px]">
              <VitalGauge
                label="HP"
                value={hp}
                max={maxHP}
                onChange={readOnly ? undefined : (v) => actions.patchPilot({ currentHP: v })}
                onMaxChange={
                  readOnly
                    ? undefined
                    : (next) => actions.overridePilotMax({ maxHpOverride: pinFor(next, hpParts) })
                }
                breakdown={readOnly ? undefined : hpParts}
                subLabel={readOnly ? 'Hit Points' : undefined}
                provenance={readOnly ? undefined : model.hpLines}
                onRevertOverride={
                  readOnly
                    ? undefined
                    : () => actions.overridePilotMax({ maxHpOverride: undefined })
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
                    : (next) => actions.overridePilotMax({ maxApOverride: pinFor(next, apParts) })
                }
                breakdown={readOnly ? undefined : apParts}
                subLabel={readOnly ? 'Ability Points' : undefined}
                provenance={readOnly ? undefined : model.apLines}
                onRevertOverride={
                  readOnly
                    ? undefined
                    : () => actions.overridePilotMax({ maxApOverride: undefined })
                }
                readOnly={readOnly}
              />
              {readOnly ? (
                <>
                  <TpReadRow value={tp} />
                  {/* Read leaves an empty field out: Conditions prints only
                      when there is one to read. */}
                  {pilot.conditions.length > 0 && (
                    <div className="min-w-0">
                      <span
                        className="mb-2 block font-cond text-badge font-bold uppercase leading-none tracking-caps"
                        style={{ color: 'var(--tone-deep, var(--color-ink))' }}
                      >
                        Conditions
                      </span>
                      <Conditions conditions={[...pilot.conditions]} />
                    </div>
                  )}
                </>
              ) : (
                // TP and Conditions SHARE a row. Stacked, the vitals column ran
                // well past the identity card beside it; TP is a single narrow
                // plate and Conditions is a short chip list, so neither needs a
                // full row of its own and pairing them squares the two cards up.
                <div className="flex w-full min-w-0 items-start gap-3">
                  <TpBlock
                    value={tp}
                    onChange={(v) => actions.patchPilot({ trainingPoints: v })}
                    editable
                  />
                  <div className="min-w-0 flex-1">
                    <span
                      className="mb-2 block font-cond text-badge font-bold uppercase leading-none tracking-caps"
                      style={{ color: 'var(--tone-deep, var(--color-ink))' }}
                    >
                      Conditions
                    </span>
                    <ConditionsEditor
                      conditions={pilot.conditions}
                      onChange={actions.handleConditionsChange}
                      readOnly={false}
                    />
                  </div>
                </div>
              )}
            </div>
          </SheetSectionCard>
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
            ) : readOnly ? (
              // Read (board 10): the shortform pills, then a dashed box per
              // slot still free, so capacity reads at a glance.
              <div className="flex flex-wrap gap-2">
                {model.ordinaryEquipment.map((slug) => (
                  <PilotEquipmentItem
                    key={slug}
                    slug={slug}
                    pilotId={pilot.id}
                    seedSelections={pilot.equipmentChoices?.[slug]}
                    condition={pilot.equipmentConditions?.[slug] ?? 'intact'}
                    usesLeft={pilot.equipmentUses?.[slug]}
                    onConditionChange={() => undefined}
                    onUsesChange={() => undefined}
                    readOnly
                    scalingParent={model.scalingParent}
                    store={store}
                  />
                ))}
                {model.genericInventory.map((entry) => (
                  <GenericEntryCard key={entry.id} entry={entry} />
                ))}
                {Array.from(
                  {
                    length: Math.min(
                      FREE_SLOT_BOXES,
                      Math.max(0, model.slotsCap - model.slotsUsed)
                    ),
                  },
                  (_, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: identical empty boxes; position is the only identity
                    <span key={index} aria-hidden="true" style={FREE_SLOT} />
                  )
                )}
              </div>
            ) : (
              // Edit: one item to a row, each its pill with the controls under
              // it — the narrow column has no room for two cards side by side.
              <div className="flex flex-col gap-4">
                {model.ordinaryEquipment.map((slug) => (
                  <PilotEquipmentItem
                    key={slug}
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
                ))}
                {model.genericInventory.map((entry, index) => (
                  <GenericEntryCard
                    key={entry.id}
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

          {/* ===== Linked Units — the assigned mech and the home crawler =====
              One line each in Read (board 10); full rows with Assign in Edit. */}
          {linkedUnits && (
            <SheetSectionSlab
              id="linked-units"
              title="Linked Units"
              bodyClassName="flex flex-col gap-4"
            >
              {linkedUnits}
            </SheetSectionSlab>
          )}
        </div>
      </div>

      {/* Ability-granted PARTNERS — full width, under both columns. Each
          carries a nested loadout and a cargo hold, so the narrow column would
          crush it, and a partner acts on its own turn rather than being one item
          among the pilot's carried gear. */}
      {model.partners.length > 0 && (
        <SheetSectionSlab title="Partners" count={model.partners.length}>
          <div className="flex flex-col gap-3">
            {model.partners.map((partner) => (
              <PartnerCard
                key={partner.id}
                found={{ partner, hostKind: 'pilot', host: pilot }}
                crawler={model.linkedCrawler}
                crawlerTechLevel={model.effectiveCrawlerLevel}
                hostAbilityRefs={pilot.abilities}
                fielded={model.fieldedByRef[partner.hostRef] ?? 1}
                readOnly={readOnly}
                crawlerReadOnly={crawlerReadOnly}
                store={store}
              />
            ))}
          </div>
        </SheetSectionSlab>
      )}

      {/* The ONE shared picker modal — abilities & equipment '+ Add' both open
          it (multi-select grids write through on toggle; no Save button). */}
      <SheetPickerModal
        open={picker === 'abilities'}
        onClose={() => setPicker(null)}
        title="Add Abilities"
        floating
      >
        <EntitySearcher
          schema="abilities"
          selected={pilot.abilities}
          onToggle={actions.toggleAbility}
          idOf={(item) => nameToSlug(item.name)}
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
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={actions.toggleEquipment}
          idOf={(item) => nameToSlug(item.name)}
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
