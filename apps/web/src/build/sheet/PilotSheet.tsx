/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * One grammar with every sheet (hard rule R11), in this reading order:
 *   - the opening, `SheetHero`: the Identity card (the portrait, else the
 *     class's art, beside fields typeset in Read) beside the Vitals card
 *     (HP/AP gauges named from the one vitals map, TP and Conditions);
 *   - Abilities, two folding masonry grids (`PilotSheetAbilities`): each
 *     tree the pilot trained in, its taken Abilities as Rows on the SRD's
 *     track, open; then the Generic tree as Tokens, folded; each with Spend AP
 *     (fixed costs only) and a used/recharge toggle on its line in Edit;
 *   - ability-granted Partners, then Assigned Units, the last region;
 *   - and in the permanent right sidebar (`SheetColumns`, ruleset §1.2),
 *     what the pilot carries: Inventory, each piece of equipment a contentful
 *     Token (its head, then its text), a generic entry its Token, the slots'
 *     SlotGrid under them; in Edit each item's controls in its chip group.
 * Read leaves an empty section out (ruleset §1.2).
 *
 * Read | Edit (`sheetMode.model.ts`) reaches here as `readOnly`: Read withdraws every
 * write affordance exactly as a sheet the viewer cannot write does.
 *
 * Section containers follow the card-vs-slab rule (see `SlabSection`):
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

import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { pinFor } from 'salvageunion-reference/rules'
import {
  Button,
  Conditions,
  EmptyState,
  EntitySearcher,
  Eyebrow,
  SlabSection,
  SlotGrid,
  Stack,
  Stat,
  tokens,
} from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { SoftWarningDialog } from '../../components/shared/SoftWarningDialog'
import { classArt } from '../../lib/photos/defaultArt'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { ChipListEditor } from './ChipListEditor'
import { CONDITION_DRAFT } from './chipWell.model'
import { PartnerCard } from './PartnerCard'
import { PhotoBeside } from './PhotoBeside'
import { PilotIdentityPanel } from './PilotIdentity'
import { PilotSheetAbilities } from './PilotSheetAbilities'
import { GenericEntryAdder, GenericEntryLine, PilotEquipmentItem } from './PilotSheetItems'
import { usePilotSheetModel } from './pilotSheet.model'
import { usePilotSheetActions } from './pilotSheetActions.model'
import { SheetColumns } from './SheetColumns'
import { SheetHero } from './SheetHero'
import { SheetPickerModal } from './SheetSection'
import { SheetVitalGauge } from './SheetVitalGauge'

// ---------------------------------------------------------------------------
// TpBlock — pilot Training Points, in the Vitals card's dashed-topped `.vrow`
// beside Conditions.
//
// A label-first chip (`TRAINING POINTS | 3`) with the +/- steppers while the
// sheet writes it, as every stat reads.
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
      label="Training Points"
      value={value}
      mode={editable ? 'edit' : 'read'}
      onChange={editable ? onChange : undefined}
    />
  )
}

/**
 * TP in the read state (board 10): a counter, not a gauge (ruleset §2.1: no
 * cap, no track), so the label-first `TRAINING POINTS | 2` chip. No stepper;
 * Edit gives the stepper box back (`TpBlock`).
 */
