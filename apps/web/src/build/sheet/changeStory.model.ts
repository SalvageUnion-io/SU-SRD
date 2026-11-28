/**
 * The Change Log as the sheet's story (r6 E14): the log's changes
 * (`changeLog.model.ts`) with what an Undo took back left out, and taps on
 * one value in quick succession merged into one line.
 */
import type { LogChange, LogField } from './changeLog.model'

/** How the ids of the changes a merged line stands for are joined in its id. */
export const MERGED = ','

/** Taps on one value this close together read as one change (r6 E14). */
const MERGE_WINDOW_MS = 60_000

/** A change of one value, alone: what the log merges with its neighbours. */
function oneValue(change: LogChange): LogField | undefined {
  const [only] = change.fields
  const [line] = change.lines
  if (change.fields.length !== 1 || change.lines.length !== 1 || !only || !line) return undefined
  if (!('label' in line) || change.state !== 'applied' || change.reverses) return undefined
  return Array.isArray(only.before) || Array.isArray(only.after) ? undefined : only
}

const mergeable = (newer: LogChange, older: LogChange): boolean => {
  const [a, b] = [oneValue(newer), oneValue(older)]
  return (
    a !== undefined &&
    b !== undefined &&
    a.field === b.field &&
    newer.kind === older.kind &&
    newer.from === older.from &&
    newer.did === older.did &&
    newer.ts - older.ts <= MERGE_WINDOW_MS
  )
}

/** A run of taps on one value (newest first) as one line: `SP 10 → 6` (r6 E14). */
function mergeRun(run: readonly LogChange[]): LogChange | undefined {
  const newest = run[0]
  const oldest = run[run.length - 1]
  if (!newest || !oldest) return undefined
  if (run.length === 1) return newest
  const [first] = oldest.fields
  const [last] = newest.fields
  const [from] = oldest.lines
  const [to] = newest.lines
  if (!first || !last || !from || !to || !('label' in from) || !('label' in to)) return newest
  // Back where it started: the run told nothing.
  if (from.before === to.after) return undefined
  return {
    ...newest,
    id: run.map((change) => change.id).join(MERGED),
    fields: [{ field: last.field, before: first.before, after: last.after }],
    lines: [{ ...to, before: from.before }],
  }
}

/**
 * The log as the sheet's story (r6 E14): what an Undo took back is gone from
 * it and a Redo puts it back (the undo and redo writes are never lines of
 * their own), and taps on one value in quick succession read as one line,
 * `SP 10 → 6`, whose Set back takes the whole run back.
 */
export function logStory(changes: readonly LogChange[]): LogChange[] {
  const standing = changes.filter((change) => !change.reverses && !change.reversed)
  const story: LogChange[] = []
  let run: LogChange[] = []
  const close = () => {
    const merged = mergeRun(run)
    if (merged) story.push(merged)
    run = []
  }
  for (const change of standing) {
    const last = run[run.length - 1]
    if (last && !mergeable(last, change)) close()
    run.push(change)
  }
  close()
  return story
}
