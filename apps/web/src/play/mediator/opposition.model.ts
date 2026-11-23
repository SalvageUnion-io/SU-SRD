/**
 * The Opposition's view-model (docs/architecture/play.md §15):
 * what an NPC row reads as, and how a reference entity becomes an instance. The rules it reads — what an NPC tracks, when it is down, the
 * Morale roll — live in `src/lib/rules/opposition.ts`.
 *
 * Pure apart from the reference lookups.
 */

import { instanceName, numberFirst } from 'game-domain/games/encounters'
import type { EncounterNpc } from 'game-domain/schemas/encounterNpc'
import { ENCOUNTER_REF_SCHEMAS } from 'game-domain/schemas/encounterNpc'
import type { Npc, NpcTemplateKind } from 'game-domain/schemas/npc'
import { NPC_TEMPLATE_KINDS } from 'game-domain/schemas/npc'
import type { RefEntity, RefObjectAnyPattern } from 'salvageunion-reference'
import {
  findEntityBySlug,
  getEntitySlug,
  getPatterns,
  nameToSlug,
  resolveFormerSlug,
} from 'salvageunion-reference'
import { npcAsReferenceEntity } from '../../lib/npcs/npcModel'
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
  /** Its wreck's Mech Salvage roll, kept until it is salvaged (r5 B1); null before one. */
  salvageRoll: number | null
  lastRoll: MoraleRoll | null
  /** What marking it important adds; null when it cannot be (a Bio-Titan, Meld). */
  track: ImportantTrack | null
  /** Marked important (Workshop Manual p.255): the Mediator tracks more of it. */
  important: boolean
  /** An important mech's EP and Heat; null while it is not one. */
  reactor: { ep: number; maxEp: number; heat: number; heatCap: number } | null
  /** Its last Critical roll or Heat Check. */
  lastImportantRoll: ImportantRoll | null
  /** The encounter group it fights in (ADR-059 §5), or null when it fights alone. */
  group: { id: string; name: string } | null
  /** The schema it came from, for the picker's counts. */
  refSchema: EncounterRefSchema | null
  refSlug: string | null
  /** The Mediator's own designed NPC it was drawn from (ADR-067 §1), by id. */
  builtFrom: string | null
  /** The kind of denizen that design was built from, where it was not a plain NPC. */
  builtKind: NpcTemplateKind | null
}

const isRefSchema = (value: unknown): value is EncounterRefSchema =>
  typeof value === 'string' && (ENCOUNTER_REF_SCHEMAS as readonly string[]).includes(value)

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** A kept Mech Salvage die, 1–20, or null. */
function readSalvageRoll(value: unknown): number | null {
  const roll = (value as { roll?: unknown } | null)?.roll
  return typeof roll === 'number' && Number.isInteger(roll) && roll >= 1 && roll <= 20 ? roll : null
}

