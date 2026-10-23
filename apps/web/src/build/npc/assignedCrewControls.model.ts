/**
 * A crew slot's assigned NPC card's controls (C8, hard rule R6): Open, to its
 * sheet, and, where the session may write, Unassign. They are the card's own
 * controls, never a line under it.
 */

import type { ReferenceEntityControl } from '../../components/index'
import { toast } from '../../components/index'
import { runWrite } from '../../lib/runWrite'
import { useEntityStore } from '../../stores/entityStore'

/**
 * Take the link off a crew slot. No confirm: it is reversible bookkeeping, and
 * the inline crew and the NPC both survive (D8, ADR-007).
 */
export function unassignCrew(linkId: string, slotName: string, onDone: () => void): void {
  runWrite(
    () => useEntityStore.getState().delete('softLink', linkId),
    () => {
      toast.success(`${slotName} is back to the book’s crew line.`)
      onDone()
    }
  )
}

export function assignedCrewControls(
  npc: { id: string; name: string },
  unassign?: { label: string; onClick: () => void }
): ReferenceEntityControl[] {
  const open: ReferenceEntityControl = {
    key: 'open',
    href: `/npcs/${npc.id}`,
    label: 'Open',
    ariaLabel: `Open ${npc.name}`,
  }
  if (!unassign) return [open]
  return [
    open,
    {
      key: 'unassign',
      label: 'Unassign',
      ariaLabel: unassign.label,
      variant: 'ghost',
      onClick: unassign.onClick,
    },
  ]
}
