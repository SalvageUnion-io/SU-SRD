/**
 * A saved pattern's ⋯ menu on its shelf: open, rename, copy, export, and its
 * delete. Build With This is the row's own button (`buildFromPattern`, r3 L5).
 */
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { HeaderMenuItem } from '../../components/index'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { refreshWorkerReads } from '../../lib/connection/workerRead'
import { copyPattern } from '../../lib/copiedToast'
import { buildPatternExport } from '../../lib/export/buildExportBundle'
import { downloadJson, exportFileName } from '../../lib/export/downloadJson'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { mechFromPattern, pastStartingRules, savedPatternHref } from '../../lib/patterns/patterns'
import { sharedPaths } from '../../lib/sharing/paths'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { usePatterns } from '../../replica/collections'
import { useUnits } from '../../replica/units'
import { builtToast, deletePatternLines, mechNamesTaken } from '../mech/Pattern/buildConfirm.model'
import type { RenameSubject } from './shelfMenu.model'
import { deleteItem, renameItem } from './shelfMenu.model'

/**
 * Build With This, a pattern row's one act: one press builds the mech and you
 * land on it, its notice carrying Undo (r4 E23). Undefined where no write
 * could land.
 */
export function buildFromPattern(
  pattern: MechPattern,
  { go, canWrite }: { go: (href: string) => void; canWrite: boolean }
): { label: string; onSelect: () => void } | undefined {
  if (!canWrite) return undefined
  const onSelect = () => {
    useUnits
      .getState()
      .create('mech', mechFromPattern(pattern, mechNamesTaken()))
      .then(
        (mech) => {
          builtToast(mech, pastStartingRules(pattern))
          go(`/mechs/${mech.id}`)
        },
        (err: unknown) => toast.error(failureMessage(err, buildShelvesCopy('mechNotBuilt')))
      )
  }
  return { label: buildShelvesCopy('buildWithThis'), onSelect }
}

/** The delete confirm, naming the mechs built from the pattern (r3 G3). */
export function deletePatternCopy(pattern: MechPattern) {
  const copy = ROW_ACTION_COPY.deleteBuild(pattern.name)
  return { ...copy, body: [...copy.body, ...deletePatternLines(pattern.id)] }
}

/** Delete a saved pattern: its page answers nothing after, and a mech's chip reads so at once. */
export async function deletePattern(id: string): Promise<void> {
  await usePatterns.getState().delete(id)
  void refreshWorkerReads(sharedPaths.sheet('pattern', id))
}

export function patternMenuOf(
  pattern: MechPattern,
  host: {
    go: (href: string) => void
    confirm: Confirm
    /** Write verbs exist only where a write could land. */
    canWrite: boolean
    rename: (subject: RenameSubject) => void
  }
): HeaderMenuItem[][] {
  const { go, confirm, canWrite } = host
  const writable = (run: () => void): (() => void) | undefined => (canWrite ? run : undefined)
  return [
    [
      { id: 'open', label: 'Open', onSelect: () => go(savedPatternHref(pattern.id)) },
      renameItem(
        {
          name: pattern.name,
          label: buildShelvesCopy('patternName'),
          save: (name) => usePatterns.getState().update(pattern.id, { name }),
        },
        canWrite ? host.rename : undefined
      ),
      {
        id: 'copy',
        label: buildShelvesCopy('makeACopy'),
        onSelect: writable(() => void copyPattern(pattern, go)),
      },
      {
        id: 'export',
        label: 'Export',
        onSelect: () => {
          downloadJson(exportFileName('pattern', pattern.name), buildPatternExport(pattern))
          toast.success(`Exported ${pattern.name}.`)
        },
      },
    ],
    [
      deleteItem(
        writable(() =>
          confirm({ ...deletePatternCopy(pattern), onConfirm: () => deletePattern(pattern.id) })
        )
      ),
    ],
  ]
}
