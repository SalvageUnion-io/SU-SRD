/**
 * MechChassisCard — the mech sheet's CHASSIS callout, the hero's foot (owner's
 * calls, 2026-10-14: the hero is the player's photo and what they wrote;
 * "Chassis has a reference" — a separate, smaller card with the chassis
 * description, in the standard Info Cutout block the Starter Set and Shelves
 * rows wear).
 *
 * `InfoCutout` in the chassis's tone: its art column (fixed: the player's
 * photo is the hero's), its name on the cut-out with a CHASSIS chip beside it
 * (owner's call, 2026-10-14), and a paper body holding the
 * book's description and — in Edit — CHANGE CHASSIS (destructive; it keeps its
 * own confirm step). The mech's chassis stats and the chassis ability are in
 * the hero (owner's call, 2026-10-14).
 */

import type { Mech } from 'cantina-domain/schemas/mech'
import type { ComponentProps, CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import type { StatItem } from '../index'
import { Button, Content, Field, InfoCutout } from '../index'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import type { MechSheetModel } from './mechSheet.model'
import type { SheetPatch } from './sheetViewProps.model'

const CONTROLS = { display: 'flex', justifyContent: 'flex-end' } satisfies CSSProperties

/** The callout's one chip: a bare label, saying what the block is. */
const KIND: StatItem[] = [{ key: 'kind', label: 'Chassis', value: undefined }]

type MechChassisCardProps = {
  mech: Mech
  /** The chassis's reference entry; null shows only the (picker-backed) name. */
  entity: MechSheetModel['chassisEntity']
  /** Resolved chassis display name (falls back to the raw ref upstream). */
  chassisName: string
  /** Partial merge on this mech; omit on read-only sheets (no edit affordance). */
  patch?: SheetPatch
}

export function MechChassisCard({ mech, entity, chassisName, patch }: MechChassisCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const model = useMemo(() => (entity ? toEntityModel(entity) : undefined), [entity])

  /** Confirmed chassis swap — destructive: clears the installed loadout. */
  function changeChassis(chassisRef: string) {
    patch?.({ chassisRef, systems: [], modules: [] })
  }

  const picker = (
    <MechChassisPickerModal
      open={pickerOpen}
      currentChassisRef={mech.chassisRef}
      onOpenChange={setPickerOpen}
      onConfirm={changeChassis}
    />
  )

  if (!model) {
    return (
      <section aria-label="Chassis">
        <Field
          label="Chassis"
          value={chassisName}
          onEditClick={patch ? () => setPickerOpen(true) : undefined}
        />
        {picker}
      </section>
    )
  }

  return (
    <>
      <InfoCutout
        title={chassisName}
        label="Chassis"
        fill={model.tone}
        art={model.art}
        facts={KIND}
      >
        {entity?.content && entity.content.length > 0 && (
          <Content
            body={entity.content as ComponentProps<typeof Content>['body']}
            fontSize="sm"
            chassisName={chassisName}
          />
        )}
        {patch && (
          <div style={CONTROLS}>
            <Button variant="default" onClick={() => setPickerOpen(true)}>
              Change Chassis
            </Button>
          </div>
        )}
      </InfoCutout>
      {picker}
    </>
  )
}
