/**
 * ChassisModderPickerModal — Chassis Modder's pick (Core Book p.64): the one
 * Chassis Ability a Fabricator adds to their mech, from the chassis their
 * Crafting Bay could craft. The shared `EntitySearcher` in a bare ModalShell,
 * single-select: Choose on an ability's Page adds it (replacing the one added)
 * and closes. Not destructive, so no confirm.
 */

import { nameToSlug } from 'salvageunion-reference'
import { Button, EntitySearcher, ModalShell } from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'

type ChassisModderPickerModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The Chassis Ability slugs the Fabricator may add. */
  options: readonly string[]
  /** The one added now, or null. */
  current: string | null
  /** Fired with the new pick (null would remove the added ability; the picker never sends it). */
  onApply: (slug: string | null) => void
}

export function ChassisModderPickerModal({
  open,
  onOpenChange,
  options,
  current,
  onApply,
}: ChassisModderPickerModalProps) {
  const allowed = new Set(options)

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={buildSheetCopy('chassisModder')}
      width="page"
      bare
    >
      <EntitySearcher
        schema="actions"
        mode="single"
        selected={current ? [current] : []}
        // Choose is the one confirming press (r2 G3).
        onToggle={(ref) => {
          if (ref !== current) onApply(ref)
          onOpenChange(false)
        }}
        idOf={(item) => nameToSlug(item.name)}
        filter={(item) => allowed.has(nameToSlug(item.name))}
        facets={{ status: false }}
        chosenLabel={buildSheetCopy('added')}
        title={buildSheetCopy('chassisModder')}
        subtitle={buildSheetCopy('chassisModderSubtitle')}
        emptyMessage={buildSheetCopy('noMatchingChassisAbilities')}
        onClose={() => onOpenChange(false)}
        railActions={
          <Button variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
            {buildSheetCopy('cancelChassisAbility')}
          </Button>
        }
      />
    </ModalShell>
  )
}
