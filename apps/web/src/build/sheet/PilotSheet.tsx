/**
 * PilotSheet — the pilot body for the LiveSheet shell.
 *
 * One layout in Read and Edit (R11): the dashboard (`PilotDash`), the
 * masthead's vitals, identity and portrait, then the trees on their tracks,
 * the Generic abilities and Inventory; its companions are in Related units
 * (R70), and Edit fits them under the dashboard. Edit adds its
 * controls in place (the identity's fields, the photo, each row's stepper,
 * Uses, Details and ✕, Manage); Read withdraws them, as a sheet the viewer
 * cannot write does. `live` keeps HP, AP and TP live in Read for whoever may
 * write the sheet.
 *
 * This file is the render; `pilotSheet.model.ts` derives, and
 * `pilotSheetActions.model.ts` writes, each through one `write()` that reads
 * the freshest record. Which picker is open is render state, kept here.
 */

import { pilotLabel } from 'game-domain/pilotLabel'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { MiniGrid, SlabSection, tokens } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'
import { useUnits } from '../../replica/units'
import { PilotDash } from '../dash/PilotDash'
import { PartnerMini } from './PartnerMini'
import type { PilotPicker } from './PilotSheetPickers'
import { PilotSheetPickers } from './PilotSheetPickers'
import { usePilotSheetModel } from './pilotSheet.model'
import { usePilotSheetActions } from './pilotSheetActions.model'
import { usePhone } from './usePhone'

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
  // Which collection's picker is open (Manage; Free Edit, not rule-gated, ADR-021).
  const [picker, setPicker] = useState<PilotPicker | null>(null)

  const model = usePilotSheetModel({ pilot, storeState, picker })
  const actions = usePilotSheetActions({
    pilot,
    store,
    storeState,
    crawlerTechLevel: model.effectiveCrawlerLevel,
  })
  const phone = usePhone()
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
      aria-label={buildSheetCopy('pilotDetails', { name: pilotLabel(pilot) })}
      // `.su-sheet-section` is a print-stylesheet target (page-break rules).
      className="su-sheet-section"
      style={BODY}
    >
      <PilotDash
        pilot={pilot}
        model={model}
        actions={actions}
        live={live}
        edit={!readOnly}
        onManage={setPicker}
        store={store}
        linkedUnits={linkedUnits}
        phone={phone}
      />
      {/* Read reaches a companion from Related units (R70); Edit fits it here. */}
      {!readOnly && companions(true)}

      <PilotSheetPickers
        picker={picker}
        onClose={() => setPicker(null)}
        pilot={pilot}
        model={model}
        actions={actions}
        store={store}
      />
    </section>
  )
}