function TpReadRow({ value }: { value: number }) {
  return (
    <div>
      <Stat label="Training Points" value={value} />
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

const MIN_W_0 = { minWidth: 0 } satisfies CSSProperties

/** The Conditions label's place over the chip row. */
const CONDITIONS_LABEL = { display: 'block', marginBottom: tokens.space[8] } satisfies CSSProperties

const TP_AND_CONDITIONS = {
  alignItems: 'flex-start',
  display: 'flex',
  flexWrap: 'wrap',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

const CONDITIONS_CELL = { flex: '1 1 12rem', minWidth: 0 } satisfies CSSProperties // wraps under TP

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
  const empty = pilot.equipment.length === 0 && model.genericInventory.length === 0

  return (
    <section
      aria-label={`${pilot.name} pilot details`}
      // `.su-sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width, not the viewport.
      className="su-sheet-section"
      style={BODY}
    >
      {/* The opening (`SheetHero`, as every sheet opens): the identity
          fields beside the vitals. HP, AP and TP are what a player reaches for
          mid-session, so on a phone they come straight after the identity. */}
      <SheetColumns
        asideLabel={`What ${pilot.name} carries`}
        hero={
          <SheetHero
            name={pilot.name}
            fields={
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
            }
            vitals={
              <>
                <SheetVitalGauge
                  vital="hp"
                  value={hp}
                  max={maxHP}
                  onChange={readOnly ? undefined : (v) => actions.patchPilot({ currentHP: v })}
                  onMaxChange={
                    readOnly
                      ? undefined
                      : (next) => actions.overridePilotMax({ maxHpOverride: pinFor(next, hpParts) })
                  }
                  breakdown={readOnly ? undefined : hpParts}
                  provenance={readOnly ? undefined : model.hpLines}
                  onRevertOverride={
                    readOnly
                      ? undefined
                      : () => actions.overridePilotMax({ maxHpOverride: undefined })
                  }
                  readOnly={readOnly}
                />
                <SheetVitalGauge
                  vital="ap"
                  value={ap}
                  max={maxAP}
                  onChange={readOnly ? undefined : (v) => actions.patchPilot({ currentAP: v })}
                  onMaxChange={
                    readOnly
                      ? undefined
                      : (next) => actions.overridePilotMax({ maxApOverride: pinFor(next, apParts) })
                  }
                  breakdown={readOnly ? undefined : apParts}
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
                        <Eyebrow tone="toneDeep" style={CONDITIONS_LABEL}>
                          Conditions
                        </Eyebrow>
                        <Conditions conditions={[...pilot.conditions]} />
                      </div>
                    )}
                  </>
                ) : (
                  // TP and Conditions SHARE a row: TP is a single narrow plate and
                  // Conditions a short chip list, so neither needs a row of its own.
                  <div style={TP_AND_CONDITIONS}>
                    <TpBlock
                      value={tp}
                      onChange={(v) => actions.patchPilot({ trainingPoints: v })}
                      editable
                    />
                    <div style={CONDITIONS_CELL}>
                      <Eyebrow tone="toneDeep" style={CONDITIONS_LABEL}>
                        Conditions
                      </Eyebrow>
                      <ChipListEditor
                        items={pilot.conditions}
                        onChange={actions.handleConditionsChange}
                        noun="condition"
                        draftWidth={CONDITION_DRAFT}
                        unique
                      />
                    </div>
                  </div>
                )}
              </>
            }
          />
        }
        // ===== Inventory, the sidebar (ruleset §1.2) ===== None in Read
        // when nothing is carried: an empty section is left out, as an empty
        // field is.
        aside={
          readOnly && empty ? undefined : (
            <SlabSection
              title="Inventory"
              count={{
                label: 'Slots',
                value: model.slotsUsed,
                max: model.slotsCap,
                state: model.overCapacity ? 'critical' : undefined,
              }}
              actions={
                readOnly ? undefined : (
                  <Button size="compact" onClick={() => setPicker('equipment')}>
                    Manage Equipment
                  </Button>
                )
              }
            >
              {empty ? (
                <EmptyState variant="quiet" body="Nothing carried." />
              ) : (
                // One item a line, in Read and Edit alike: each piece of
                // equipment a contentful Token (its head, then its text), a
                // generic entry its Token; in Edit their controls ride the
                // chip group (`SheetItemLine`), as a mech's Systems do.
                <ul
                  aria-label={`${pilot.name}'s equipment`}
                  data-sheet-carried=""
                  className={
                    readOnly ? 'su-entity-token-list' : 'su-entity-token-list su-sheet-items'
                  }
                >
                  {model.ordinaryEquipment.map((slug) => (
                    <li key={slug}>
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
                        onRemove={readOnly ? undefined : () => actions.toggleEquipment(slug)}
                        readOnly={readOnly}
                        scalingParent={model.scalingParent}
                        store={store}
                      />
                    </li>
                  ))}
                  {model.genericInventory.map((entry, index) => (
                    <li key={entry.id}>
                      <GenericEntryLine
                        entry={entry}
                        readOnly={readOnly}
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
                    </li>
                  ))}
                </ul>
              )}
              {!empty && (
                <div style={SLOTS}>
                  <SlotGrid
                    used={model.slotsUsed}
                    cap={model.slotsCap}
                    label={`Inventory: ${model.slotsUsed} of ${model.slotsCap} slots filled${model.overCapacity ? ' — over capacity' : ''}`}
                    readOnly
                  />
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
            </SlabSection>
          )
        }
      >
        {/* ===== Abilities — the trees this pilot trained in, then the Generic
          tree (`PilotSheetAbilities`) ===== */}
        <PilotSheetAbilities
          classTrees={model.classTrees}
          genericAbilities={model.genericAbilities}
          unresolvedAbilities={model.unresolvedAbilities}
          usedAbilities={pilot.usedAbilities}
          currentAP={ap}
          readOnly={readOnly}
          onManage={() => setPicker('abilities')}
          onSpend={(cost) => {
            void actions.handleSpendAP(cost)
          }}
          onToggleUsed={(slug, next) => {
            void actions.handleAbilityUsedChange(slug, next)
          }}
          onRemoveUnknown={(slug) => actions.toggleAbility(slug)}
        />

        {/* Ability-granted PARTNERS. Each carries a nested loadout and a cargo
          hold, and a partner acts on its own turn rather than being one item
          among the pilot's carried gear. */}
        {model.partners.length > 0 && (
          <SlabSection fold="open" title="Partners" count={model.partners.length}>
            <Stack gap={12}>
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
            </Stack>
          </SlabSection>
        )}

        {/* ===== Assigned Units — the assigned mech and the home crawler: the
          last region, as on every sheet (`AssignedUnits`, built by SheetPilot) ===== */}
        {linkedUnits}
      </SheetColumns>

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
              ? (item) => model.abilityTrees?.has((item as RefAbility).tree) ?? false
              : undefined
          }
          facets={{
            category: { label: 'Tree', of: (item) => (item as RefAbility).tree },
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
