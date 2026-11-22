/**
 * A saved pattern's ⋯ menu on its shelf: open, rename, copy, export, and its
 * delete. Build With This is the row's own button (`buildFromPattern`, r3 L5).
 */
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { HeaderMenuItem } from '../../components/index'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
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
import {
  buildConfirmBody,
  builtToast,
  deletePatternLines,
  mechNamesTaken,
} from '../mech/Pattern/buildConfirm.model'
import type { RenameSubject } from './shelfMenu.model'
import { deleteItem, renameItem } from './shelfMenu.model'

/**
 * Build With This, as the row's button and its menu row run it: one confirm,
 * as wherever a pattern is built from, and you land on the mech. Undefined
 * where no write could land.
 */
export function buildFromPattern(
  pattern: MechPattern,
  { go, confirm, canWrite }: { go: (href: string) => void; confirm: Confirm; canWrite: boolean }
): (() => void) | undefined {
  if (!canWrite) return undefined
  return () =>
    confirm({
      title: buildShelvesCopy('buildAMechFrom', { name: pattern.name }),
      body: [buildConfirmBody({ book: false, past: pastStartingRules(pattern) })],
      confirmLabel: buildShelvesCopy('build'),
      pendingLabel: buildShelvesCopy('building'),
      tone: 'default',
      failure: buildShelvesCopy('mechNotBuilt'),
      onConfirm: async () => {
        const mech = await useUnits
          .getState()
          .create('mech', mechFromPattern(pattern, mechNamesTaken()))
        builtToast(mech.name)
        go(`/mechs/${mech.id}`)
      },
    })
}

/** The delete confirm, naming the mechs built from the pattern (r3 G3). */
function deletePatternCopy(pattern: MechPattern) {
  const copy = ROW_ACTION_COPY.deleteBuild(pattern.name)
  return { ...copy, body: [...copy.body, ...deletePatternLines(pattern.id)] }
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
          confirm({
            ...deletePatternCopy(pattern),
            onConfirm: async () => {
              await usePatterns.getState().delete(pattern.id)
              // Its page answers nothing now: a mech's chip reads so at once.
              void refreshWorkerReads(sharedPaths.sheet('pattern', pattern.id))
            },
          })
        )
      ),
    ],
  ]
}
