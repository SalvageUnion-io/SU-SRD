/**
 * PilotSheet — the pilot body for the LiveSheet shell (Workshop-Manual pilot
 * sheet, region-for-region).
 *
 * One grammar with every sheet (hard rule R11), in this reading order:
 *   - the opening, `SheetHero`: the Identity card (the portrait, else the
 *     class's art, beside fields typeset in Read) beside the Vitals card
 *     (`PilotVitals`: HP/AP gauges named from the one vitals map, TP and
 *     Conditions, live in Read for whoever may write the sheet);
 *   - Abilities, two folding masonry grids (`PilotSheetAbilities`): each
 *     tree the pilot trained in, its taken Abilities as Compacts on the SRD's
 *     track, open; then the Generic tree as Minis, folded; each with Spend AP
 *     (fixed costs only) and a used/recharge toggle on its line in Edit;
 *   - ability-granted Partners;
 *   - and in the permanent right sidebar (`SheetColumns`, ruleset §1.2),
 *     what the pilot carries: Inventory, each piece of equipment a contentful
 *     Mini (its head, then its text), a generic entry its Mini, the slots'
 *     SlotGrid under them; in Edit each item's controls in its chip group;
 *     then Related units, the mech and crawler they field.
 * Read leaves an empty section out (ruleset §1.2).
 *
 * A phone in Read is `PhoneSheet` (R11): the vitals as `PhoneVitals`, then the
 * tabs Actions, Abilities, Gear, About. Its lists are Ledgers: one per tree
 * the pilot has trained in (the taken abilities only), then Generic, and one
 * Inventory.
 *
 * Read | Edit (`sheetMode.model.ts`) reaches here as `readOnly`: Read withdraws every
 * write affordance exactly as a sheet the viewer cannot write does.
 *
 * Section containers follow the card-vs-slab rule (see `SlabSection`):
 * a section of inputs/gauges is a CARD (here, the identity band), a section of
 * entity cards is a SLAB (Abilities, Inventory, Related units) — cards already
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
import { MiniGrid, SlabSection, tokens } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { SoftWarningDialog } from '../../components/shared/SoftWarningDialog'
import { classArt } from '../../lib/photos/defaultArt'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { PilotDash } from '../dash/PilotDash'
import { PartnerMini } from './PartnerMini'
import { PilotIdentityPanel } from './PilotIdentity'
import { PilotInventory } from './PilotInventory'
import { PilotSheetAbilities } from './PilotSheetAbilities'
import type { PilotPicker } from './PilotSheetPickers'
import { PilotSheetPickers } from './PilotSheetPickers'
import { PilotVitals } from './PilotVitals'
import { inventoryEmpty, usePilotSheetModel } from './pilotSheet.model'
import { usePilotSheetActions } from './pilotSheetActions.model'
import { SheetColumns } from './SheetColumns'
import { SheetHero } from './SheetHero'
import { usePhoneRead } from './usePhoneRead'

/** The sheet body; `container-type` scopes the region grid to its own width. */
const BODY = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

const COMPANION_COLUMNS = { columns: '18rem 2' } satisfies CSSProperties

// ---------------------------------------------------------------------------
// PilotSheet
// ---------------------------------------------------------------------------

type PilotSheetProps = {
  pilot: Pilot
  /**
   * Injectable store — defaults to useUnits.
   * Pass a stub in tests to avoid Zustand side effects.
   */
  store?: UnitsStore
  /** When true, every edit affordance is suppressed (a sheet the viewer cannot write (public, crewmate's, Starter Set, or Read)). */
  readOnly?: boolean
  /**
   * The viewer may not write the linked crawler: a player in a Game, whose
   * crawler the Mediator keeps (ADR-038 §5). Closes the partners' Stow and Load.
   */
  crawlerReadOnly?: boolean
  /**
   * The Related units section (mech + crawler), built by PilotLiveSheet from
   * `composition` — PilotSheet has no composition access of its own, so this
   * is passed straight through, into the sidebar under Inventory. Undefined
   * when Read has nothing linked.
   */
  linkedUnits?: ReactNode
  /** The viewer may write it, so Read keeps HP, AP and Training Points live (R11). */
  live?: boolean
}

