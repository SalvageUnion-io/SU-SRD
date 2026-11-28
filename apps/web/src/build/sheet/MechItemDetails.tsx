/**
 * MechItemDetails — the Details control of an installed System or Module that
 * asks a choice (a turret's weapon, a body kit's fitting). It opens the item's
 * Page (E5, C8), where the options are chosen, and saves them on the
 * mech by the item's slug (`Mech.itemChoices`), where Play reads them.
 */

import { useState } from 'react'
import type { ChoiceSelections, RefMetaEntity } from 'salvageunion-reference'
import { Button, EntityDetailDialog, ReferenceEntityCard } from '../../components/index'
import { useEntityChoices } from '../../components/shared/useEntityChoices'
import type { MechItem } from '../../lib/rules/mechItems'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { UnitsStore } from '../../replica/units'

export type MechItemChoices = {
  /** The owning mech: the options are saved on it. */
  mechId: string
  /** The options saved so far for this item (`mech.itemChoices[slug]`). */
  seed: ChoiceSelections | undefined
  /** Injectable store, forwarded to `useEntityChoices`. */
  store: UnitsStore
}

type MechItemDetailsProps = MechItemChoices & {
  slug: string
  entity: MechItem
}

export function MechItemDetails({ slug, entity, mechId, seed, store }: MechItemDetailsProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button
        variant="pencil"
        size="mini"
        aria-label={buildSheetCopy('itemDetails', { name: entity.name })}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        {buildSheetCopy('details')}
      </Button>
      <MechItemChoiceDialog
        open={open}
        onOpenChange={setOpen}
        slug={slug}
        entity={entity}
        mechId={mechId}
        seed={seed}
        store={store}
      />
    </>
  )
}

/**
 * The item's Page with its options to choose: what Details opens, and what
 * the install picker opens as soon as an item that asks a choice is added.
 */
export function MechItemChoiceDialog({
  open,
  onOpenChange,
  slug,
  entity,
  mechId,
  seed,
  store,
}: MechItemDetailsProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { selections, setSelections } = useEntityChoices(
    'mech',
    mechId,
    slug,
    'itemChoices',
    seed,
    store
  )
  return (
    <EntityDetailDialog
      open={open}
      onOpenChange={onOpenChange}
      entity={entity as RefMetaEntity}
      title={entity.name}
    >
      <ReferenceEntityCard
        data={entity}
        presentation="page"
        selections={selections}
        onSelectionChange={setSelections}
      />
    </EntityDetailDialog>
  )
}
