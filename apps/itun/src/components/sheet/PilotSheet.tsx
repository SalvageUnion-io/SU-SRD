/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * Two columns, as board 10 prints the pilot sheet; one below the
 * container's 5xl, in this reading order:
 *   - wide: the Identity card (the portrait, else the class's art, beside
 *     fields typeset in Read), then Abilities — Tokens that Peek their card,
 *     the pilot's own class trees first, then the Generic tree — with Spend AP
 *     (fixed costs only) and a used/recharge toggle on each Token's line in
 *     Edit;
 *   - narrow: the Vitals card (HP/AP gauges, TP and Conditions), Inventory
 *     (shortform pills and free-slot boxes in Read; in Edit each pill with its
 *     controls in a row under it) and Assigned Units (one line each in Read).
 * Ability-granted partners run full width under both columns.
 *
 * Read | Edit (`sheetMode.model.ts`) reaches here as `readOnly`: Read withdraws every
 * write affordance exactly as a sheet the viewer cannot write does.
 *
 * Section containers follow the card-vs-slab rule (see `SheetSectionSlab`):
 * a section of inputs/gauges is a CARD (here, the identity band), a section of
 * entity cards is a SLAB (Abilities, Inventory, Assigned Units) — cards already
 * carry their own frame, so a second frame around them reads as one opaque
 * block.
 *
 * Dropped (the poster redesign — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - `PilotTakeDamageControl` — Take Damage / Critical Injury loop.
 *   - the Injuries slab + `InjuryRow` — severity-enum list editor.
 *   - the Bio `SheetDescription` section — folded into the Identity
 *     card instead as an extra field (see `PilotIdentityPanel`'s Bio field).
 *   - the Crawler Level slab — `resolveEffectiveCrawlerLevel` is
 *     PRESERVED (in `pilotSheet.model`, still scaling the Modification-style
 *     choice caps); only the manual-fallback editor UI is dropped.
 * The always-live Vitals gauges and per-card activation (Spend AP, Use /
 * Restock, condition cycling) are KEPT — only the play-control PANELS drop.
 *
 * ## What lives where
 *
 * This file is the RENDER, and only the render. Its siblings hold the rest:
 *   - `pilotSheet.model.ts` — everything derived (vitals maxima, provenance
 *     ledgers, the ability cards, inventory capacity, the linked crawler).
 *   - `pilotSheetActions.model.ts` — every write, all of them through one `write()`
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
  Panel,
  SheetSectionCard,
  SheetSectionSlab,
  SlotGrid,
  Stat,
  tokens,
  VitalGauge,
} from 'component-lib'
import type { Pilot } from 'itun-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { SURefAbility } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { pinFor } from 'salvageunion-reference/rules'
import { classArt } from '../../lib/photos/defaultArt'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { EntityPhoto } from '../shared/EntityPhoto'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { ConditionsEditor } from './ConditionsEditor'
import { PartnerCard } from './PartnerCard'
import { PhotoBeside } from './PhotoBeside'
import { PilotIdentityPanel } from './PilotIdentity'
import {
  GenericEntryAdder,
  GenericEntryCard,
  PilotAbilityItem,
  PilotEquipmentItem,
} from './PilotSheetItems'
import { usePilotSheetModel } from './pilotSheet.model'
import { usePilotSheetActions } from './pilotSheetActions.model'
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

/** A Vitals caps label: the badge rung, set solid. */
const CAPS_LABEL = {
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.badge,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.caps,
  lineHeight: 1,
  textTransform: 'uppercase',
} satisfies CSSProperties

/** The Conditions label over the chip row, in the sheet's deep tone. */
const CONDITIONS_LABEL = {
  ...CAPS_LABEL,
  color: 'var(--tone-deep, var(--color-ink))',
  display: 'block',
  marginBottom: tokens.space[8],
} satisfies CSSProperties

/**
 * TP in the read state (board 10): a counter, not a gauge (ruleset §2.1: no
 * cap, no track), so the label-first `TRAINING POINTS | 2` chip. No stepper;
 * Edit gives the stepper box back (`TpBlock`).
 */
function TpReadRow({ value }: { value: number }) {
  return (
    <div>
      <Stat orientation="horizontal" label="Training Points" value={value} />
    </div>
  )
}

/** The inventory's slots under its pills: the SlotGrid, set to the left. */
const SLOTS = { display: 'flex', marginTop: tokens.space[8] } satisfies CSSProperties

/** The sheet body; `container-type` scopes the region grid to its own width. */
const BODY = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

const DEAD = {
  backgroundColor: tokens.color.paper,
  border: `${tokens.borderWidth.entity} solid ${tokens.color.statusBad}`,
  borderRadius: tokens.radius.card,
  paddingBlock: tokens.space[12],
  paddingInline: tokens.space[16],
} satisfies CSSProperties

const DEAD_TITLE = {
  color: tokens.color.statusBad,
  fontFamily: tokens.font.cond,
  fontSize: tokens.fontSize.lg,
  fontWeight: tokens.weight.bold,
  letterSpacing: tokens.tracking.caps,
  lineHeight: 'calc(1.75 / 1.125)',
  margin: 0,
  textTransform: 'uppercase',
} satisfies CSSProperties

const DEAD_BODY = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  margin: 0,
} satisfies CSSProperties

