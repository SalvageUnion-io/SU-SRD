/**
 * MechSheet — the mech variant BODY for the LiveSheet shell, in the
 * poster layout.
 *
 * The body OWNS the identity band (Workshop-Manual mech sheet): it renders
 * `SheetHero` as its first region. Region order mirrors the
 * printed mech sheet:
 *
 *   Identity Band: image | text | stats + ability (`MechHeroChassis`) — the
 *       player's photo, what they wrote (the pattern name in Edit only: it is
 *       the band's title), the chassis stats and ability ∥ the vitals rail.
 *   Systems & Modules (`MechLoadout`) — KEPT as two sections (each its own
 *       `SlabSection`, side by side from 48rem, one Mini a line): different
 *       collections with different '+ Add' pickers/slot budgets, so folding
 *       them into one list is not trivial.
 *   The sidebar (`SheetColumns`, ruleset §1.2), beside the sheet from the
 *       64rem rung, straight under the opening on a phone: the Chassis
 *       callout (`MechChassisCard`: name with a CHASSIS chip, art,
 *       description, Change Chassis in Edit), then The Hold
 *       (`StorageManifest side='mech'`), what the mech carries — cargo is
 *       reached for mid-session — then Assigned Units (R49).
 *
 * Section containers follow the card-vs-slab rule (see `SlabSection`):
 * inputs/gauges get a CARD (the identity band, the Chassis card), entity-card
 * collections get a SLAB (The Hold, Systems, Modules, Assigned Units). Read
 * leaves an empty section out (hard rule R11).
 *
 * A phone in Read is `PhoneSheet` (R11): the vitals as `PhoneVitals`, then
 * the tabs Actions, Loadout, Hold, About: what the mech does, has and
 * carries, then who it is. Its lists are Ledgers (`MechLoadoutLedgers`).
 *
 * No play-control panel lives on the sheet: Heat Check / Push / Reactor
 * Overload and Take Damage / Critical Damage are Play's (ADR-021). The
 * Vitals gauges (SP/EP/Heat) and per-card activation (Use / Repair / uses
 * economy on System/Module cards, chassis-ability Use) are live here.
 * Shutdown/Vulnerable/Destroyed surface (and clear) through the Conditions
 * chips in the Vitals card (`MechConditionsEditor`), which merges those flags.
 *
 * ## What lives where
 *
 * This file is the RENDER, and only the render. Its two siblings:
 *   - `mechSheet.model.ts` — the derived model (SP/EP/Heat maxima and their
 *     provenance ledgers, slot capacity, the chassis-stats strip, cargo).
 *   - `mechSheetActions.model.ts` — every write, all of them through one `write()`
 *     that reads the freshest record and handles the offline refusal.
 *
 * Dep-injectable for tests: `chassis` (stats override), `store` (Zustand
 * stub), `crawler` (linked home crawler — null means no pool/stow target).
 * readOnly suppresses every edit affordance.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { Field, FieldError, SlabSection, Stack, tokens } from '../../components/index'
import { EntityPhoto } from '../../components/shared/EntityPhoto'
import { SoftWarningDialog } from '../../components/shared/SoftWarningDialog'
import { chassisArt } from '../../lib/photos/defaultArt'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { MechDash } from '../dash/MechDash'
import { MechChassisCard } from './MechChassisCard'
import { MechHeroChassis } from './MechHeroChassis'
import { MechAppearanceField, MechDescriptionField, MechIdentityPanel } from './MechIdentity'
import { MechLoadout } from './MechLoadout'
import { MechSheetPickers } from './MechSheetPickers'
import { MechVitals } from './MechVitals'
import type { ChassisLike } from './mechSheet.model'
import { useMechSheetModel } from './mechSheet.model'
import type { ItemKind } from './mechSheetActions.model'
import { useMechSheetActions } from './mechSheetActions.model'
import { PartnerCard } from './PartnerCard'
import { PhotoBeside } from './PhotoBeside'
import { SheetColumns } from './SheetColumns'
import { HeroMore, SheetHero } from './SheetHero'
import { StorageManifest } from './StorageManifest'
import { usePhoneRead } from './usePhoneRead'

/** The sheet column: an inline-size container (the poster regions query it). */
const SHEET = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
} satisfies CSSProperties

const FIELDS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[16],
  height: '100%',
  minWidth: 0,
} satisfies CSSProperties

