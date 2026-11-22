/**
 * The Change Log in the sheet's own words (r2 C2), and its changes as the
 * player made them (r2 C1): the server's rows are one per field, and a change
 * is the fields one write moved, so a chassis swap reads as one change with
 * its chassis and what came off.
 *
 * A change's button reverses that one change on the sheet as it is NOW (r3
 * B1): what the row removed goes back, what it added comes off, a value it
 * set is set back, and nothing a later change did is touched.
 */

import { mechMaxima, pilotMaxima } from 'game-domain/rules/crewStatus'
import type { Crawler } from 'game-domain/schemas/crawler'
import type { Mech } from 'game-domain/schemas/mech'
import type { Pilot } from 'game-domain/schemas/pilot'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerMaxSP, resolveChassisRef } from 'salvageunion-reference/rules'
import { resolveClass } from '../../lib/classRef'
import { resolveModule, resolveSystem } from '../../lib/rules/mechItems'
import { resolveEquipment } from '../../lib/rules/pilotInventory'
import { buildSheetCopy } from '../../messages/build-sheet'
import { LIVE_SHEET_MANUAL, SHEET_REDO_SOURCE, SHEET_UNDO_SOURCE } from '../../replica/provenance'
import type { EntityLogRow } from '../../rooms/ops'
import { MERGED } from './changeStory.model'

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
  /** Each field the write moved, as stored: what reversing it reads. */
  fields: LogField[]
  /** Where a rule wrote it from, where the log says so in words (r3 B4). */
  from?: 'play' | 'downtime'
  /** What spent the points, where the write named it: "Squeeze It In". */
  did?: string
  /**
   * This write took another change back, or (`again`) redid it (r4 E2): the
   * change's id, from the write's `source` (`sheetUndo`, `sheetRedo`).
   */
  reverses?: { id: string; again: boolean }
  /** A later write took this change back, and none has redone it since. */
  reversed?: boolean
}

/** One field of a write: absent sides are undefined. */
export type LogField = { field: string; before: unknown; after: unknown }

/**
 * What an absent value stood for when the write was made: a pool nobody had
 * spent from is full, a tally nobody had added to is 0 (r3 B4). By field.
 */
export type LogDefaults = Readonly<Record<string, number>>

/**
 * What each of a sheet's absent numbers stands for (r3 B4): a pool nobody has
 * spent from is full, by the sheet's maxima as they are now, and Heat and
 * Training Points start at 0.
 */
export function logDefaults(
  unit:
    | { kind: 'pilot'; entity: Pilot; crawler: Pick<Crawler, 'techLevel'> | null }
    | { kind: 'mech'; entity: Mech; pilotAbilities: string[] | undefined }
    | { kind: 'crawler'; entity: Crawler }
): LogDefaults {
  if (unit.kind === 'pilot') {
    const { maxHP, maxAP } = pilotMaxima(unit.entity, unit.crawler)
    return { currentHP: maxHP, currentAP: maxAP, trainingPoints: 0 }
  }
  if (unit.kind === 'mech') {
    const { maxSP, maxEP } = mechMaxima(unit.entity, unit.pilotAbilities, [])
    return { currentSP: maxSP, currentEP: maxEP, currentHeat: 0 }
  }
  return { currentSP: crawlerMaxSP(unit.entity) }
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
  // A list of named things (cargo lots, inventory lines) reads by their names,
  // each with its count where it has one: never the stored record.
  if (Array.isArray(value) && value.every(named)) {
    return value.length === 0 ? buildSheetCopy('logNone') : value.map(nameAndCount).join(', ')
  }
  return JSON.stringify(value)
}

type Named = { name: string; units?: unknown; quantity?: unknown }

const named = (value: unknown): value is Named =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { name?: unknown }).name === 'string'

