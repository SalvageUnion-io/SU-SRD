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
  /** Each field the write moved, as stored: what reversing it reads. */
  fields: LogField[]
  /** Where a rule wrote it from, where the log says so in words (r3 B4). */
  from?: 'play' | 'downtime'
  /** What spent the points, where the write named it: "Squeeze It In". */
  did?: string
}

/** One field of a write: absent sides are undefined. */
type LogField = { field: string; before: unknown; after: unknown }

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
  // A number written over nothing started from what nothing stood for.
  const start =
    (row.before === null || row.before === undefined) && typeof row.after === 'number'
      ? defaults[row.field]
      : undefined
  return [
    {
      key: row._id,
      label: fieldLabel(row.field),
      before: text(start ?? row.before),
      after: text(row.after),
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
function origin(source: string): Pick<LogChange, 'from' | 'did'> {
  const at = source.indexOf(':')
  const surface = at === -1 ? source : source.slice(0, at)
  if (surface !== 'play' && surface !== 'downtime') return {}
  const did = at === -1 ? '' : source.slice(at + 1).trim()
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
  return [...changes.values()]
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

/**
 * A list as it is now with one write's move taken back: what the write took
 * off goes back on the end, what it put on comes off (one of each, where it
 * is still there), and a thing it altered (same id) reads as it did before.
 * Everything else in the list stays as it is.
 */
function reverseList(
  now: readonly unknown[],
  before: readonly unknown[],
  after: readonly unknown[]
): unknown[] {
  const result = [...now]
  const removed = without(before, after)
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
    } else if (at !== -1) result.splice(at, 1)
  }
  return [...result, ...removed]
}

const list = (value: unknown): unknown[] | null =>
  value === undefined || value === null ? [] : Array.isArray(value) ? value : null

/**
 * The patch that reverses one change on the sheet as it is now (r3 B1). A
 * list field takes back only what the change moved; any other field is set
 * to what it was (undefined: it was absent).
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
    patch[field] = listed && was && became && current ? reverseList(current, was, became) : before
  }
  return patch
}

/** What a change's button does, and what its toast says it did. */
export type Reversal = { label: string; done: string }

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
      }
    }
    return {
      label: buildSheetCopy('logTakeOff'),
      done: buildSheetCopy('logTakeOffDone', { names: names(missing(after, before)) }),
    }
  }
  const value = values[0]
  if (only && value && 'label' in value && change.lines.length === 1) {
    const absent = only.before === undefined || only.before === null || only.before === ''
    if (absent && defaults[only.field] === undefined) {
      return {
        label: buildSheetCopy('logClear'),
        done: buildSheetCopy('logClearDone', { label: value.label }),
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
    }
  }
  return { label: buildSheetCopy('logUndoChange'), done: buildSheetCopy('logUndoChangeDone') }
}

/** The longest value a button names; a longer one reads "Set back". */
const SHORT_VALUE = 16

/** A line as one sentence: a control's name, a test's reading. */
export function lineText(line: LogLine): string {
  return 'text' in line
    ? line.text
    : `${line.label}: ${line.before} ${buildSheetCopy('logTo')} ${line.after}`
}
