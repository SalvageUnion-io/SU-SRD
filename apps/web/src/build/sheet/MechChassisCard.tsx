/**
 * MechChassisCard — the mech sheet's CHASSIS callout, the sidebar's first
 * block under the vitals (2026-10-14: the hero is
 * the player's photo and what they wrote;
 * "Chassis has a reference" — a separate, smaller card with the chassis
 * description, in the house titled box the Starter Set and Shelves rows'
 * blocks share).
 *
 * A `TitledBox` in the chassis's tone: its name on the cut-out `Head` at the
 * head's left, in line with the text under it, with a
 * CHASSIS chip beside it (`Chips`), in Edit CHANGE
 * CHASSIS as a Mini chip at the band's end (its `controls`; destructive, it
 * keeps its own confirm step), and a paper body holding the chassis's art
 * (the Compact's `Art`; fixed: the player's photo is the hero's) and the
 * book's description. The mech's chassis stats and the chassis ability are in the
 * hero.
 */

import type { Mech } from 'game-domain/schemas/mech'
import type { ComponentProps, CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { toEntityModel } from 'salvageunion-reference'
import type { StatItem } from '../../components/index'
import { Art, Button, Chips, Content, Field, TitledBox, tokens } from '../../components/index'
import { MechChassisPickerModal } from '../mech/MechChassisPickerModal'
import type { MechSheetModel } from './mechSheet.model'
import type { SheetPatch } from './sheetViewProps.model'

/** The callout's one chip: a bare label, saying what the block is. */
const KIND: StatItem[] = [{ key: 'kind', label: 'Chassis', value: undefined }]

/** Its band: the one label-only cell, at the Compact Size of a Compact's head. */
const KIND_CHIPS = <Chips chips={{ durations: [], facts: KIND, tags: [] }} size="compact" />

/** The body's block: its prose wraps the art floated at its left. */
const BODY = { display: 'flow-root' } satisfies CSSProperties

/** The art at a Compact's art width, the prose wrapping it. */
const ART = {
  float: 'left',
  marginBottom: tokens.space[4],
  marginRight: tokens.space[12],
  width: '6rem',
} satisfies CSSProperties

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
      <TitledBox
        as="section"
        title={chassisName}
        label="Chassis"
        tone={model.tone}
        chips={KIND_CHIPS}
        controls={
          patch && (
            <Button variant="default" size="mini" onClick={() => setPickerOpen(true)}>
              Change Chassis
            </Button>
          )
        }
      >
        <div style={BODY}>
          {model.art && (
            <div style={ART}>
              <Art art={model.art} />
            </div>
          )}
          {entity?.content && entity.content.length > 0 && (
            <Content
              body={entity.content as ComponentProps<typeof Content>['body']}
              fontSize="sm"
              chassisName={chassisName}
            />
          )}
        </div>
      </TitledBox>
      {picker}
    </>
  )
}
