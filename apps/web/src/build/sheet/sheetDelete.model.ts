/**
 * The sheet ⋯ menu's Delete. A Training Bay Mech asks nothing: its notice
 * undoes it (r5 D9, r6 E3). Anything else asks first through the page's one
 * confirm, which names a pilot's Mech or the Game it leaves.
 */
import type { SheetKind } from 'game-domain/entityKinds'
import type { HeaderMenuItem } from '../../components/index'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { keptMech } from '../../lib/copiedToast'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { buildSheetCopy } from '../../messages/build-sheet'
import { libGamesCopy } from '../../messages/lib-games'

type Units = NonNullable<Parameters<typeof keptMech>[2]>

export function sheetDeleteItem(
  sheet: { kind: SheetKind; id: string; name: string; inGame: boolean },
  units: Units,
  confirm: Confirm,
  leave: () => void,
  writable: (run: () => void) => (() => void) | undefined
): HeaderMenuItem {
  const { kind, id, name, inGame } = sheet
  const undoable = kind === 'mech' && !inGame
  const run = () =>
    undoable
      ? void import('../mech/deleteMech.model')
          .then((m) => m.deleteMech(id))
          .then(leave, (err) =>
            toast.error(failureMessage(err, libGamesCopy('deleteFailed', { name })))
          )
      : confirm({
          ...(inGame
            ? ROW_ACTION_COPY.deleteFromGame(name, keptMech(kind, id, units))
            : ROW_ACTION_COPY.deleteBuild(name, keptMech(kind, id, units))),
          onConfirm: async () => {
            await units.delete(kind, id)
            leave()
          },
        })
  return {
    id: 'delete',
    label: buildSheetCopy(undoable ? 'deleteNow' : 'delete'),
    tone: 'danger',
    onSelect: writable(run),
  }
}