function nameAndCount(item: Named): string {
  const count = [item.units, item.quantity].find((n) => typeof n === 'number' && n > 1)
  return count === undefined ? item.name : `${item.name} ×${count}`
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

function rowLines(row: EntityLogRow, defaults: LogDefaults): LogLine[] {
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
  // An absent number reads as what it stands for, on either side: a full
  // pool, 0 Heat (r3 B4, r5 C7), never "None".
  const filled = (value: unknown) =>
    value === null || value === undefined ? (defaults[row.field] ?? value) : value
  return [
    {
      key: row._id,
      label: fieldLabel(row.field),
      before: text(filled(row.before)),
      after: text(filled(row.after)),
    },
  ]
}

/** A row's write: its id is `<op id>:<field>`. */
const opOf = (row: EntityLogRow) =>
  row._id.endsWith(`:${row.field}`) ? row._id.slice(0, -row.field.length - 1) : row._id

/**
 * A write's surface and what it was for, from its `source`: `play` or
 * `downtime`, then the action's name after a colon where the write gave one
 * (`sourceOf`, `replica/provenance.ts`).
 */
function origin(source: string): Pick<LogChange, 'from' | 'did' | 'reverses'> {
  const at = source.indexOf(':')
  const surface = at === -1 ? source : source.slice(0, at)
  if ((surface === SHEET_UNDO_SOURCE || surface === SHEET_REDO_SOURCE) && at !== -1) {
    return { reverses: { id: source.slice(at + 1), again: surface === SHEET_REDO_SOURCE } }
  }
  const did = at === -1 ? '' : source.slice(at + 1).trim()
  // A sheet edit for something it names (`liveSheetFor`): what, not where (r5 C9).
  if (surface === LIVE_SHEET_MANUAL.source) return did === '' ? {} : { did }
  if (surface !== 'play' && surface !== 'downtime') return {}
  return did === '' ? { from: surface } : { from: surface, did }
}

/** The log as changes, in the order the rows came (newest first). */
export function logChanges(rows: readonly EntityLogRow[], defaults: LogDefaults = {}): LogChange[] {
  const changes = new Map<string, LogChange>()
  for (const row of rows) {
    const id = opOf(row)
    let change = changes.get(id)
    if (!change) {
      change = {
        id,
        ts: row.ts,
        kind: row.kind,
        state: row.state,
        lines: [],
        fields: [],
        ...origin(row.source),
      }
      changes.set(id, change)
    }
    change.fields.push({
      field: row.field,
      before: row.before ?? undefined,
      after: row.after ?? undefined,
    })
    // The thing itself reads first: the chassis, then what came off with it.
    if (row.field in REFS) change.lines.unshift(...rowLines(row, defaults))
    else change.lines.push(...rowLines(row, defaults))
  }
  const all = [...changes.values()]
  // Oldest first: a change is taken back by an undo that names it, until a redo does.
  const reversed = new Set<string>()
  for (const { reverses } of [...all].reverse()) {
    if (!reverses) continue
    // A merged line's Set back names each change it merged (`logStory`, `changeStory.model.ts`).
    for (const each of reverses.id.split(MERGED)) {
      if (reverses.again) reversed.delete(each)
      else reversed.add(each)
    }
  }
  for (const change of all) if (reversed.has(change.id)) change.reversed = true
  return all
}

/**
 * Whether a change still offers its button (r4 E2): an applied change that
 * has not been taken back, and is not itself a taking back (its own way back
 * is the change it reversed, whose button returns with a redo).
 */
export const reversible = (change: LogChange): boolean =>
  change.state === 'applied' && !change.reversed && !change.reverses

/**
 * The change Ctrl+Z and "Undo last change" take back next (r4 E3): the newest
 * one that still stands, so pressing again steps one change further back.
 */
export const lastUndoable = (changes: readonly LogChange[]): LogChange | undefined =>
  changes.find(reversible)

/**
 * The log in two runs (r4 E2): the changes that arrived since the dialog
 * opened (`seen` is what it held then), and the ones it opened with, which
 * keep their order so no line moves under the pointer.
 */
export function splitJustNow(
  changes: readonly LogChange[],
  seen: ReadonlySet<string>
): { justNow: LogChange[]; earlier: LogChange[] } {
  return {
    justNow: changes.filter((change) => !seen.has(change.id)),
    earlier: changes.filter((change) => seen.has(change.id)),
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

const idOf = (item: unknown): string | undefined =>
  typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string'
    ? (item as { id: string }).id
    : undefined

/** What `from` holds that `to` does not, by value, counting repeats. */
function without(from: readonly unknown[], to: readonly unknown[]): unknown[] {
  const left = [...to]
  return from.filter((item) => {
    const at = left.findIndex((other) => same(item, other))
    if (at === -1) return true
    left.splice(at, 1)
    return false
  })
}

/** What `from` holds that `to` does not, by value, counting repeats, each with its place in `from`. */
function withoutAt(
  from: readonly unknown[],
  to: readonly unknown[]
): { item: unknown; at: number }[] {
  const left = [...to]
  return from.flatMap((item, at) => {
    const found = left.findIndex((other) => same(item, other))
    if (found === -1) return [{ item, at }]
    left.splice(found, 1)
    return []
  })
}

/** Where in `result` the thing at `before[at]` goes back (r6 E15). */
function placeOf(result: readonly unknown[], before: readonly unknown[], at: number): number {
  // After the nearest thing that stood before it and is still there…
  for (let earlier = at - 1; earlier >= 0; earlier--) {
    const found = result.findIndex((other) => same(other, before[earlier]))
    if (found !== -1) return found + 1
  }
  // …else ahead of the nearest that stood after it, else at the end.
  for (let later = at + 1; later < before.length; later++) {
    const found = result.findIndex((other) => same(other, before[later]))
    if (found !== -1) return found
  }
  return result.length
}

/** Put each of `back` into `result` where it stood in `before` (r6 E15). */
function putBackInPlace(
  result: unknown[],
  before: readonly unknown[],
  back: readonly { item: unknown; at: number }[]
): unknown[] {
  for (const { item, at } of back) result.splice(placeOf(result, before, at), 0, item)
  return result
}

/**
 * A list as it is now with one write's move taken back: what the write took
 * off goes back where it stood (r6 E15), what it put on comes off (one of
 * each, where it is still there), and a thing it altered (same id) reads as
 * it did before. Everything else in the list stays as it is.
 */
function reverseList(
  now: readonly unknown[],
  before: readonly unknown[],
  after: readonly unknown[]
): unknown[] {
  const result = [...now]
  const removedAt = withoutAt(before, after)
  const removed = removedAt.map(({ item }) => item)
  for (const item of without(after, before)) {
    const id = idOf(item)
    const was = id === undefined ? -1 : removed.findIndex((old) => idOf(old) === id)
    const at =
      id === undefined
        ? result.findIndex((other) => same(item, other))
        : result.findIndex((other) => idOf(other) === id)
    if (was !== -1) {
      // Altered, and still on the sheet: back to how it read. Gone since: left gone.
      if (at !== -1) result[at] = removed[was]
      removed.splice(was, 1)
      removedAt.splice(was, 1)
    } else if (at !== -1) result.splice(at, 1)
  }
  return putBackInPlace(result, before, removedAt)
}

type Keyed = Record<string, unknown>

const keyed = (value: unknown): Keyed | null =>
  value === undefined || value === null
    ? {}
    : typeof value === 'object' && !Array.isArray(value)
      ? (value as Keyed)
      : null

/**
 * A keyed record (conditions by slug, an item's choices) as it is now with one
 * write's move taken back (r4 E3): each key the write set or dropped reads as
 * it did before, and every other key stays as it is.
 */
function reverseKeyed(now: Keyed, before: Keyed, after: Keyed): Keyed | undefined {
  const result = { ...now }
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    if (same(before[key], after[key])) continue
    if (key in before) result[key] = before[key]
    else delete result[key]
  }
  return Object.keys(result).length === 0 ? undefined : result
}

const list = (value: unknown): unknown[] | null =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : null

/**
 * The patch that reverses one change on the sheet as it is now (r3 B1). A
 * list field takes back only what the change moved, a keyed record only the
 * keys it moved; any other field is set to what it was (undefined: absent).
 */
export function reverseChange(
  change: Pick<LogChange, 'fields'>,
  now: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const { field, before, after } of change.fields) {
    const was = list(before)
    const became = list(after)
    const current = list(now[field])
    const listed = Array.isArray(before) || Array.isArray(after)
    if (listed && was && became && current) {
      patch[field] = reverseList(current, was, became)
      continue
    }
    const [wasKeyed, becameKeyed, nowKeyed] = [keyed(before), keyed(after), keyed(now[field])]
    const maps = [before, after].some((side) => side !== null && typeof side === 'object')
    patch[field] =
      maps && wasKeyed && becameKeyed && nowKeyed
        ? reverseKeyed(nowKeyed, wasKeyed, becameKeyed)
        : before
  }
  return patch
}

/**
 * One edit taken back on the record as it is now (r4 E3): what a removal's
 * own Undo writes, so several removals each keep an Undo that puts back its
 * own thing and nothing else. `was` is the record before the edit, `after`
 * the fields the edit wrote.
 */
export function takeBack<T extends object>(now: T, was: T, after: Partial<T>): Partial<T> {
  const fields = Object.keys(after).map((field) => ({
    field,
    before: (was as Keyed)[field],
    after: (after as Keyed)[field],
  }))
  return reverseChange({ fields }, now as Keyed) as Partial<T>
}

/**
 * What a change's button does, what its toast says it did, and what the line
 * reads once it is done (`was`, r4 E2).
 */
export type Reversal = { label: string; done: string; was: string }

/**
 * A change's button in the words of what it will do (r3 B1): "Put back" for
 * a removal, "Remove" for an addition, "Set back to 5" for one value, and
 * the plain "Undo this change" where the change did several things.
 */
export function reversal(change: LogChange, defaults: LogDefaults = {}): Reversal {
  const sentences = change.lines.filter((line) => 'text' in line)
  const values = change.lines.filter((line) => !('text' in line))
  const only = change.fields.length === 1 ? change.fields[0] : undefined
  const nameOf = only ? LISTS[only.field] : undefined
  const before = only ? slugs(only.before) : null
  const after = only ? slugs(only.after) : null
  if (only && nameOf && before && after && values.length === 0 && sentences.length === 1) {
    const names = (items: string[]) => items.map((slug) => nameOf(slug) ?? slug).join(', ')
    const removed = missing(before, after)
    if (removed.length > 0) {
      return {
        label: buildSheetCopy('logPutBack'),
        done: buildSheetCopy('logPutBackDone', { names: names(removed) }),
        was: buildSheetCopy('logPutBack'),
      }
    }
    return {
      label: buildSheetCopy('logTakeOff'),
      done: buildSheetCopy('logTakeOffDone', { names: names(missing(after, before)) }),
      was: buildSheetCopy('logRemovedAgain'),
    }
  }
  const value = values[0]
  if (only && value && 'label' in value && change.lines.length === 1) {
    const absent = only.before === undefined || only.before === null || only.before === ''
    if (absent && defaults[only.field] === undefined) {
      return {
        label: buildSheetCopy('logClear'),
        done: buildSheetCopy('logClearDone', { label: value.label }),
        was: buildSheetCopy('logCleared'),
      }
    }
    const short = value.before.length <= SHORT_VALUE
    return {
      label: short
        ? buildSheetCopy('logSetBackTo', { value: value.before })
        : buildSheetCopy('logSetBack'),
      done: short
        ? buildSheetCopy('logSetBackDone', { label: value.label, value: value.before })
        : buildSheetCopy('logSetBackDonePlain', { label: value.label }),
      was: short
        ? buildSheetCopy('logSetBackWasTo', { value: value.before })
        : buildSheetCopy('logSetBackWas'),
    }
  }
  return {
    label: buildSheetCopy('logUndoChange'),
    done: buildSheetCopy('logUndoChangeDone'),
    was: buildSheetCopy('logUndone'),
  }
}

/**
 * What a change did, as the ⋯ menu's Undo names it (r6 E15): "remove
 * Chainsaw Arm", "add Red Laser", or its one value's line; a change of
 * several things has no short name (undefined).
 */
export function changeWhat(change: Pick<LogChange, 'fields' | 'lines'>): string | undefined {
  const only = change.fields.length === 1 ? change.fields[0] : undefined
  const nameOf = only ? LISTS[only.field] : undefined
  const before = only ? slugs(only.before) : null
  const after = only ? slugs(only.after) : null
  if (only && nameOf && before && after) {
    const names = (items: string[]) => items.map((slug) => nameOf(slug) ?? slug).join(', ')
    const removed = missing(before, after)
    const added = missing(after, before)
    if (removed.length > 0 && added.length === 0)
      return buildSheetCopy('undoWhatRemoved', { names: names(removed) })
    if (added.length > 0 && removed.length === 0)
      return buildSheetCopy('undoWhatAdded', { names: names(added) })
  }
  const [line] = change.lines
  return change.lines.length === 1 && line && 'label' in line ? lineText(line) : undefined
}

/** The longest value a button names; a longer one reads "Set back". */
const SHORT_VALUE = 16

/** A line as one sentence: a control's name, a test's reading. */
export function lineText(line: LogLine): string {
  return 'text' in line
    ? line.text
    : `${line.label}: ${line.before} ${buildSheetCopy('logTo')} ${line.after}`
}
