/**
 * The Opposition's view-model (docs/architecture/play.md §15):
 * what an NPC row reads as, and how a reference entity becomes an instance. The rules it reads — what an NPC tracks, when it is down, the
 * Morale roll — live in `src/lib/rules/opposition.ts`.
 *
 * Pure apart from the reference lookups.
 */

import { instanceName } from 'game-domain/games/encounters'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import { ENCOUNTER_REF_SCHEMAS } from 'game-domain/schemas/encounterNpc'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getEntitySlug,
  getPatterns,
  nameToSlug,
  resolveFormerSlug,
} from 'salvageunion-reference'
import { asReferencePattern } from '../../lib/patterns/patterns'
import type { ImportantRoll, ImportantTrack, MoraleRoll } from '../../lib/rules/opposition'
import { importantTrackOf, isDown, isImportantRoll, trackOf } from '../../lib/rules/opposition'

export type EncounterRefSchema = (typeof ENCOUNTER_REF_SCHEMAS)[number]

/** The tab the picker opens on, and what each schema is called there. */
export const OPPOSITION_SCHEMAS: ReadonlyArray<{ schema: EncounterRefSchema; label: string }> = [
  { schema: 'npcs', label: 'NPCs' },
  { schema: 'chassis', label: 'Mechs' },
  { schema: 'squads', label: 'Squads' },
  { schema: 'creatures', label: 'Creatures' },
  { schema: 'vehicles', label: 'Vehicles' },
  { schema: 'drones', label: 'Drones' },
  { schema: 'bio-titans', label: 'Bio-Titans' },
  { schema: 'meld', label: 'Meld' },
]

/** One tray row as the tab reads it. An older row may carry only a name. */
export type TrayNpc = {
  id: string
  name: string
  /** The reference entity it was drawn from, when it still resolves. */
  entity: RefEntity | null
  /**
   * The host's pattern it was drawn as: a mech pattern picked with its
   * chassis, or a row whose slug is a FORMER one that now names a pattern
   * (ADR-043), a "Hill Worm Pattern Typhon" drawn before it became Typhon's
   * "Hill Worm" pattern. `entity` is then the host, which supplies its stats.
   */
  pattern: RefObjectAnyPattern | null
  currentHp: number
  maxHp: number
  statKind: 'hp' | 'sp'
  /** At 0 HP or SP: shown as down, never removed for you (ADR-007). */
  down: boolean
  /** Its wreck has been salvaged or scrapped: nothing is left to take. */
  salvaged: boolean
  lastRoll: MoraleRoll | null
  /** What marking it important adds; null when it cannot be (a Bio-Titan, Meld). */
  track: ImportantTrack | null
  /** Marked important (Workshop Manual p.255): the Mediator tracks more of it. */
  important: boolean
  /** An important mech's EP and Heat; null while it is not one. */
  reactor: { ep: number; maxEp: number; heat: number; heatCap: number } | null
  /** Its last Critical roll or Heat Check. */
  lastImportantRoll: ImportantRoll | null
  /** The schema it came from, for the picker's counts. */
  refSchema: EncounterRefSchema | null
  refSlug: string | null
}

const isRefSchema = (value: unknown): value is EncounterRefSchema =>
  typeof value === 'string' && (ENCOUNTER_REF_SCHEMAS as readonly string[]).includes(value)

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Read a `mediator.npcs` row without trusting its body's shape. */
export function readTrayNpc(row: { _id: string; body: unknown }): TrayNpc {
  const body = (row.body ?? {}) as Record<string, unknown>
  const refSchema = isRefSchema(body.refSchema) ? body.refSchema : null
  const refSlug = typeof body.refSlug === 'string' ? body.refSlug : null
  const live = refSchema && refSlug ? findEntityBySlug(refSchema, refSlug) : null
  const former = !live && refSchema && refSlug ? resolveFormerSlug(refSchema, refSlug) : null
  const entity = live ?? former?.host ?? null
  const saved = readUserPattern(body.userPattern)
  const picked = !live
    ? null
    : saved
      ? asReferencePattern(saved)
      : typeof body.refPattern === 'string'
        ? patternBySlug(live, body.refPattern)
        : null
  const maxHp = num(body.maxHp, 0)
  const currentHp = num(body.currentHp, maxHp)
  const roll = body.lastMediatorRoll as MoraleRoll | undefined
  const statKind = body.statKind === 'sp' ? 'sp' : 'hp'
  const track = importantTrackOf(refSchema, entity, statKind)
  const important = body.important === true && track !== null
  const maxEp = num(body.maxEp, track?.reactor?.maxEp ?? 0)
  const heatCap = num(body.heatCap, track?.reactor?.heatCap ?? 0)
  return {
    id: row._id,
    name: typeof body.name === 'string' ? body.name : 'Unnamed',
    entity,
    pattern: picked ?? former?.pattern ?? null,
    currentHp,
    maxHp,
    statKind,
    down: isDown(currentHp, maxHp),
    salvaged: body.salvaged === true,
    lastRoll: roll && typeof roll.roll === 'number' ? roll : null,
    track,
    important,
    reactor:
      important && track?.reactor
        ? { ep: num(body.currentEp, maxEp), maxEp, heat: num(body.currentHeat, 0), heatCap }
        : null,
    lastImportantRoll:
      important && isImportantRoll(body.lastImportantRoll) ? body.lastImportantRoll : null,
    refSchema,
    refSlug,
  }
}