export function PilotSheet({
  pilot,
  store = useUnits,
  readOnly = false,
  crawlerReadOnly = false,
  linkedUnits,
  live = false,
}: PilotSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available: Free Edit, not rule-gated, ADR-021).
  // Identity is a FIELD section (unified edit language archetype A): its own
  // Edit/Done toggle, rendered in the `SheetHero` panel's action row.
  const [picker, setPicker] = useState<PilotPicker | null>(null)

  const model = usePilotSheetModel({ pilot, storeState, picker })
  const actions = usePilotSheetActions({
    pilot,
    store,
    storeState,
    crawlerTechLevel: model.effectiveCrawlerLevel,
  })
  const empty = inventoryEmpty(pilot, model)
  // A phone in Read is the numbers, then tabs (`PhoneSheet`), as the mech's is.
  const phoneRead = usePhoneRead(readOnly)
  const vitals = (phone: boolean) => (
    <PilotVitals
      pilot={pilot}
      model={model}
      actions={actions}
      readOnly={readOnly}
      live={live}
      phone={phone}
    />
  )
  /**
   * Ability-granted COMPANIONS (a pilot's partners). Each carries a nested
   * loadout and a cargo hold, and acts on its own turn rather than being one
   * item among the pilot's carried gear. Minis at level 2 (E6), two columns
   * on the page; each opens its whole card from Details.
   */
  const companions = (fold: boolean) =>
    model.partners.length > 0 && (
      <SlabSection
        {...(fold ? { fold: 'open' as const } : {})}
        title={buildSheetCopy(model.partners.length > 1 ? 'companions' : 'companion')}
        count={model.partners.length}
      >
        <MiniGrid
          label={buildSheetCopy('companions')}
          edit={!readOnly}
          {...(fold ? { style: COMPANION_COLUMNS } : {})}
        >
          {model.partners.map((partner) => (
            <li key={partner.id}>
              <PartnerMini
                found={{ partner, hostKind: 'pilot', host: pilot }}
                crawler={model.linkedCrawler}
                crawlerTechLevel={model.effectiveCrawlerLevel}
                hostAbilityRefs={pilot.abilities}
                fielded={model.fieldedByRef[partner.hostRef] ?? 1}
                readOnly={readOnly}
                crawlerReadOnly={crawlerReadOnly}
                store={store}
              />
            </li>
          ))}
        </MiniGrid>
      </SlabSection>
    )

  return (
    <section
      aria-label={buildSheetCopy('pilotDetails', { name: pilot.name })}
      // `.su-sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width, not the viewport.
      className="su-sheet-section"
      style={BODY}
    >
      {readOnly ? (
        // Read is the sheet dashboard at
        // every width; a phone stacks it under its pinned vitals. Edit keeps
        // the build layout below.
        <PilotDash
          pilot={pilot}
          model={model}
          actions={actions}
          live={live}
          linkedUnits={linkedUnits}
          phone={phoneRead}
        />
      ) : (
        // The opening (`SheetHero`, as every sheet opens): the identity fields
        // beside the vitals.
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
                              useUnits
                                .getState()
                                .update('pilot', pilot.id, { photo }, LIVE_SHEET_MANUAL)
                      }
                    />
                  }
                />
              }
              vitals={vitals(false)}
            />
          }
          // ===== Inventory, the sidebar (ruleset §1.2) ===== None in Read
          // when nothing is carried: an empty section is left out, as an empty
          // field is. Related units follow it there (R49): what the pilot
          // carries, then what they field.
          aside={
            readOnly && empty && !linkedUnits ? undefined : (
              <>
                {!(readOnly && empty) && (
                  <PilotInventory
                    pilot={pilot}
                    model={model}
                    actions={actions}
                    readOnly={readOnly}
                    store={store}
                    onManage={() => setPicker('equipment')}
                  />
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
            currentAP={model.ap}
            readOnly={readOnly}
            onManage={() => setPicker('abilities')}
            onSpend={(cost) => {
              actions.handleSpendAP(cost)
            }}
            onToggleUsed={(slug, next) => {
              actions.handleAbilityUsedChange(slug, next)
            }}
            onRemoveUnknown={(slug) => actions.toggleAbility(slug)}
          />
          {companions(true)}
        </SheetColumns>
      )}

      <PilotSheetPickers
        picker={picker}
        onClose={() => setPicker(null)}
        pilot={pilot}
        model={model}
        actions={actions}
      />

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
