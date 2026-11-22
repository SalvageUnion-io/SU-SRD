/**
 * A saved pattern's ⋯ menu on its shelf: open, rename, export, and its
 * delete; Copy is the row's own button (r6 E9). Build With This is the row's own button (`buildFromPattern`, r3 L5).
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
import { PATTERN_DELETE_SKIPS_CONFIRM } from '../rulings'
import { holdDelete } from './heldDeletes.model'
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

/**
 * Delete patterns with Undo (r6 E3): held while the notice shows, written
 * once it goes, so an Undo leaves their shared links working.
 */
export function deletePatternsHeld(patterns: readonly MechPattern[]): void {
  if (patterns.length === 0) return
  const names = new Map(patterns.map((p) => [p.id, p.name]))
  holdDelete(
    patterns.map((p) => p.id),
    patterns.length === 1
      ? buildShelvesCopy('deletedName', { name: patterns[0]?.name ?? '' })
      : buildShelvesCopy('deletedCount', { count: String(patterns.length) }),
    deletePattern,
    (id) => buildShelvesCopy('patternNotDeleted', { name: names.get(id) ?? '' })
  )
}

/** A pattern's Rename…: its one name. */
const patternRename = (pattern: MechPattern): RenameSubject => ({
  name: pattern.name,
  label: buildShelvesCopy('patternName'),
  save: (name) => usePatterns.getState().update(pattern.id, { name }),
})

/**
 * The row's Copy (r6 E9): one press, and the copy (`Brawler 2`) opens in
 * Rename with its name selected, so typing names it and Escape keeps it.
 */
export const copyPatternNow = (
  pattern: MechPattern,
  go: (href: string) => void,
  rename: (subject: RenameSubject) => void
): Promise<void> => copyPattern(pattern, go, (copy) => rename(patternRename(copy)))

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
      renameItem(patternRename(pattern), canWrite ? host.rename : undefined),
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
      // With Undo it asks nothing (r6 E3, `PATTERN_DELETE_SKIPS_CONFIRM`).
      deleteItem(
        writable(() =>
          PATTERN_DELETE_SKIPS_CONFIRM
            ? deletePatternsHeld([pattern])
            : confirm({
                ...deletePatternCopy(pattern),
                onConfirm: () => deletePatternsHeld([pattern]),
              })
        ),
        PATTERN_DELETE_SKIPS_CONFIRM
      ),
    ],
  ]
}