/** The region grid; its two columns from the container's 5xl are `.su-sheet-pilot-regions`. */
const REGIONS = {
  alignItems: 'start',
  display: 'grid',
  gap: tokens.space[24],
} satisfies CSSProperties

const MIN_W_0 = { minWidth: 0 } satisfies CSSProperties

const STACK_8 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
} satisfies CSSProperties

const STACK_12 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

const STACK_20 = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[20],
} satisfies CSSProperties

/** The Vitals rows; the dashed rule between them is `.su-sheet-pilot-vitals`. */
const VITALS = { display: 'flex', flexDirection: 'column', width: '100%' } satisfies CSSProperties

const TP_AND_CONDITIONS = {
  alignItems: 'flex-start',
  display: 'flex',
  gap: tokens.space[12],
  minWidth: 0,
  width: '100%',
} satisfies CSSProperties

const CONDITIONS_CELL = { flex: '1 1 0%', minWidth: 0 } satisfies CSSProperties

const PILLS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[8] } satisfies CSSProperties

/** The Edit list: one item a line; its gap is `.su-sheet-items`. */
const EDIT_ITEMS = { display: 'flex', flexDirection: 'column' } satisfies CSSProperties

const ADDER_ROW = { marginTop: tokens.space[12] } satisfies CSSProperties

// ---------------------------------------------------------------------------
// PilotSheet
// ---------------------------------------------------------------------------

