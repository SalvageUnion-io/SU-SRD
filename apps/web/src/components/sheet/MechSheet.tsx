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
 *   Chassis: the identity card's foot (`MechChassisCard`) — art, name (with
 *       a CHASSIS chip) and description, with Change Chassis in Edit.
 *   Systems & Modules — KEPT as two sections (each its own `SheetSectionSlab`,
 *       side by side from 48rem, one Token a line): different collections
 *       with different '+ Add' pickers/slot budgets, so folding them into one
 *       list is not trivial.
 *   The Hold (`StorageManifest side='mech'`) reads BEFORE Systems & Modules —
 *       cargo is reached for mid-session and was buried under two long loadout
 *       lists at the printed sheet's bottom-of-page-2 placement.
 *   Assigned Units closes the sheet.
 *
 * Section containers follow the card-vs-slab rule (see `SheetSectionSlab`):
 * inputs/gauges get a CARD (the identity band, the Chassis card), entity-card
 * collections get a SLAB (The Hold, Systems, Modules, Assigned Units) — cards already carry their own frame, so a second frame
 * around them reads as one opaque block.
 *
 * Dropped (the poster redesign — no poster counterpart; tracking issues filed for
 * re-homing as an off-sheet action surface):
 *   - `HeatCheckControl` — Heat Check / Push / Reactor Overload loop.
 *   - `TakeDamageControl` — Take Damage / Critical Damage loop.
 *   - the Retire slab + `ScrapMechControl` — the scrap-a-mech helper.
 * The always-live Vitals gauges (SP/EP/Heat) and per-card activation (Use /
 * Repair / uses economy on System/Module cards, chassis-ability Use) are
 * KEPT — only the play-control PANELS drop. Shutdown/Vulnerable/Destroyed
 * still surface (and clear) through the unified Conditions chips in the
 * Vitals card (`MechConditionsEditor`), which already merges those flags.
 *
 * ## What lives where
 *
 * This file is now the RENDER, and only the render. Its two siblings:
 *   - `mechSheet.model.ts` — the derived model (SP/EP/Heat maxima and their
 *     provenance ledgers, slot capacity, the chassis-stats strip, cargo).
 *   - `mechSheetActions.model.ts` — every write, all of them through one `write()`
 *     that reads the freshest record and handles the offline refusal.
 *
 * Dep-injectable for tests: `chassis` (stats override), `store` (Zustand
 * stub), `crawler` (linked home crawler — null means no pool/stow target).
 * readOnly suppresses every edit affordance.
 */

import type { Crawler } from 'cantina-domain/schemas/crawler'
import type { Mech } from 'cantina-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { nameToSlug } from 'salvageunion-reference'
import { pinFor, unifiedMechConditions } from 'salvageunion-reference/rules'
import { occurrenceKeys } from '../../lib/occurrenceKeys'
import { chassisArt } from '../../lib/photos/defaultArt'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { runWrite } from '../../lib/runWrite'
import { useEntityStore } from '../../stores/entityStore'
import { LIVE_SHEET_MANUAL } from '../../stores/surfaceProvenance'
import type { SlabCount } from '../index'
import {
  Conditions,
  EmptyState,
  EntitySearcher,
  Eyebrow,
  Field,
  FieldError,
  heatDangerFrom,
  SheetSectionSlab,
  tokens,
  VitalGauge,
} from '../index'
import { EntityPhoto } from '../shared/EntityPhoto'
import { SoftWarningDialog } from '../shared/SoftWarningDialog'
import { MechChassisCard } from './MechChassisCard'
import { MechConditionsEditor } from './MechConditionsEditor'
import { MechHeroChassis } from './MechHeroChassis'
import { MechIdentityPanel, MechProseFields } from './MechIdentity'
import { MechItemToken } from './MechItemToken'
import type { ChassisLike } from './mechSheet.model'
import { useMechSheetModel } from './mechSheet.model'
import type { ItemKind } from './mechSheetActions.model'
import { useMechSheetActions } from './mechSheetActions.model'
import { PartnerCard } from './PartnerCard'
import { PhotoBeside } from './PhotoBeside'
import { SheetHero } from './SheetHero'
import { SectionManageButton, SheetPickerModal } from './SheetSection'
import { StorageManifest } from './StorageManifest'

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