/** A saved mech pattern the Mediator may field: theirs, or shared with the Game. */
export type SavedPattern = {
  id: string
  name: string
  /** The chassis it is built on, as the pattern stores it. */
  chassisRef: string
  systems: readonly string[]
  modules: readonly string[]
  /** "You", or the crewmate who shared it. */
  madeBy: string
}

/** Read a `mediator.patterns` row without trusting its body's shape. */
export function readSavedPattern(row: {
  appId: string
  body: unknown
  madeBy: string
}): SavedPattern | null {
  const body = (row.body ?? {}) as Record<string, unknown>
  const loadout = readUserPattern(body)
  if (loadout === null || typeof body.chassisRef !== 'string') return null
  return { id: row.appId, chassisRef: body.chassisRef, madeBy: row.madeBy, ...loadout }
}

const strings = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : null

/** A stored pattern's name and loadout, or null when it has none. */
function readUserPattern(
  value: unknown
): { name: string; systems: string[]; modules: string[] } | null {
  if (typeof value !== 'object' || value === null) return null
  const v = value as Record<string, unknown>
  const systems = strings(v.systems)
  const modules = strings(v.modules)
  if (typeof v.name !== 'string' || v.name === '' || systems === null || modules === null)
    return null
  return { name: v.name, systems, modules }
}

/** A host's visible patterns, the ones a tray instance can be drawn as. */
export function patternsOf(entity: RefEntity): RefObjectAnyPattern[] {
  return getPatterns(entity) ?? []
}

/** The slug a pattern is stored by: its page's last segment. */
export function patternSlugOf(pattern: { name: string }): string {
  return nameToSlug(pattern.name)
}

function patternBySlug(entity: RefEntity, slug: string): RefObjectAnyPattern | null {
  return patternsOf(entity).find((p) => patternSlugOf(p) === slug) ?? null
}

/** The slug a reference entity is stored by (data conventions: slugs, never ids). */
export function slugOf(entity: { name: string }): string {
  return getEntitySlug(entity as RefEntity)
}

/**
 * What the Mediator chose beside the entity: a book pattern or a saved one,
 * and a name of their own.
 */
export type TrayDraw = { pattern?: RefObjectAnyPattern; saved?: SavedPattern; name?: string }

/**
 * A new tray instance of a reference entity, at full HP or SP. Drawn as one of
 * its patterns, book or saved (whose loadout it copies), it is named for the
 * pattern and keeps the host's stats; a
 * name the Mediator typed wins over both, numbered like any other when the
 * tray already has it. `mediator.addNpc` mints its id and parses it.
 */
export function newTrayNpc(
  schema: EncounterRefSchema,
  entity: RefEntity,
  taken: readonly string[],
  now: string,
  { pattern, saved, name: custom }: TrayDraw = {}
): Omit<EncounterNpc, 'id' | 'gameId'> {
  const hostName = 'name' in entity && typeof entity.name === 'string' ? entity.name : 'NPC'
  const name = saved?.name ?? pattern?.name ?? hostName
  const given = custom?.trim() ?? ''
  const { maxHp, statKind } = trackOf(entity)
  return {
    schemaVersion: 1,
    refSchema: schema,
    refSlug: slugOf({ name: hostName }),
    refName: name,
    ...(saved
      ? {
          userPattern: {
            name: saved.name,
            systems: [...saved.systems],
            modules: [...saved.modules],
          },
        }
      : pattern
        ? { refPattern: patternSlugOf(pattern) }
        : {}),
    name: instanceName(given === '' ? name : given, taken),
    currentHp: maxHp,
    maxHp,
    statKind,
    conditions: [],
    createdAt: now,
    updatedAt: now,
  }
}