type MechSheetProps = {
  mech: Mech
  /**
   * Injectable chassis for testing. When omitted, resolved from
   * SalvageUnionReference.Chassis.find() via mech.chassisRef.
   */
  chassis?: ChassisLike | null
  /**
   * Injectable store — defaults to useUnits.
   * Pass a stub in tests to avoid Zustand side effects.
   */
  store?: UnitsStore
  /** The viewer may write it, so Read keeps the vitals live (R11). */
  live?: boolean
  /** Suppresses every edit affordance (a sheet the viewer cannot write (public, crewmate's, Starter Set, or Read)). */
  readOnly?: boolean
  /**
   * The linked home crawler (composition resolver) — powers The Hold's stow
   * target and the optional repair scrap-pool deduction. Null = unlinked.
   */
  crawler?: Crawler | null
  /**
   * The viewer may not write `crawler`: a player's own mech in a Game, whose
   * crawler the Mediator keeps (ADR-038 §5). Closes The Hold's Stow and the
   * repair's scrap-pool deduction; the mech's own edits stay open.
   */
  crawlerReadOnly?: boolean
  /** The linked crawler's sheet: The Hold's stow target Mini opens it. */
  crawlerHref?: string
  /**
   * The Assigned Units rail content (pilot + crawler rail row/RailEmpty), built
   * by MechLiveSheet from `composition` — MechSheet has no composition access of
   * its own, so this is passed straight through into the R4 section.
   */
  linkedUnits?: ReactNode
  /**
   * The assigned pilot's ability refs, handed down by MechLiveSheet from
   * `composition`. Beefcake is a PILOT ability that raises the piloted MECH's
   * Max SP and Cargo, so a mech's maxima cannot be derived from the mech alone
   * (ADR-029). Absent = unlinked, which correctly contributes nothing.
   */
  pilotAbilities?: string[]
}