const CHASSIS = { marginTop: 'auto', paddingTop: tokens.space[24] } satisfies CSSProperties

/** The gauge stack; the dashed rule between gauges is `.su-sheet-mech-vitals`. */
const VITALS = { display: 'flex', flexDirection: 'column', width: '100%' } satisfies CSSProperties

const CONDITIONS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[8],
  width: '100%',
} satisfies CSSProperties

/** The book's pattern behind an over-slot loadout (`computeMechCapacity`'s `asPrinted`). */
type AsPrinted = { pattern: string; cite: string } | undefined

/**
 * An over-slot count is "as printed" when the loadout is a pattern the book
 * prints over its chassis's slots: the count is the book's, not a mistake.
 */
function overAsPrinted(used: number, max: number, asPrinted: AsPrinted): boolean {
  return asPrinted !== undefined && used > max
}

/**
 * A section's `SLOTS | used/max` chip, noted "as printed" (with its cite) when
 * an over-slot count is the book's; any other over-slot count is critical.
 */
function slotCount(used: number, max: number, asPrinted: AsPrinted): SlabCount {
  const printed = overAsPrinted(used, max, asPrinted) ? asPrinted : undefined
  if (printed) {
    return {
      label: 'Slots',
      value: used,
      max,
      note: 'as printed',
      title: `${printed.pattern}, ${printed.cite}`,
    }
  }
  return { label: 'Slots', value: used, max, ...(used > max ? { state: 'critical' } : {}) }
}

const PARTNERS = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
} satisfies CSSProperties

