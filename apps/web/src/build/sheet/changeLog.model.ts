/**
 * The Change Log in the sheet's own words (r2 C2), and its changes as the
 * player made them (r2 C1): the server's rows are one per field, and a change
 * is the fields one write moved, so a chassis swap reads as one change with
 * its chassis and what came off, and Restore puts all of it back.
 */

import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClass } from '../../lib/classRef'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import { buildSheetCopy } from '../../messages/build-sheet'
import type { EntityLogRow } from '../../rooms/ops'

/** One line of a change: a sentence, or a named value's before and after. */
export type LogLine =
  | { key: string; text: string }
  | { key: string; label: string; before: string; after: string }

/** One write: its rows, newest change first in the log. */
export type LogChange = {
  id: string
  ts: number
  kind: EntityLogRow['kind']
  state: EntityLogRow['state']
  lines: LogLine[]
  /** What Restore writes: each field as it was before (undefined: it was absent). */
  before: Record<string, unknown>
}

type NameOf = (slug: string) => string | undefined

/** Fields that hold a list of the book's things, and how each is named. */
const LISTS: Record<string, NameOf> = {
  systems: (slug) => resolveSystem(slug)?.name,
  modules: (slug) => resolveModule(slug)?.name,
  abilities: (slug) => SalvageUnionReference.Abilities.getBySlug(slug)?.name,
  equipment: (slug) => resolveEquipment(slug)?.name,
}

/** Fields that hold one of the book's things, as the sheet labels it. */
const REFS: Record<string, { label: string; name: NameOf }> = {
  chassisRef: {
    label: buildSheetCopy('logChassis'),
    name: (slug) => resolveChassisRef(slug)?.name,
  },
  classRef: { label: buildSheetCopy('logClass'), name: (slug) => resolveClass(slug)?.name },
}

const LABELS: Record<string, string> = {
  name: buildSheetCopy('logName'),
  callsign: buildSheetCopy('logCallsign'),
}

/** `currentHP` → "Current HP", `maxHpOverride` → "Max hp override". */
export function fieldLabel(field: string): string {
  const known = REFS[field]?.label ?? LABELS[field]
  if (known) return known
  const words = field.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(' ')
  return words
    .map((word, i) =>
      /^[A-Z]{2,}$/.test(word)
        ? word
        : i === 0
          ? word[0]?.toUpperCase() + word.slice(1)
          : word.toLowerCase()
    )
    .join(' ')
}

/** A logged value in full: nothing is cut. An absent side is stored as null. */
function valueText(value: unknown): string {
  if (value === undefined || value === null || value === '') return buildSheetCopy('logNone')
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value) && value.every((v) => typeof v === 'string' || typeof v === 'number')) {
    return value.length === 0 ? buildSheetCopy('logNone') : value.join(', ')
  }
  return JSON.stringify(value)
}

const slugs = (value: unknown): string[] | null =>
  value === null || value === undefined
    ? []
    : Array.isArray(value) && value.every((v) => typeof v === 'string')
      ? (value as string[])
      : null

/** What `from` holds that `to` does not, counting repeats. */
function missing(from: readonly string[], to: readonly string[]): string[] {
  const left = [...to]
  return from.filter((slug) => {
    const at = left.indexOf(slug)
    if (at === -1) return true
    left.splice(at, 1)
    return false
  })
}

function rowLines(row: EntityLogRow): LogLine[] {
  const nameOf = LISTS[row.field]
  const before = slugs(row.before)
  const after = slugs(row.after)
  if (nameOf && before && after) {
    const names = (list: string[]) => list.map((slug) => nameOf(slug) ?? slug).join(', ')
    const removed = missing(before, after)
    const added = missing(after, before)
    const lines: LogLine[] = []
    if (removed.length > 0) {
      lines.push({
        key: `${row._id}:removed`,
        text: buildSheetCopy('logRemoved', { names: names(removed) }),
      })
    }
    if (added.length > 0) {
      lines.push({
        key: `${row._id}:added`,
        text: buildSheetCopy('logAdded', { names: names(added) }),
      })
    }
    if (lines.length > 0) return lines
  }
  const ref = REFS[row.field]
  const text = (value: unknown) =>
    ref && typeof value === 'string' && value !== '' ? (ref.name(value) ?? value) : valueText(value)
  return [
    {
      key: row._id,
      label: fieldLabel(row.field),
      before: text(row.before),
      after: text(row.after),
    },
  ]
}

/** A row's write: its id is `<op id>:<field>`. */
const opOf = (row: EntityLogRow) =>
  row._id.endsWith(`:${row.field}`) ? row._id.slice(0, -row.field.length - 1) : row._id

/** The log as changes, in the order the rows came (newest first). */
export function logChanges(rows: readonly EntityLogRow[]): LogChange[] {
  const changes = new Map<string, LogChange>()
  for (const row of rows) {
    const id = opOf(row)
    let change = changes.get(id)
    if (!change) {
      change = { id, ts: row.ts, kind: row.kind, state: row.state, lines: [], before: {} }
      changes.set(id, change)
    }
    change.before[row.field] = row.before ?? undefined
    // The thing itself reads first: the chassis, then what came off with it.
    if (row.field in REFS) change.lines.unshift(...rowLines(row))
    else change.lines.push(...rowLines(row))
  }
  return [...changes.values()]
}

/** A line as one sentence: a control's name, a test's reading. */
export function lineText(line: LogLine): string {
  return 'text' in line
    ? line.text
    : `${line.label}: ${line.before} ${buildSheetCopy('logTo')} ${line.after}`
}