type PilotSheetProps = {
  pilot: Pilot
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand side effects.
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
   * The Assigned Units rail content (mech + crawler rail row/RailEmpty), built
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
  // Edit/Done toggle, rendered in the SheetSectionCard header.
  const [picker, setPicker] = useState<'abilities' | 'equipment' | null>(null)

  const model = usePilotSheetModel({ pilot, storeState, picker })
  const actions = usePilotSheetActions({
    pilot,
    store,
    storeState,
    crawlerTechLevel: model.effectiveCrawlerLevel,
  })

  const { hpParts, apParts, maxHP, maxAP, hp, ap, tp } = model

  /** One learned ability — identical wherever its tree puts it. */
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
      className="sheet-section"
      style={BODY}
    >
      {/* Dead state (max HP 0 = death). Display-only — the record
          stays editable so an erroneous injury can be removed. */}
      {model.dead && (
        <div role="alert" style={DEAD}>
          <p style={DEAD_TITLE}>Killed in Action</p>
          <p style={DEAD_BODY}>
            Injuries have reduced this pilot&rsquo;s maximum HP to 0. Remove an injury below if this
            was a bookkeeping error — otherwise, raise a glass.
          </p>
        </div>
      )}

      {/* The printed pilot sheet (board 10): identity and abilities down the
          wide column; vitals, inventory and linked units down the narrow one.

          One column below the container's 5xl, and there the vitals come
          straight after the identity: HP, AP and TP are what a player reaches
          for mid-session, and the full ability cards above them pushed them
          thousands of pixels down a phone. Below 5xl both column wrappers are
          `display: contents`, so the five sections are items of the one grid,
          and `order` lifts the vitals above the abilities (identity, vitals,
          abilities, inventory, linked units); from 5xl the columns return and
          every `order` resets. */}
      <div className="su-sheet-pilot-regions" style={REGIONS}>
        <div className="su-sheet-pilot-column">
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
            <PhotoBeside
              photo={
                <EntityPhoto
                  photo={pilot.photo}
                  // With no portrait, the sheet opens on the class's art, as the
                  // book's premades open on theirs.
                  fallback={classArt(pilot.classRef)}
                  name={pilot.callsign || pilot.name}
                  onChange={
                    readOnly
                      ? undefined
                      : (photo) =>
                          useEntityStore
                            .getState()
                            .update('pilot', pilot.id, { photo }, LIVE_SHEET_MANUAL)
                  }
                />
              }
            >
              <PilotIdentityPanel
                pilot={pilot}
                onToggleUsed={readOnly ? undefined : actions.toggleUsed}
                patch={readOnly ? undefined : actions.patchPilot}
              />
            </PhotoBeside>
          </SheetSectionCard>
          {/* ===== Abilities — the ones this pilot owns, then the Generic tree =====
              A SLAB, not a card: the grid is entity cards, which carry their own
              frame. */}
          <div className="su-sheet-pilot-order-1" style={MIN_W_0}>
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
              {model.classAbilities.length === 0 &&
              model.genericAbilities.length === 0 &&
              model.unresolvedAbilities.length === 0 ? (
                <EmptyState variant="quiet" body="No abilities learned yet." />
              ) : (
                <div style={STACK_20}>
                  {/* Every ability a Token that Peeks its card (owner's call,
                    2026-10-14: "all references = peek tokens"): the class's own
                    first, then the Generic tree every pilot has. One column:
                    an ability's chips need the width. Edit gives each line its
                    controls. */}
                  <ul
                    aria-label="Abilities"
                    className={
                      readOnly ? 'su-entity-token-list' : 'su-entity-token-list su-sheet-items'
                    }
                  >
                    {[...model.classAbilities, ...model.genericAbilities].map((entry) => (
                      <li key={entry.slug}>{renderAbility(entry)}</li>
                    ))}
                  </ul>

                  {model.unresolvedAbilities.length > 0 && (
                    <div style={STACK_8}>
                      {model.unresolvedAbilities.map((slug) => (
                        <Panel key={slug} className="su-sheet-pilot-panel-text">
                          {slug}
                        </Panel>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </SheetSectionSlab>
          </div>
        </div>
        <div className="su-sheet-pilot-column">
          <SheetSectionCard title="Vitals" surface={readOnly ? 'paper' : 'frame'}>
            <div className="su-sheet-pilot-vitals" style={VITALS}>
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
                    <div style={MIN_W_0}>
                      <span style={CONDITIONS_LABEL}>Conditions</span>
                      <Conditions conditions={[...pilot.conditions]} />
                    </div>
                  )}
                </>
              ) : (
                // TP and Conditions SHARE a row. Stacked, the vitals column ran
                // well past the identity card beside it; TP is a single narrow
                // plate and Conditions is a short chip list, so neither needs a
                // full row of its own and pairing them squares the two cards up.
                <div style={TP_AND_CONDITIONS}>
                  <TpBlock
                    value={tp}
                    onChange={(v) => actions.patchPilot({ trainingPoints: v })}
                    editable
                  />
                  <div style={CONDITIONS_CELL}>
                    <span style={CONDITIONS_LABEL}>Conditions</span>
                    <ConditionsEditor
                      conditions={pilot.conditions}
                      onChange={actions.handleConditionsChange}
                    />
                  </div>
                </div>
              )}
            </div>
          </SheetSectionCard>
          {/* ===== Inventory (full-width band, printed pilot sheet bottom) ===== */}
          <div className="su-sheet-pilot-order-2" style={MIN_W_0}>
            <SheetSectionSlab
              title="Inventory"
              count={{
                label: 'Slots',
                value: model.slotsUsed,
                max: model.slotsCap,
                state: model.overCapacity ? 'critical' : undefined,
              }}
              controls={
                readOnly ? undefined : (
                  <SectionManageButton label="equipment" onClick={() => setPicker('equipment')} />
                )
              }
            >
              {pilot.equipment.length === 0 && model.genericInventory.length === 0 ? (
                <EmptyState variant="quiet" body="Nothing carried." />
              ) : readOnly ? (
                // Read (board 10): the shortform pills, then the SlotGrid of
                // every slot, filled and free, so capacity reads at a glance.
                <>
                  <div style={PILLS}>
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
                  </div>
                  <div style={SLOTS}>
                    <SlotGrid
                      used={model.slotsUsed}
                      cap={model.slotsCap}
                      label={`Inventory: ${model.slotsUsed} of ${model.slotsCap} slots filled${model.overCapacity ? ' — over capacity' : ''}`}
                      readOnly
                    />
                  </div>
                </>
              ) : (
                // Edit: one item to a line, its controls on the line beside its
                // pill (`SheetItemLine`), as a mech's Systems and Modules.
                <div className="su-sheet-items" style={EDIT_ITEMS}>
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
                <div style={ADDER_ROW}>
                  <GenericEntryAdder
                    onAdd={(entry) => {
                      void actions.handleGenericInventoryChange([...model.genericInventory, entry])
                    }}
                  />
                </div>
              )}
            </SheetSectionSlab>
          </div>

          {/* ===== Assigned Units — the assigned mech and the home crawler =====
              One line each in Read (board 10); full rows with Assign in Edit. */}
          {linkedUnits && (
            <div className="su-sheet-pilot-order-2" style={MIN_W_0}>
              <SheetSectionSlab
                id="linked-units"
                title="Assigned units"
                bodyClassName="su-sheet-pilot-stack-16"
              >
                {linkedUnits}
              </SheetSectionSlab>
            </div>
          )}
        </div>
      </div>

      {/* Ability-granted PARTNERS — full width, under both columns. Each
          carries a nested loadout and a cargo hold, so the narrow column would
          crush it, and a partner acts on its own turn rather than being one item
          among the pilot's carried gear. */}
      {model.partners.length > 0 && (
        <SheetSectionSlab title="Partners" count={model.partners.length}>
          <div style={STACK_12}>
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
