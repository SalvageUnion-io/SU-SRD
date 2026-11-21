/**
 * The sheet's row controls (C8, R11): what Edit adds to a line, in place,
 * wherever the line is drawn (a Ledger row on the dashboard, `SheetItemLine`'s
 * chip group on a Mini): the condition's stepper, Uses, a piece of equipment's
 * Details and the one remove control. Read draws none of them.
 */

import type { ItemCondition } from 'game-domain/schemas/itemCondition'
import { X } from 'lucide-react'
import { useState } from 'react'
import type { RefMetaEntity } from 'salvageunion-reference'
import type { ChoiceSelections } from '../../components/index'
import {
  Button,
  EntityDetailDialog,
  ReferenceEntityCard,
  Stat,
  StatusBadge,
  tokens,
} from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'

/** The condition's stepper, its next condition named on it (Intact → Damaged → Destroyed). */
export function ConditionStep({
  name,
  condition,
  onCycle,
  next,
}: {
  name: string
  condition: ItemCondition
  onCycle?: (() => void) | undefined
  /** Where the step goes when it is not the next of three (a bay: Intact ↔ Damaged). */
  next?: ItemCondition | undefined
}) {
  return (
    <span className="su-sheet-item__condition">
      <StatusBadge
        status={condition}
        subject={name}
        onClick={onCycle}
        {...(next ? { next } : {})}
      />
    </span>
  )
}

/** Uses left out of a max, `[USES | 3/5] − +`, with a polite line for each change. */
export function UsesStep({
  name,
  remaining,
  max,
  onChange,
}: {
  name: string
  remaining: number
  max: number
  onChange: (next: number) => void
}) {
  return (
    <>
      <Stat
        label={buildSheetCopy('uses')}
        value={remaining}
        max={max}
        size="mini"
        mode="edit"
        onChange={onChange}
        stepperLabel={`${name} uses`}
        className="su-sheet-item__uses"
      />
      <span role="status" aria-live="polite" className="su-sr-only">
        {buildSheetCopy('uses2', { name, remaining })}
      </span>
    </>
  )
}

/**
 * The Live Sheet's one remove control (hard rule R11): a square ✕ at the
 * line's Size, its target 24px (WCAG 2.5.8), named "Remove <name>". Every
 * sheet item, unknown item, inventory entry and mounted weapon removes
 * through it, Edit only.
 */
export function SheetRemoveButton({ name, onRemove }: { name: string; onRemove: () => void }) {
  return (
    <Button
      variant="pencil"
      size="mini"
      className="su-sheet-item__remove"
      aria-label={buildSheetCopy('remove', { name })}
      onClick={onRemove}
    >
      <X aria-hidden="true" size={tokens.iconSize.mini} />
    </Button>
  )
}

type EquipmentChoiceProps = {
  slug: string
  equipment: RefMetaEntity & { name: string }
  pilotId: string
  seed: ChoiceSelections | undefined
  scalingParent: Record<string, unknown> | undefined
  store: UnitsStore
}

/**
 * A piece of equipment that asks a choice: Details opens its Page (E5, C8),
 * where the choices are made and saved on the pilot (`equipmentChoices`).
 */
export function EquipmentDetails(props: EquipmentChoiceProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="pencil"
        size="mini"
        aria-label={buildSheetCopy('itemDetails', { name: props.equipment.name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {buildSheetCopy('details')}
      </Button>
      <EquipmentChoiceDialog open={open} onOpenChange={setOpen} {...props} />
    </>
  )
}

/**
 * The equipment's Page with its choices to make: what Details opens, and what
 * the equipment picker opens as soon as an item that asks a choice is added.
 */
export function EquipmentChoiceDialog({
  open,
  onOpenChange,
  slug,
  equipment,
  pilotId,
  seed,
  scalingParent,
  store,
}: EquipmentChoiceProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { selections, setSelections } = useEntityChoices(
    'pilot',
    pilotId,
    slug,
    'equipmentChoices',
    seed,
    store
  )
  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      entity={equipment}
      title={equipment.name}
    >
      <ReferenceEntityCard
        data={equipment as never}
        presentation="page"
        selections={selections}
        onSelectionChange={setSelections}
        scalingParent={scalingParent}
      />
    </EntityDetailDialog>
  )
}