type MechSheetProps = {
  mech: Mech
  /**
   * Injectable chassis for testing. When omitted, resolved from
   * SalvageUnionReference.Chassis.find() via mech.chassisRef.
   */
  chassis?: ChassisLike | null
  /**
   * Injectable store — defaults to useEntityStore.
   * Pass a stub in tests to avoid Zustand side effects.
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
   * The viewer may not write `crawler`: a player's own mech in a Game, whose
   * crawler the Mediator keeps (ADR-038 §5). Closes The Hold's Stow and the
   * repair's scrap-pool deduction; the mech's own edits stay open.
   */
  crawlerReadOnly?: boolean
  /** The linked crawler's sheet: The Hold's stow target Token opens it. */
  crawlerHref?: string
  /**
   * The Assigned Units rail content (pilot + crawler rail row/RailEmpty), built
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
  crawlerReadOnly = false,
  crawlerHref,
  linkedUnits,
  pilotAbilities,
}: MechSheetProps) {
  const storeState = store()
  // Which collection's shared picker modal is open ('+ Add' — unified edit
  // language archetype B; always available, never rule-gated for now).
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
  // The conditions Read prints: the same merged list the Edit chips write.
  const readConditions = readOnly ? unifiedMechConditions(mech) : []

  const { chassis, cargo, capacity, spParts, epParts, heatParts, maxSP, maxEP, heatCap } = model

  function renderItems(kind: ItemKind, slugs: string[]) {
    const conditions = (kind === 'system' ? mech.systemConditions : mech.moduleConditions) ?? {}
    if (slugs.length === 0) {
      return (
        <EmptyState
          variant="quiet"
          body={kind === 'system' ? 'No systems installed.' : 'No modules installed.'}
        />
      )
    }
    // Keyed by occurrence, not index: removing one item must not remount (and
    // hand local state to) the items after it. See occurrenceKeys.
    const keys = occurrenceKeys(slugs)
    // One Token a line, each Peeking its whole card (owner's call, 2026-10-14).
    return (
      <ul
        aria-label={kind === 'system' ? 'Systems installed' : 'Modules installed'}
        className={readOnly ? 'su-entity-token-list' : 'su-entity-token-list su-sheet-items'}
      >
        {slugs.map((slug, index) => (
          <li key={keys[index]}>
            <MechItemToken
              slug={slug}
              entity={kind === 'system' ? resolveSystem(slug) : resolveModule(slug)}
              condition={conditions[slug] ?? 'intact'}
              usesRemaining={mech.itemUses?.[slug]}
              scrapPool={model.scrapPool}
              scrapPoolLocked={cargo.crawlerLocked}
              readOnly={readOnly}
              onStatusCycle={() => runWrite(() => actions.cycleItemCondition(kind, slug))}
              onUsesChange={(next) => runWrite(() => actions.setItemUses(slug, next))}
              onRepair={(deductTl, cost) => {
                runWrite(() => actions.repairItem(kind, slug, deductTl, cost))
              }}
              onRemove={
                readOnly
                  ? undefined
                  : () => {
                      actions.removeItem(kind, index)
                    }
              }
            />
          </li>
        ))}
      </ul>
    )
  }

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
          Unknown chassis &ldquo;{mech.chassisRef}&rdquo; — using stored/zero defaults
        </FieldError>
      )}

      {/* ===== Identity Band (Workshop-Manual mech sheet top region) =====
          Photo + the player's fields ∥ SP/EP/Heat + Conditions vitals rail. */}
      <SheetHero
        name={mech.name}
        fields={
          <>
            <PhotoBeside
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
                          useEntityStore
                            .getState()
                            .update('mech', mech.id, { photo }, LIVE_SHEET_MANUAL)
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
                      <Field
                        label="Quirk"
                        value={mech.quirk ?? ''}
                        onSave={readOnly ? undefined : actions.saveQuirk}
                        placeholder="No quirk recorded."
                      />
                    }
                  />

                  <MechProseFields
                    mech={mech}
                    saveAppearance={readOnly ? undefined : actions.saveAppearance}
                    saveDescription={readOnly ? undefined : actions.saveDescription}
                  />
                </div>
                <MechHeroChassis stats={model.chassisStats} abilities={model.chassisAbilities} />
              </div>
            </PhotoBeside>
            <div style={CHASSIS}>
              <MechChassisCard
                mech={mech}
                entity={model.chassisEntity}
                chassisName={model.chassisName}
                patch={readOnly ? undefined : actions.patchMech}
              />
            </div>
          </>
        }
        vitals={
          <div className="su-sheet-mech-vitals" style={VITALS}>
            <VitalGauge
              label="SP"
              subLabel="Structure"
              value={model.currentSP}
              max={maxSP}
              onChange={readOnly ? undefined : (v) => actions.patchMech({ currentSP: v })}
              onMaxChange={
                readOnly
                  ? undefined
                  : (next) => actions.overrideMechMax({ maxSpOverride: pinFor(next, spParts) })
              }
              breakdown={readOnly ? undefined : spParts}
              provenance={readOnly ? undefined : model.spLines}
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
                  : (next) => actions.overrideMechMax({ maxEpOverride: pinFor(next, epParts) })
              }
              breakdown={readOnly ? undefined : epParts}
              provenance={readOnly ? undefined : model.epLines}
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
                  : (next) => actions.overrideMechMax({ maxHeatOverride: pinFor(next, heatParts) })
              }
              breakdown={readOnly ? undefined : heatParts}
              provenance={readOnly ? undefined : model.heatLines}
              onRevertOverride={
                readOnly ? undefined : () => actions.overrideMechMax({ maxHeatOverride: undefined })
              }
              readOnly={readOnly}
            />
            {/* Read leaves an empty field out and draws no control: Conditions
                prints as chips only when there is one to read. */}
            {(!readOnly || readConditions.length > 0) && (
              <div style={CONDITIONS}>
                <Eyebrow tone="toneDeep">Conditions</Eyebrow>
                {readOnly ? (
                  <Conditions conditions={readConditions} />
                ) : (
                  <MechConditionsEditor mech={mech} store={store} />
                )}
              </div>
            )}
          </div>
        }
      />

      {/* ===== The Hold — ABOVE Systems & Modules =====
          Cargo is the thing a crew reaches for mid-session, and the printed
          sheet's bottom-of-page-2 placement buried it under two long loadout
          lists. It reads before them here. */}
      <SheetSectionSlab
        title="The Hold"
        count={{
          label: 'Slots',
          value: cargo.usage.used,
          max: cargo.usage.cap,
          ...(cargo.usage.used > cargo.usage.cap ? { state: 'critical' } : {}),
        }}
      >
        <StorageManifest
          side="mech"
          cargo={cargo}
          mechName={mech.name}
          crawlerName={crawler?.name ?? null}
          counterpartHref={crawlerHref}
          readOnly={readOnly}
        />
      </SheetSectionSlab>

      {/* ===== R3: Systems & Modules, side by side once there is room. ===== */}
      <div className="su-sheet-mech-loadout">
        <SheetSectionSlab
          title="Systems"
          count={slotCount(capacity.systemSlotsUsed, capacity.systemSlotsMax, capacity.asPrinted)}
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
          count={slotCount(capacity.moduleSlotsUsed, capacity.moduleSlotsMax, capacity.asPrinted)}
          controls={
            readOnly ? undefined : (
              <SectionManageButton label="modules" onClick={() => setPicker('module')} />
            )
          }
        >
          {renderItems('module', mech.modules)}
        </SheetSectionSlab>
      </div>

      {/* ===== Partners — drones this mech's CHASSIS ABILITY fields (Little
          Sestra's Sestra Drone, Big Brother's four). Its own region rather than
          a Assigned Units row: a partner is not a linked roster entity, it is part
          of this mech's own kit — and it renders full width because it carries a
          nested loadout and a hold. No crawler tech level is threaded: a
          mech-granted drone is fixed by its stat block and never tracks the
          Union Crawler, unlike a pilot's ability-granted partners. ===== */}
      {(mech.partners ?? []).length > 0 && (
        <SheetSectionSlab title="Partners">
          <div style={PARTNERS}>
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

      {/* ===== Assigned Units — the last region ===== (none in Read when
          nothing is linked: an empty slot is left out, as an empty field is) */}
      {linkedUnits && (
        <SheetSectionSlab
          id="linked-units"
          title="Assigned units"
          // Side by side: each linked unit is one roster row, and two of them
          // stack to a wasteful column on a sheet that has the width for both.
          bodyClassName="su-sheet-mech-linked"
        >
          {linkedUnits}
        </SheetSectionSlab>
      )}

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
          idOf={(item) => nameToSlug(item.name)}
          onAdd={(slug) => actions.addItem('system', slug)}
          onRemove={(index) => actions.removeItem('system', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel="Installed"
          emptyMessage="No systems match those filters."
          budget={[
            {
              label: overAsPrinted(
                capacity.systemSlotsUsed,
                capacity.systemSlotsMax,
                capacity.asPrinted
              )
                ? 'System Slots · as printed'
                : 'System Slots',
              used: capacity.systemSlotsUsed,
              max: capacity.systemSlotsMax,
            },
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
          idOf={(item) => nameToSlug(item.name)}
          onAdd={(slug) => actions.addItem('module', slug)}
          onRemove={(index) => actions.removeItem('module', index)}
          railName={mech.name || chassis?.name || mech.chassisRef || 'Mech'}
          chosenLabel="Installed"
          emptyMessage="No modules match those filters."
          budget={[
            {
              label: overAsPrinted(
                capacity.moduleSlotsUsed,
                capacity.moduleSlotsMax,
                capacity.asPrinted
              )
                ? 'Module Slots · as printed'
                : 'Module Slots',
              used: capacity.moduleSlotsUsed,
              max: capacity.moduleSlotsMax,
            },
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
