/**
 * MechSheet — the mech body for the LiveSheet shell.
 *
 * One layout in Read and Edit (R11): the dashboard (`MechDash`), its masthead
 * the vitals, the figures and who the mech is, then Systems and Modules, the
 * chassis ability, Cargo and the units it is assigned to. Edit adds its
 * controls in place; Read withdraws them, as a sheet the viewer cannot write
 * does, and `live` keeps the vitals live in Read for whoever may write it.
 * The drones its chassis fields are cards under the dashboard in Edit, where
 * their loadouts are fitted; Read links each companion's own sheet.
 *
 * This file is the render; `mechSheet.model.ts` derives and
 * `mechSheetActions.model.ts` writes. Which picker is open is render state.
 */

import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { FieldError, SlabSection, Stack, tokens } from '../../components/index'
import { SoftWarningDialog } from '../../components/shared/SoftWarningDialog'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { MechDash } from '../dash/MechDash'
import { MechSheetPickers } from './MechSheetPickers'
import type { ChassisLike } from './mechSheet.model'
import { useMechSheetModel } from './mechSheet.model'
import type { ItemKind } from './mechSheetActions.model'
import { useMechSheetActions } from './mechSheetActions.model'
import { PartnerCard } from './PartnerCard'
import { usePhone } from './usePhone'

/** The sheet column: an inline-size container (the poster regions query it). */
const SHEET = {
  containerType: 'inline-size',
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[24],
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
  const phone = usePhone()
  const partners = !readOnly && (mech.partners ?? []).length > 0 && (
    // The drones this mech's CHASSIS ABILITY fields (Little Sestra's Sestra
    // Drone, Big Brother's four): part of its own kit, each a card with its
    // nested loadout and hold, where Edit fits them. A mech-granted drone is
    // fixed by its stat block and never tracks the Union Crawler.
    <SlabSection fold="open" title={buildSheetCopy('partners')}>
      <Stack gap={12}>
        {(mech.partners ?? []).map((partner) => (
          <div key={partner.id} id={`partner-${partner.id}`} className="su-partner-anchor">
            <PartnerCard
              found={{ partner, hostKind: 'mech', host: mech }}
              fielded={(mech.partners ?? []).filter((p) => p.hostRef === partner.hostRef).length}
              readOnly={readOnly}
              store={store}
            />
          </div>
        ))}
      </Stack>
    </SlabSection>
  )

  return (
    <section
      aria-labelledby="mech-sheet-heading"
      // `.su-sheet-section` is a print-stylesheet target (page-break rules).
      className="su-sheet-section"
      style={SHEET}
    >
      {/* The band already shows the name — this heading is for a11y/print. */}
      <h2 id="mech-sheet-heading" className="su-sr-only">
        {mech.name}
      </h2>

      {!model.chassis && (
        <FieldError>
          {buildSheetCopy('unknownChassisUsingStoredZero', { chassisRef: mech.chassisRef })}
        </FieldError>
      )}

      <MechDash
        mech={mech}
        model={model}
        actions={actions}
        live={live}
        edit={!readOnly}
        onManage={setPicker}
        store={store}
        crawler={crawler}
        linkedUnits={linkedUnits}
        partners={partners || undefined}
        phone={phone}
      />

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