/** Read a `mediator.npcs` row without trusting its body's shape. */
export function readTrayNpc(row: { _id: string; body: unknown }): TrayNpc {
  const body = (row.body ?? {}) as Record<string, unknown>
  const refSchema = isRefSchema(body.refSchema) ? body.refSchema : null
  const refSlug = typeof body.refSlug === 'string' ? body.refSlug : null
  const live = refSchema && refSlug ? findEntityBySlug(refSchema, refSlug) : null
  const former = !live && refSchema && refSlug ? resolveFormerSlug(refSchema, refSlug) : null
  const maxHp = num(body.maxHp, 0)
  const statKind = body.statKind === 'sp' ? 'sp' : 'hp'
  const name = typeof body.name === 'string' ? body.name : 'Unnamed'
  const built = readBuilt(body.built)
  // One of the Mediator's own: its snapshot reads as an `npcs` entity, so its
  // card and its actions draw as a book NPC's do.
  const own = built
    ? (npcAsReferenceEntity({
        id: built.npcId,
        name: built.name,
        hitPoints: maxHp,
        damageType: statKind === 'sp' ? 'SP' : 'HP',
        actions: built.actions,
        traits: built.traits,
        ...(built.bioSalvageValue === undefined ? {} : { bioSalvageValue: built.bioSalvageValue }),
      }) as RefEntity)
    : null
  const entity = own ?? live ?? former?.host ?? null
  const saved = readUserPattern(body.userPattern)
  const picked = !live
    ? null
    : saved
      ? asReferencePattern(saved)
      : typeof body.refPattern === 'string'
        ? patternBySlug(live, body.refPattern)
        : null
  const currentHp = num(body.currentHp, maxHp)
  const roll = body.lastMediatorRoll as MoraleRoll | undefined
  const track = importantTrackOf(refSchema, entity, statKind, picked)
  const important = body.important === true && track !== null
  const maxEp = num(body.maxEp, track?.reactor?.maxEp ?? 0)
  const heatCap = num(body.heatCap, track?.reactor?.heatCap ?? 0)
  return {
    id: row._id,
    name,
    entity,
    pattern: picked ?? former?.pattern ?? null,
    currentHp,
    maxHp,
    statKind,
    down: isDown(currentHp, maxHp),
    salvaged: body.salvaged === true,
    salvageRoll: readSalvageRoll(body.salvageRoll),
    lastRoll: roll && typeof roll.roll === 'number' ? roll : null,
    track,
    important,
    reactor:
      important && track?.reactor
        ? { ep: num(body.currentEp, maxEp), maxEp, heat: num(body.currentHeat, 0), heatCap }
        : null,
    lastImportantRoll:
      important && isImportantRoll(body.lastImportantRoll) ? body.lastImportantRoll : null,
    group: readGroup(body.group),
    refSchema,
    refSlug,
    builtFrom: built?.npcId ?? null,
    builtKind: built?.kind ?? null,
  }
}

function readBuilt(value: unknown): NonNullable<EncounterNpc['built']> | null {
  if (typeof value !== 'object' || value === null) return null
  const { npcId, name, actions, traits, kind, bioSalvageValue } = value as Record<string, unknown>
  if (typeof npcId !== 'string' || !Array.isArray(actions) || !Array.isArray(traits)) return null
  return {
    npcId,
    name: typeof name === 'string' && name !== '' ? name : 'NPC',
    actions: actions.filter((a): a is string => typeof a === 'string'),
    traits: traits as NonNullable<EncounterNpc['built']>['traits'],
    ...(isTemplateKind(kind) ? { kind } : {}),
    ...(typeof bioSalvageValue === 'number' ? { bioSalvageValue } : {}),
  }
}

const isTemplateKind = (value: unknown): value is NpcTemplateKind =>
  typeof value === 'string' && (NPC_TEMPLATE_KINDS as readonly string[]).includes(value)

/**
 * A designed NPC's stat block as a fight keeps it (`built`): its name, actions
 * and traits, the kind of denizen it was built from where that is not a plain
 * NPC, and its Bio-Salvage Value.
 */
export function builtSnapshot(
  npc: Pick<Npc, 'id' | 'name' | 'actions' | 'traits'> &
    Partial<Pick<Npc, 'templateRef' | 'bioSalvageValue'>>
): NonNullable<EncounterNpc['built']> {
  const kind = npc.templateRef?.schema
  return {
    npcId: npc.id,
    name: npc.name,
    actions: [...npc.actions],
    traits: [...npc.traits],
    ...(isTemplateKind(kind) && kind !== 'npcs' ? { kind } : {}),
    ...(npc.bioSalvageValue === undefined ? {} : { bioSalvageValue: npc.bioSalvageValue }),
  }
}

function readGroup(value: unknown): TrayNpc['group'] {
  if (typeof value !== 'object' || value === null) return null
  const { id, name } = value as Record<string, unknown>
  return typeof id === 'string' && typeof name === 'string' && name !== '' ? { id, name } : null
}

/** One entry in the tray's list: an NPC alone, or a group with its members. */
export type TrayEntry =
  | { kind: 'alone'; npc: TrayNpc }
  | { kind: 'group'; id: string; name: string; members: TrayNpc[] }

/**
 * The tray as its list draws it: each group where its first member stands,
 * holding its members in tray order; everyone else alone.
 */
