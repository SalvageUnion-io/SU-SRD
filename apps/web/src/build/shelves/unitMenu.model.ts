/**
 * A unit row's ⋯ menu on the Training Bay (pilot, mech, crawler, NPC): Open,
 * Move to a Game…, Rename…, Save as pattern, Export and Delete; its Copy is
 * the row's own button (`copyNow`, r6 E9).
 * A verb that takes something away asks first through the page's one confirm,
 * except a Training Bay Mech's delete, whose notice undoes it (r6 E3).
 */
import type { EntityKind } from 'game-domain/entityKinds'
import { pilotLabel } from 'game-domain/pilotLabel'
import type { Pilot } from 'game-domain/schemas/pilot'
import type { HeaderMenuItem } from '../../components/index'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { copyAsking, keptMech } from '../../lib/copiedToast'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { buildExportCopy } from '../../messages/build-export'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { LIVE_SHEET_MANUAL } from '../../replica/provenance'
import { useUnits } from '../../replica/units'
import { deleteMechs } from '../mech/deleteMech.model'
import { npcDeleteConfirm } from '../npc/redesign.model'
import type { MoveSubject } from './MoveToGameDialog'
import type { RenameSubject } from './shelfMenu.model'
import { deleteItem, renameItem } from './shelfMenu.model'
import { showShelfRow } from './shelfRow.model'

export type UnitMenuHost = {
  go: (href: string) => void
  confirm: Confirm
  canWrite: boolean
  /** Moves need the server's list of Games. */
  live: boolean
  pilots: readonly Pilot[]
  encounters: Parameters<typeof npcDeleteConfirm>[1]
  move: (subject: MoveSubject) => void
  rename: (subject: RenameSubject) => void
  savePattern: (mechId: string) => void
  exportUnit: (type: EntityKind, id: string, name: string, mech?: string) => void
}

type Unit = { id: string; name: string; gameId?: string | null }

/** A mech's Rename…: its one name. */
export const mechRename = (unit: { id: string; name: string }): RenameSubject => ({
  name: unit.name,
  label: buildShelvesCopy('mechName'),
  save: (name) => useUnits.getState().update('mech', unit.id, { name }, LIVE_SHEET_MANUAL),
})

/** A pilot's Rename…: its callsign and its name, the two it goes by (r4 E20). */
export const pilotRename = (pilot: Pilot): RenameSubject => ({
  title: pilotLabel(pilot),
  name: pilot.callsign,
  label: buildShelvesCopy('callsign'),
  also: { name: pilot.name, label: buildShelvesCopy('pilotName') },
  save: (callsign, name) =>
    useUnits
      .getState()
      .update('pilot', pilot.id, { callsign, name: name ?? pilot.name }, LIVE_SHEET_MANUAL),
})

/** Delete these Training Bay Mechs at once: one notice, one Undo (r6 E3). */
export function deleteMechsNow(mechs: readonly { id: string; name: string }[]): void {
  deleteMechs(mechs.map((m) => m.id)).catch((err) => {
    toast.error(
      failureMessage(err, buildShelvesCopy('mechNotDeleted', { name: mechs[0]?.name ?? '' }))
    )
  })
}

/** Export; a pilot's takes the Mech they fly, and says so (r6 E17). */
function exportItem(type: EntityKind, unit: Unit, host: UnitMenuHost): HeaderMenuItem {
  const mech = keptMech(type, unit.id)
  return {
    id: 'export',
    label: mech
      ? buildExportCopy('exportWith', { name: unit.name, mech })
      : buildExportCopy('export'),
    onSelect: () => host.exportUnit(type, unit.id, unit.name, mech),
  }
}

/** The delete: an NPC's confirm names its encounters; a Training Bay Mech asks nothing. */
function deleteOf(type: EntityKind, unit: Unit, host: UnitMenuHost): HeaderMenuItem {
  const { confirm } = host
  const inGame = typeof unit.gameId === 'string'
  const undoable = type === 'mech' && !inGame
  const run = () =>
    type === 'npc'
      ? // An NPC is its maker's alone: the confirm names the encounters it leaves (MD3-08).
        confirm(npcDeleteConfirm(unit, host.encounters))
      : undoable
        ? deleteMechsNow([unit])
        : confirm({
            ...(inGame
              ? ROW_ACTION_COPY.deleteFromGame(unit.name, keptMech(type, unit.id))
              : ROW_ACTION_COPY.deleteBuild(unit.name, keptMech(type, unit.id))),
            onConfirm: () => useUnits.getState().delete(type, unit.id),
          })
  return deleteItem(host.canWrite ? run : undefined, undoable)
}

/**
 * The row's Copy (r6 E9): one press makes it (a pilot with a Mech is asked
 * whether the Mech comes too), its line is brought into view, and a pilot's or
 * a Mech's copy opens in Rename with its name selected (`Crusher 2`), so
 * typing names it and Escape keeps it.
 */
export function copyNow(
  type: EntityKind,
  unit: Unit,
  copyBody: Record<string, unknown>,
  host: Pick<UnitMenuHost, 'confirm' | 'go' | 'rename'>
): void {
  void copyAsking(host.confirm, type, unit.name, copyBody, host.go, {
    landed: (id) => {
      showShelfRow(type, id)
      const units = useUnits.getState()
      const mech = type === 'mech' ? units.get('mech', id) : null
      const pilot = type === 'pilot' ? units.get('pilot', id) : null
      if (mech) host.rename(mechRename(mech))
      if (pilot) host.rename(pilotRename(pilot))
    },
  })
}

export function unitMenuOf(type: EntityKind, unit: Unit, host: UnitMenuHost): HeaderMenuItem[][] {
  const { canWrite, go } = host
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)
  return [
    [
      { id: 'open', label: 'Open', onSelect: () => go(`/${type}s/${unit.id}`) },
      {
        id: 'move',
        label: buildShelvesCopy('moveToAGame'),
        onSelect:
          canWrite && host.live ? () => host.move({ type, id: unit.id, entity: unit }) : undefined,
      },
      ...(type === 'pilot'
        ? host.pilots
            .filter((p) => p.id === unit.id)
            .map((p) => renameItem(pilotRename(p), canWrite ? host.rename : undefined))
        : []),
      ...(type === 'mech'
        ? [
            renameItem(mechRename(unit), canWrite ? host.rename : undefined),
            {
              id: 'pattern',
              label: buildShelvesCopy('saveAsPattern'),
              onSelect: writable(() => host.savePattern(unit.id)),
            },
          ]
        : []),
      exportItem(type, unit, host),
    ],
    [deleteOf(type, unit, host)],
  ]
}