export function MechSheet({
  mech,
  chassis: chassisOverride,
  store = useUnits,
  readOnly = false,
  live = false,
  crawler = null,
  crawlerReadOnly = false,
  crawlerHref,
  linkedUnits,
  pilotAbilities,
}: MechSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available: Free Edit, not rule-gated, ADR-021).
  const [picker, setPicker] = useState<ItemKind | null>(null)

  const model = useMechSheetModel({
    mech,
    chassisOverride,
    store,
    readOnly,
    crawler,
    crawlerReadOnly,
    pilotAbilities,
  })
  const actions = useMechSheetActions({ mech, store, storeState, crawler })
  // Read leaves an empty section out (ruleset §1.2): an empty state only where
  // Edit can fill it.
  const showHold = !readOnly || model.cargo.usage.used > 0

  const { chassis, cargo } = model
  // A phone in Read leads with the numbers, then tabs (`PhoneSheet`).
  const phoneRead = usePhoneRead(readOnly)
  const vitals = (phone: boolean) => (
    <MechVitals
      mech={mech}
      model={model}
      actions={actions}
      readOnly={readOnly}
      store={store}
      live={live}
      phone={phone}
    />
  )

  // The sheet's regions, named once: a phone in Read orders them number
  // first, in tabs; every other width and Edit keep the opening, the sidebar
  // and the main column.
  // On a phone the chassis ability follows the Vitals (§1.10); on the phone's
  // About tab it runs the card's width under the photo.
  const chassisAbility = (
    <HeroMore>
      <MechHeroChassis
        abilities={model.chassisAbilities}
        chassisModder={model.chassisModder}
        onModChassis={
          readOnly
            ? undefined
            : (slug) => actions.patchMech({ moddedChassisAbility: slug ?? undefined })
        }
      />
    </HeroMore>
  )
  const heroNode = (
    <SheetHero
      flat={phoneRead}
      name={mech.name}
      fields={
        <PhotoBeside
          below={
            <>
              {phoneRead && chassisAbility}
              <MechDescriptionField
                mech={mech}
                onSave={readOnly ? undefined : actions.saveDescription}
              />
            </>
          }
          photo={
            <EntityPhoto
              photo={mech.photo}
              // The chassis art until the player changes it.
              fallback={chassisArt(mech.chassisRef)}
              name={mech.name}
              onChange={
                readOnly
                  ? undefined
                  : (photo) =>
                      useUnits.getState().update('mech', mech.id, { photo }, LIVE_SHEET_MANUAL)
              }
            />
          }
        >
          <div className="su-sheet-mech-hero-split">
            <div style={FIELDS}>
              <MechIdentityPanel
                mech={mech}
                patch={readOnly ? undefined : actions.patchMech}
                after={
                  <>
                    <Field
                      label={buildSheetCopy('quirk')}
                      value={mech.quirk ?? ''}
                      onSave={readOnly ? undefined : actions.saveQuirk}
                      placeholder={buildSheetCopy('noQuirkRecorded')}
                    />
                    <MechAppearanceField
                      mech={mech}
                      onSave={readOnly ? undefined : actions.saveAppearance}
                    />
                  </>
                }
              />
            </div>
            {!phoneRead && chassisAbility}
          </div>
        </PhotoBeside>
      }
      vitals={phoneRead ? undefined : vitals(false)}
    />
  )
  const chassisNode = (
    <MechChassisCard
      mech={mech}
      entity={model.chassisEntity}
      chassisName={model.chassisName}
      patch={readOnly ? undefined : actions.patchMech}
    />
  )
  const manifestNode = (
    <StorageManifest
      side="mech"
      cargo={cargo}
      mechName={mech.name}
      crawlerName={crawler?.name ?? null}
      counterpartHref={crawlerHref}
      readOnly={readOnly}
    />
  )
  const holdNode = showHold && (
    <SlabSection
      title={buildSheetCopy('theHold')}
      count={{
        label: buildSheetCopy('slots'),
        value: cargo.usage.used,
        max: cargo.usage.cap,
        ...(cargo.usage.used > cargo.usage.cap ? { state: 'critical' } : {}),
      }}
    >
      {manifestNode}
    </SlabSection>
  )
  const asideNode = (
    <>
      {chassisNode}
      {holdNode}
      {linkedUnits}
    </>
  )
  // Read shows no companion card: a companion has its
  // own sheet, linked from the side column's cell. Edit keeps the card, where
  // its loadout is still fitted.
  const partnersNode = (
    <>
      {/* ===== Partners — drones this mech's CHASSIS ABILITY fields (Little
    Sestra's Sestra Drone, Big Brother's four). Its own region rather than
    a Assigned Units row: a partner is not a linked roster entity, it is part
    of this mech's own kit — and it renders full width because it carries a
    nested loadout and a hold. No crawler tech level is threaded: a
    mech-granted drone is fixed by its stat block and never tracks the
    Union Crawler, unlike a pilot's ability-granted partners. ===== */}
      {(mech.partners ?? []).length > 0 && (
        <SlabSection fold="open" title={buildSheetCopy('partners')}>
          <Stack gap={12}>
            {(mech.partners ?? []).map((partner) => (
              // The side column's companion cell lands here.
              <div key={partner.id} id={`partner-${partner.id}`} className="su-partner-anchor">
                <PartnerCard
                  found={{ partner, hostKind: 'mech', host: mech }}
                  fielded={
                    (mech.partners ?? []).filter((p) => p.hostRef === partner.hostRef).length
                  }
                  readOnly={readOnly}
                  store={store}
                />
              </div>
            ))}
          </Stack>
        </SlabSection>
      )}
    </>
  )

  return (
    <section
      aria-labelledby="mech-sheet-heading"
      // `.su-sheet-section` is a print-stylesheet target (page-break rules);
      // `@container` scopes the poster region grid below to the SHEET's own
      // width, not the viewport.
      className="su-sheet-section"
      style={SHEET}
    >
      {/* The hero already shows the name — this heading is for a11y/print. */}
      <h2 id="mech-sheet-heading" className="su-sr-only">
        {mech.name}
      </h2>

      {!chassis && (
        <FieldError>
          {buildSheetCopy('unknownChassisUsingStoredZero', { chassisRef: mech.chassisRef })}
        </FieldError>
      )}

      {readOnly ? (
        // Read is the sheet dashboard at
        // every width; a phone stacks it under its pinned vitals. Edit keeps
        // the build layout below.
        <MechDash
          mech={mech}
          model={model}
          actions={actions}
          live={live}
          crawler={crawler}
          linkedUnits={linkedUnits}
          phone={phoneRead}
        />
      ) : (
        <SheetColumns
          asideLabel={buildSheetCopy('whatCarries', { name: mech.name })}
          hero={heroNode}
          aside={asideNode}
        >
          <MechLoadout
            mech={mech}
            model={model}
            actions={actions}
            readOnly={readOnly}
            store={store}
            onManage={setPicker}
          />
          {partnersNode}
        </SheetColumns>
      )}

      <MechSheetPickers
        picker={picker}
        onClose={() => setPicker(null)}
        mech={mech}
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
