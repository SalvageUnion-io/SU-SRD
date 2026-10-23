/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * One grammar with every sheet (hard rule R11), in this reading order:
 *   - the opening, `SheetHero`: the Identity card (the portrait, else the
 *     class's art, beside fields typeset in Read) beside the Vitals card
 *     (HP/AP gauges named from the one vitals map, TP and Conditions);
 *   - Abilities, two folding masonry grids (`PilotSheetAbilities`): each
 *     tree the pilot trained in, its taken Abilities as Compacts on the SRD's
 *     track, open; then the Generic tree as Minis, folded; each with Spend AP
 *     (fixed costs only) and a used/recharge toggle on its line in Edit;
 *   - ability-granted Partners;
 *   - and in the permanent right sidebar (`SheetColumns`, ruleset §1.2),
 *     what the pilot carries: Inventory, each piece of equipment a contentful
 *     Mini (its head, then its text), a generic entry its Mini, the slots'
 *     SlotGrid under them; in Edit each item's controls in its chip group;
 *     then Assigned Units, the mech and crawler they field.
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
 * No play-control panel lives on the sheet: Take Damage and Critical Injury
 * are Play's (ADR-021). The Bio is a field of the Identity card
 * (`PilotIdentityPanel`). The effective Crawler Level
 * (`resolveEffectiveCrawlerLevel`, in `pilotSheet.model`) scales the
 * Modification-style choice caps, with no editor on the sheet. The Vitals
 * gauges and per-card activation (Spend AP, Use / Restock, condition cycling)
 * are live here.
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
 * every edit affordance (a sheet the viewer cannot write (public, crewmate's, Starter Set, or Read)).
 */

import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import type { RefAbility } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import { pinFor } from 'salvageunion-reference/rules'
import { Entity } from '../../components/entity/Entity'
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
import { resolveClass } from '../../lib/classRef'
import { classArt } from '../../lib/photos/defaultArt'
import { buildSheetCopy } from '../../messages/build-sheet'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import { ChipListEditor } from './ChipListEditor'
import { CONDITION_DRAFT } from './chipWell.model'
import { PartnerCard } from './PartnerCard'
import { PilotIdentityPanel } from './PilotIdentity'
import { PilotSheetAbilities } from './PilotSheetAbilities'
import { GenericEntryAdder, GenericEntryLine, PilotEquipmentItem } from './PilotSheetItems'
import { usePilotSheetModel } from './pilotSheet.model'
import { usePilotSheetActions } from './pilotSheetActions.model'
import { SheetColumns } from './SheetColumns'
import { SheetHero } from './SheetHero'
import { SheetPickerModal } from './SheetPickerModal'
import { SheetVitalGauge } from './SheetVitalGauge'

// ---------------------------------------------------------------------------
// TpBlock — pilot Training Points, straight under the AP gauge.
//
// A counter, not a gauge (ruleset §2.1: no cap, no track): the label-first
// chip (`TRAINING POINTS | 3`), with the +/- steppers while the sheet writes
// it, as every stat reads.
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
      label={buildSheetCopy('trainingPoints')}
      value={value}
      mode={editable ? 'edit' : 'read'}
      onChange={editable ? onChange : undefined}
    />
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

/** TP under the AP gauge: the vitals' own row, no rule between them. */
const TP_ROW = {
  borderTopWidth: 0,
  display: 'flex',
  marginTop: tokens.space[8],
  paddingTop: 0,
} satisfies CSSProperties

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
  /** When true, every edit affordance is suppressed (a sheet the viewer cannot write (public, crewmate's, Starter Set, or Read)). */
  readOnly?: boolean
  /**
   * The viewer may not write the linked crawler: a player in a Game, whose
   * crawler the Mediator keeps (ADR-038 §5). Closes the partners' Stow and Load.
   */
  crawlerReadOnly?: boolean
  /**
   * The Assigned Units section (mech + crawler), built by PilotLiveSheet from
   * `composition` — PilotSheet has no composition access of its own, so this
   * is passed straight through, into the sidebar under Inventory. Undefined
   * when Read has nothing linked.
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
  // language archetype B; always available: Free Edit, not rule-gated, ADR-021).
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the `SheetHero` panel's action row.
  const [picker, setPicker] = useState<'abilities' | 'equipment' | null>(null)

  const model = usePilotSheetModel({ pilot, storeState, picker })
  const actions = usePilotSheetActions({
    pilot,
    store,
    storeState,
    crawlerTechLevel: model.effectiveCrawlerLevel,
  })

  const { hpParts, apParts, maxHP, maxAP, hp, ap, tp } = model
  const pilotClass = resolveClass(pilot.classRef)
  const empty = pilot.equipment.length === 0 && model.genericInventory.length === 0

  return (
    <section
      aria-label={buildSheetCopy('pilotDetails', { name: pilot.name })}
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
        asideLabel={buildSheetCopy('whatCarries', { name: pilot.name })}
        hero={
          <SheetHero
            name={pilot.name}
            fields={
              <PilotIdentityPanel
                pilot={pilot}
                onToggleUsed={readOnly ? undefined : actions.toggleUsed}
                patch={readOnly ? undefined : actions.patchPilot}
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
              />
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
                {/* TP stands right under AP, in the same row of the vitals. */}
                <div style={TP_ROW}>
                  <TpBlock
                    value={tp}
                    onChange={
                      readOnly ? undefined : (v) => actions.patchPilot({ trainingPoints: v })
                    }
                    editable={!readOnly}
                  />
                </div>
                {/* Read leaves an empty field out: Conditions prints only
                    when there is one to read. */}
                {readOnly ? (
                  pilot.conditions.length > 0 && (
                    <div style={MIN_W_0}>
                      <Eyebrow tone="toneDeep" style={CONDITIONS_LABEL}>
                        {buildSheetCopy('conditions')}
                      </Eyebrow>
                      <Conditions conditions={[...pilot.conditions]} />
                    </div>
                  )
                ) : (
                  <div style={MIN_W_0}>
                    <Eyebrow tone="toneDeep" style={CONDITIONS_LABEL}>
                      {buildSheetCopy('conditions')}
                    </Eyebrow>
                    <ChipListEditor
                      items={pilot.conditions}
                      onChange={actions.handleConditionsChange}
                      noun="condition"
                      draftWidth={CONDITION_DRAFT}
                      unique
                    />
                  </div>
                )}
                {/* The class, its header-only Mini under the stats, linking to
                    its Page (R49). */}
                {pilotClass && (
                  <div style={MIN_W_0}>
                    <Entity
                      size="mini"
                      context="browse"
                      entity={pilotClass}
                      mode={{ kind: 'link' }}
                    />
                  </div>
                )}
              </>
            }
          />
        }
        // ===== Inventory, the sidebar (ruleset §1.2) ===== None in Read
        // when nothing is carried: an empty section is left out, as an empty
        // field is.
        // Assigned Units follow it there (R49): what the pilot carries, then
        // what they field.
        aside={
          readOnly && empty && !linkedUnits ? undefined : (
            <>
              {!(readOnly && empty) && (
                <SlabSection
                  title={buildSheetCopy('inventory')}
                  count={{
                    label: buildSheetCopy('slots'),
                    value: model.slotsUsed,
                    max: model.slotsCap,
                    state: model.overCapacity ? 'critical' : undefined,
                  }}
                  actions={
                    readOnly ? undefined : (
                      <Button size="compact" onClick={() => setPicker('equipment')}>
                        {buildSheetCopy('manageEquipment')}
                      </Button>
                    )
                  }
                >
                  {empty ? (
                    <EmptyState variant="quiet" body={buildSheetCopy('nothingCarried')} />
                  ) : (
                    // One item a line, in Read and Edit alike: each piece of
                    // equipment a contentful Mini (its head, then its text), a
                    // generic entry its Mini; in Edit their controls ride the
                    // chip group (`SheetItemLine`), as a mech's Systems do.
                    <ul
                      aria-label={buildSheetCopy('sEquipment', { name: pilot.name })}
                      data-sheet-carried=""
                      className={
                        readOnly ? 'su-entity-mini-list' : 'su-entity-mini-list su-sheet-items'
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
                          void actions.handleGenericInventoryChange([
                            ...model.genericInventory,
                            entry,
                          ])
                        }}
                      />
                    </div>
                  )}
                </SlabSection>
              )}
              {linkedUnits}
            </>
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
          <SlabSection fold="open" title={buildSheetCopy('partners')} count={model.partners.length}>
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
      </SheetColumns>

      {/* The ONE shared picker modal — abilities & equipment '+ Add' both open
          it (multi-select grids write through on toggle; no Save button). */}
      <SheetPickerModal
        open={picker === 'abilities'}
        onClose={() => setPicker(null)}
        title={buildSheetCopy('addAbilities')}
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
            category: { label: buildSheetCopy('tree'), of: (item) => (item as RefAbility).tree },
          }}
          railName={pilot.name}
          chosenLabel={buildSheetCopy('learned')}
          emptyMessage={buildSheetCopy('noAbilitiesMatchThoseFilters')}
        />
      </SheetPickerModal>
      <SheetPickerModal
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title={buildSheetCopy('addEquipment')}
        floating
      >
        <EntitySearcher
          schema="equipment"
          selected={pilot.equipment}
          onToggle={actions.toggleEquipment}
          idOf={(item) => nameToSlug(item.name)}
          railName={pilot.name}
          chosenLabel={buildSheetCopy('equipped')}
          emptyMessage={buildSheetCopy('noEquipmentMatchesThoseFilters')}
          budget={{
            label: buildSheetCopy('inventorySlots'),
            used: model.slotsUsed,
            max: model.slotsCap,
          }}
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
