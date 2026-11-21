/** A saved pattern's ⋯ menu on its shelf: open, build, rename, copy, export, and its delete. */
import type { MechPattern } from 'game-domain/schemas/pattern'
import type { HeaderMenuItem } from '../../components/index'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { copyPattern } from '../../lib/copiedToast'
import { buildPatternExport } from '../../lib/export/buildExportBundle'
import { downloadJson, exportFileName } from '../../lib/export/downloadJson'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { mechFromPattern, pastStartingRules, savedPatternHref } from '../../lib/patterns/patterns'
import { buildShelvesCopy } from '../../messages/build-shelves'
import { usePatterns } from '../../replica/collections'
import { useUnits } from '../../replica/units'
import { buildConfirmBody, builtToast, mechNamesTaken } from '../mech/Pattern/buildConfirm.model'
import type { RenameSubject } from './shelfMenu.model'
import { deleteItem, renameItem } from './shelfMenu.model'

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
      {
        id: 'build',
        label: buildShelvesCopy('buildWithThis'),
        // One confirm, as wherever a pattern is built from; you land on the mech.
        onSelect: writable(() =>
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
        ),
      },
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
            ...ROW_ACTION_COPY.deleteBuild(pattern.name),
            onConfirm: () => usePatterns.getState().delete(pattern.id),
          })
        )
      ),
    ],
  ]
}
