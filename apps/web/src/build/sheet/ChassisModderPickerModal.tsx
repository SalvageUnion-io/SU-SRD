/**
 * ChassisModderPickerModal — Chassis Modder's pick (Core Book p.64): the one
 * Chassis Ability a Fabricator adds to their mech, from the chassis their
 * Crafting Bay could craft. The shared `EntitySearcher` in a bare ModalShell,
 * single-select: picking the added one again clears it, and Apply then
 * removes it. Not destructive, so no confirm step.
 */

import { useEffect, useState } from 'react'
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
  /** Fired with the new pick, or null to remove the added ability. */
  onApply: (slug: string | null) => void
}

export function ChassisModderPickerModal({
  open,
  onOpenChange,
  options,
  current,
  onApply,
}: ChassisModderPickerModalProps) {
  const [selected, setSelected] = useState<string | null>(current)

  useEffect(() => {
    if (open) setSelected(current)
  }, [open, current])

  const allowed = new Set(options)

  function apply() {
    if (selected !== current) onApply(selected)
    onOpenChange(false)
  }

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
        selected={selected ? [selected] : []}
        onToggle={(ref) => setSelected((prev) => (prev === ref ? null : ref))}
        idOf={(item) => nameToSlug(item.name)}
        filter={(item) => allowed.has(nameToSlug(item.name))}
        facets={{ status: false }}
        chosenLabel={buildSheetCopy('added')}
        title={buildSheetCopy('chassisModder')}
        subtitle={buildSheetCopy('chassisModderSubtitle')}
        emptyMessage={buildSheetCopy('noMatchingChassisAbilities')}
        onClose={() => onOpenChange(false)}
        railActions={
          <>
            <Button variant="ghost" size="compact" onClick={() => onOpenChange(false)}>
              {buildSheetCopy('cancelChassisAbility')}
            </Button>
            <Button size="compact" disabled={selected === current} onClick={apply}>
              {buildSheetCopy('applyChassisAbility')}
            </Button>
          </>
        }
      />
    </ModalShell>
  )
}
