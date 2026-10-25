/**
 * An encounter table's roster (the Workshop Manual's region tables, p.270):
 * each rolled row lists the opposition it fields, one line as printed
 * ("2 × Contour Pattern Drop Bear"). This reads a line into what it names, so
 * the Mediator can field the row in one press (play.md §15).
 *
 * Pure apart from the reference lookups. A line that names nothing in the
 * Opposition's schemas (a "Radiation Storm") resolves to null and stays words.
 */

import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { EncounterRefSchema } from './opposition.model'
import { OPPOSITION_SCHEMAS, patternsOf } from './opposition.model'

/** How many a line fields: a number, or a d20 to roll ("d20 × Wasteland Artl"). */
type RosterCount = number | 'd20'

/** One roster line, read. */
export type RosterLine = {
  /** The line as printed. */
  text: string
  count: RosterCount
  /** What it names, or null when nothing in the Opposition's schemas matches. */
  draw: { schema: EncounterRefSchema; entity: RefEntity; pattern?: RefObjectAnyPattern } | null
}

const LINE = /^(\d+|d20)\s*×\s*(.+)$/i

/** Names compare without case, spaces or hyphens ("NeuraPhage" is the Neura-Phage). */
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

const entityName = (entity: RefEntity) =>
  'name' in entity && typeof entity.name === 'string' ? entity.name : ''

/** The Opposition's entities by compared name, built once per call site. */
function opposition(): Map<string, { schema: EncounterRefSchema; entity: RefEntity }> {
  const byName = new Map<string, { schema: EncounterRefSchema; entity: RefEntity }>()
  const schemas = OPPOSITION_SCHEMAS.map((s) => s.schema)
  for (const { schemaName, entity } of SalvageUnionReference.getAllBySchemaNames(schemas)) {
    const name = key(entityName(entity as RefEntity))
    if (name !== '' && !byName.has(name)) {
      byName.set(name, { schema: schemaName, entity: entity as RefEntity })
    }
  }
  return byName
}

/** A printed name, then without a plural "s", then without a type word the book adds. */
function candidates(name: string): string[] {
  const bare = name.replace(/\s+Bio-Titan$/i, '').replace(/^Wasteland\s+/i, '')
  return [name, name.replace(/s$/, ''), bare].map(key)
}

/** Read one roster line against the Opposition's schemas. */
export function readRosterLine(
  text: string,
  byName: ReturnType<typeof opposition> = opposition()
): RosterLine | null {
  const m = LINE.exec(text.trim())
  if (!m?.[1] || !m[2]) return null
  const count: RosterCount = m[1].toLowerCase() === 'd20' ? 'd20' : Number(m[1])
  const name = m[2].trim()
  const patterned = /^(.+?)\s+Pattern\s+(.+)$/.exec(name)
  if (patterned?.[1] && patterned[2]) {
    const prefix = key(patterned[1])
    const patternOf = (entity: RefEntity) =>
      patternsOf(entity).find((p) => key(p.name.replace(/\s+Pattern$/i, '')) === prefix)
    const hosts = candidates(patterned[2])
    for (const host of hosts) {
      const found = byName.get(host)
      if (!found) continue
      const pattern = patternOf(found.entity)
      return { text, count, draw: pattern ? { ...found, pattern } : found }
    }
    // The book can shorten a host to its last word ("Sestra" for the Little
    // Sestra): a host so named that has the pattern.
    for (const found of byName.values()) {
      const last = key(entityName(found.entity).split(/\s+/).at(-1) ?? '')
      const pattern = hosts.includes(last) ? patternOf(found.entity) : undefined
      if (pattern) return { text, count, draw: { ...found, pattern } }
    }
    return { text, count, draw: null }
  }
  for (const candidate of candidates(name)) {
    const found = byName.get(candidate)
    if (found) return { text, count, draw: found }
  }
  return { text, count, draw: null }
}

/** Read every line of a row's roster; lines that are no roster line are dropped. */
export function readRoster(lines: readonly string[]): RosterLine[] {
  const byName = opposition()
  return lines.flatMap((line) => {
    const read = readRosterLine(line, byName)
    return read ? [read] : []
  })
}