export function trayEntries(npcs: readonly TrayNpc[]): TrayEntry[] {
  const entries: TrayEntry[] = []
  const groups = new Map<string, Extract<TrayEntry, { kind: 'group' }>>()
  for (const npc of npcs) {
    if (npc.group === null) {
      entries.push({ kind: 'alone', npc })
      continue
    }
    const known = groups.get(npc.group.id)
    if (known) {
      known.members.push(npc)
      continue
    }
    const entry = { kind: 'group' as const, ...npc.group, members: [npc] }
    groups.set(npc.group.id, entry)
    entries.push(entry)
  }
  return entries
}

/**
 * The list with the downed below the living (r6 B8): a downed unit alone goes
 * to the list's foot, and a group's downed members to the group's; the rest
 * keep their order.
 */
export function sinkDowned(entries: readonly TrayEntry[]): TrayEntry[] {
  const living = (e: TrayEntry) => e.kind === 'group' || !e.npc.down
  const sunk = (e: TrayEntry): TrayEntry =>
    e.kind === 'group'
      ? { ...e, members: [...e.members.filter((m) => !m.down), ...e.members.filter((m) => m.down)] }
      : e
  return [...entries.filter(living), ...entries.filter((e) => !living(e))].map(sunk)
}

/** A group's last roll: the newest of its members', as a group roll writes each one's. */
export function groupRoll(members: readonly TrayNpc[]): MoraleRoll | null {
  return members.reduce<MoraleRoll | null>(
    (newest, m) =>
      m.lastRoll !== null && (newest === null || m.lastRoll.rolledAt > newest.rolledAt)
        ? m.lastRoll
        : newest,
    null
  )
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

/** A chassis drawn as a named pattern, as the picker and the field list it: "Bobcat · Mr Miner". */
export function patternLabel(chassis: string, pattern: string): string {
  return `${chassis} · ${pattern}`
}

/**
 * A new tray instance of a reference entity, at full HP or SP. Drawn as one of
 * its patterns, book or saved (whose loadout it copies), it is named for the
 * pattern and keeps the host's stats; a chassis's says the chassis first
 * ("Bobcat · Mr Miner", `patternLabel`, r4 D5), so the field names the Mech
 * the Mediator picked; a
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
  const drawn = saved?.name ?? pattern?.name
  const name =
    drawn === undefined ? hostName : schema === 'chassis' ? patternLabel(hostName, drawn) : drawn
  const given = custom?.trim() ?? ''
  const { maxHp, statKind } = trackOf(
    entity,
    saved
      ? asReferencePattern({ ...saved, systems: [...saved.systems], modules: [...saved.modules] })
      : (pattern ?? null)
  )
  return {
    schemaVersion: 1,
    refSchema: schema,
    refSlug: slugOf({ name: hostName }),
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

/**
 * A new tray instance of one of the Mediator's own designed NPCs (ADR-067
 * §1), at full HP or SP: a snapshot of its stat block, so editing the design
 * later never changes a fight under way.
 */
export function newBuiltTrayNpc(
  npc: Pick<Npc, 'id' | 'name' | 'hitPoints' | 'damageType' | 'actions' | 'traits'> &
    Partial<Pick<Npc, 'templateRef' | 'bioSalvageValue'>>,
  taken: readonly string[],
  now: string,
  custom = ''
): Omit<EncounterNpc, 'id' | 'gameId'> {
  const given = custom.trim()
  return {
    schemaVersion: 1,
    refSchema: 'npcs',
    refSlug: '',
    built: builtSnapshot(npc),
    name: instanceName(given === '' ? npc.name : given, taken),
    currentHp: npc.hitPoints,
    maxHp: npc.hitPoints,
    statKind: npc.damageType === 'SP' ? 'sp' : 'hp',
    conditions: [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * The unit on the field a new one numbers (r4 D5): with "Raider 2" added, the
 * one still called "Raider" is to read "Raider 1". Null when there is none.
 */
export function firstToNumber<T extends { id: string; name: string }>(
  tray: readonly T[],
  added: string
): { npc: T; name: string } | null {
  const numbered = numberFirst(tray, added)
  for (const [i, npc] of tray.entries()) {
    const name = numbered[i]?.name
    if (name !== undefined && name !== npc.name) return { npc, name }
  }
  return null
}
