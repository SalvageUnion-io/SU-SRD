/**
 * MechChassisCard — the mech sheet's CHASSIS card: everything the sheet reads
 * off the chassis, in its own small framed card under the hero (owner's call,
 * 2026-10-14: the hero is the photo and what the player wrote; the chassis is
 * "a separate card … smaller, isolated and contained").
 *
 * Three things, in reading order: the chassis's name (picker-backed — swapping
 * it is destructive and keeps its own confirm step), the Chassis Stats as
 * compact cells (`StatColumn compact`), and the chassis ability as a Token
 * that Peeks its card ("all references = peek tokens"; spending its EP is the
 * Dashboard's, ADR-021).
 */

import { Entity, Field, SheetSectionCard, StatColumn, tokens } from 'component-lib'
import type { Mech } from 'itun-domain/schemas/mech'
import type { CSSProperties } from 'react'
import { useState } from 'react'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import type { MechSheetModel } from './mechSheet.model'
import type { SheetPatch } from './sheetViewProps.model'

const STACK = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[12],
  minWidth: 0,
} satisfies CSSProperties

type MechChassisCardProps = {
  mech: Mech
  /** Resolved chassis display name (falls back to the raw ref upstream). */
  chassisName: string
  stats: MechSheetModel['chassisStats']
  abilities: MechSheetModel['chassisAbilities']
  /** Partial merge on this mech; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
  /** `paper` is the printed read state; `frame` the Edit state's card. */
  surface?: 'frame' | 'paper'
}

export function MechChassisCard({
  mech,
  chassisName,
  stats,
  abilities,
  patch,
  surface = 'frame',
}: MechChassisCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  /** Confirmed chassis swap — destructive: clears the installed loadout. */
  function changeChassis(chassisRef: string) {
    patch?.({ chassisRef, systems: [], modules: [] })
  }

  return (
    <SheetSectionCard title="Chassis" surface={surface}>
      <div style={STACK}>
        <Field
          label="Chassis"
          value={chassisName}
          onEditClick={patch ? () => setPickerOpen(true) : undefined}
        />
        <StatColumn stats={stats} label="Chassis stats" compact />
        {abilities.length > 0 && (
          <ul aria-label="Chassis ability" className="su-entity-token-list">
            {abilities.map((ability) => (
              <li key={ability.id}>
                <Entity form="token" entity={ability} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <MechChassisPickerModal
        open={pickerOpen}
        currentChassisRef={mech.chassisRef}
        onOpenChange={setPickerOpen}
        onConfirm={changeChassis}
      />
    </SheetSectionCard>
  )
}
