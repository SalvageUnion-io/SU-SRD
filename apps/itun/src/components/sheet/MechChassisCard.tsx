/**
 * MechChassisCard — the mech sheet's CHASSIS card: the chassis's own reference
 * card, under the hero (owner's calls, 2026-10-14: the hero is the player's
 * photo and what they wrote; "Chassis has a reference" — a separate, smaller
 * card with the chassis description and the standard cut-out card header).
 *
 * It is the reference `ReferenceEntityCard` at `small`, so it carries the
 * book's art (fixed: the player's photo is the hero's), description, stats and
 * stats exactly as every other chassis card does. Three sheet differences: the
 * stats are the mech's derived figures (`statsOverride`, as `PartnerCard`
 * does), the chassis ability is a Peek Token, and the patterns list is hidden. Edit adds a "Change
 * Chassis" control; swapping is destructive and keeps its own confirm step.
 */

import { Entity, Field, ReferenceEntityCard } from 'component-lib'
import type { Mech } from 'itun-domain/schemas/mech'
import { useState } from 'react'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import type { MechSheetModel } from './mechSheet.model'
import type { SheetPatch } from './sheetViewProps.model'

type MechChassisCardProps = {
  mech: Mech
  /** The chassis's reference entry; null shows only the (picker-backed) name. */
  entity: MechSheetModel['chassisEntity']
  /** Resolved chassis display name (falls back to the raw ref upstream). */
  chassisName: string
  stats: MechSheetModel['chassisStats']
  abilities: MechSheetModel['chassisAbilities']
  /** Partial merge on this mech; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
}

export function MechChassisCard({
  mech,
  entity,
  chassisName,
  stats,
  abilities,
  patch,
}: MechChassisCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  /** Confirmed chassis swap — destructive: clears the installed loadout. */
  function changeChassis(chassisRef: string) {
    patch?.({ chassisRef, systems: [], modules: [] })
  }

  return (
    <section aria-label="Chassis">
      {entity ? (
        <ReferenceEntityCard
          data={entity}
          size="small"
          statsOverride={stats}
          hide={{ patterns: true }}
          // The chassis ability as a Peek Token, as every sheet reference is
          // (owner's call, 2026-10-14); spending its EP is the Dashboard's.
          afterExtraContent={
            abilities.length > 0 ? (
              <ul aria-label="Chassis ability" className="su-entity-token-list">
                {abilities.map((ability) => (
                  <li key={ability.id}>
                    <Entity form="token" entity={ability} />
                  </li>
                ))}
              </ul>
            ) : undefined
          }
          controls={
            patch
              ? [
                  {
                    key: 'change-chassis',
                    label: 'Change Chassis',
                    onClick: () => setPickerOpen(true),
                  },
                ]
              : undefined
          }
        />
      ) : (
        <Field
          label="Chassis"
          value={chassisName}
          onEditClick={patch ? () => setPickerOpen(true) : undefined}
        />
      )}

      <MechChassisPickerModal
        open={pickerOpen}
        currentChassisRef={mech.chassisRef}
        onOpenChange={setPickerOpen}
        onConfirm={changeChassis}
      />
    </section>
  )
}
