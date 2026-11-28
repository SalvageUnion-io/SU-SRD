/**
 * A sheet's one history (r8 E1): a toast's Undo for a change made on a sheet
 * steps that change back through the sheet's history (`useSheetUndo`), as
 * Ctrl+Z and the ⋯ menu's Undo do, so the menu's next Undo goes one change
 * further back and its Redo puts the change back. Writing the old value as a
 * new change made the menu's Undo bring the mistake back.
 *
 * The open sheet holds its history here by its unit's id; a toast with no
 * sheet behind it (Play, a list), or one the history cannot place (offline,
 * the log not caught up), writes its value back as before.
 */

/** What a toast's change wrote: a field and the value it left there. */
export type HistoryMark = { field: string; to: unknown }

/** Step back the change that wrote `marks`; false when the history cannot place it. */
export type HistoryStep = (marks: readonly HistoryMark[]) => Promise<boolean>

const held = new Map<string, HistoryStep>()

/** The open sheet holds its history; the answer lets it go. */
export function holdHistory(unitId: string, step: HistoryStep): () => void {
  held.set(unitId, step)
  return () => {
    if (held.get(unitId) === step) held.delete(unitId)
  }
}

/**
 * Take back the change that wrote `marks` on `unitId` through its sheet's
 * history, else run `fallback` (the toast's own write).
 */
export function stepBackOr(
  unitId: string,
  marks: readonly HistoryMark[],
  fallback: () => void
): void {
  const step = held.get(unitId)
  if (step === undefined || marks.length === 0) {
    fallback()
    return
  }
  void step(marks).then(
    (done) => {
      if (!done) fallback()
    },
    () => fallback()
  )
}
