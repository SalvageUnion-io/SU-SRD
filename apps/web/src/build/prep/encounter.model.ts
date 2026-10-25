/**
 * An encounter's view-model (ADR-059), pure: its address, a blank one, and the
 * edits the encounter page makes to its opposition, its groups and its tables. The
 * opposition is drawn with the Opposition's own model (`opposition.model.ts`),
 * so an encounter fields exactly what Play's + Add would.
 */

import type { TrayNpcBody } from 'game-domain/games/encounters'
import type { Encounter, EncounterGroup, EncounterOpponent } from 'game-domain/schemas/encounter'
import {
  ENCOUNTER_MAX_GROUP_NAME,
  ENCOUNTER_MAX_GROUPS,
  ENCOUNTER_MAX_NAME,
  ENCOUNTER_MAX_OPPOSITION,
  ENCOUNTER_MAX_TABLES,
  ENCOUNTER_MAX_WAVE,
} from 'game-domain/schemas/encounter'
import type { HeaderMenuItem } from '../../components/index'
import { copyName } from '../../lib/copyEntity'
import { buildPrepCopy } from '../../messages/build-prep'
import type { TrayNpc } from '../../play/mediator/opposition.model'
import { readTrayNpc } from '../../play/mediator/opposition.model'
import type { EncounterCreateInput } from '../../stores/prepStore'

/** An encounter's page, in the Training Bay. */
export function encounterHref(encounterId: string): string {
  return `/encounters/${encounterId}`
}

/** What + New encounter makes: a name and nothing yet. */
export function blankEncounter(name = buildPrepCopy('newEncounter')): EncounterCreateInput {
  return { schemaVersion: 1, name, opposition: [], tables: [], notes: '' }
}

/** Make a copy: everything but its name, which says it is a copy (and still fits). */
export function encounterCopy(encounter: Encounter): EncounterCreateInput {
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = encounter
  return { ...rest, name: copyName(encounter.name).slice(0, ENCOUNTER_MAX_NAME) }
}

/**
 * A tray NPC the picker drew, as the encounter keeps it: without the live
 * state a fight gives it, under an id of its own.
 */
export function opponentFrom(npc: TrayNpcBody, id: string): EncounterOpponent {
  return {
    id,
    refSchema: npc.refSchema,
    refSlug: npc.refSlug,
    refName: npc.refName,
    ...(npc.refPattern === undefined ? {} : { refPattern: npc.refPattern }),
    ...(npc.userPattern === undefined ? {} : { userPattern: npc.userPattern }),
    name: npc.name,
    maxHp: npc.maxHp,
    statKind: npc.statKind,
  }
}

/** Whether another opponent fits. */
export function hasRoomFor(encounter: Pick<Encounter, 'opposition'>): boolean {
  return encounter.opposition.length < ENCOUNTER_MAX_OPPOSITION
}

/** An opponent read the way the Opposition reads a tray row, at full HP or SP. */
export function opponentAsTray(opponent: EncounterOpponent): TrayNpc {
  return readTrayNpc({ _id: opponent.id, body: { ...opponent, currentHp: opponent.maxHp } })
}

/** The tables with `name` pinned last, once; unchanged when it is pinned or there is no room. */
export function pinTable(tables: readonly string[], name: string): string[] {
  if (tables.includes(name) || tables.length >= ENCOUNTER_MAX_TABLES) return [...tables]
  return [...tables, name]
}

/** The tables without `name`. */
export function unpinTable(tables: readonly string[], name: string): string[] {
  return tables.filter((t) => t !== name)
}

/** An encounter's groups; one built before groups has none. */
export function groupsOf(encounter: Pick<Encounter, 'groups'>): EncounterGroup[] {
  return encounter.groups ?? []
}

/** Whether another group fits. */
export function hasRoomForGroup(encounter: Pick<Encounter, 'groups'>): boolean {
  return groupsOf(encounter).length < ENCOUNTER_MAX_GROUPS
}

/** The waves a group can arrive in: 1 with the encounter, the rest held back. */
export const WAVES: readonly number[] = Array.from({ length: ENCOUNTER_MAX_WAVE }, (_, i) => i + 1)

/** A group's name as typed, trimmed and cut to fit; blank when nothing is left. */
export function groupName(typed: string): string {
  return typed.trim().slice(0, ENCOUNTER_MAX_GROUP_NAME).trim()
}

/** The groups with a new one last, arriving with the encounter; unchanged when there is no room. */
export function addGroup(
  encounter: Pick<Encounter, 'groups'>,
  name: string,
  id: string
): EncounterGroup[] {
  const groups = groupsOf(encounter)
  if (!hasRoomForGroup(encounter)) return [...groups]
  return [...groups, { id, name, wave: 1 }]
}

/** The groups with one renamed. */
export function renameGroup(
  groups: readonly EncounterGroup[],
  groupId: string,
  name: string
): EncounterGroup[] {
  return groups.map((g) => (g.id === groupId ? { ...g, name } : g))
}

/** The groups with one arriving in `wave`. */
export function setGroupWave(
  groups: readonly EncounterGroup[],
  groupId: string,
  wave: number
): EncounterGroup[] {
  return groups.map((g) => (g.id === groupId ? { ...g, wave } : g))
}

/** Remove a group: its opponents stay in the encounter, each fighting alone. */
export function removeGroup(
  encounter: Pick<Encounter, 'groups' | 'opposition'>,
  groupId: string
): Pick<Encounter, 'groups' | 'opposition'> {
  return {
    groups: groupsOf(encounter).filter((g) => g.id !== groupId),
    opposition: encounter.opposition.map((o) => (o.groupId === groupId ? alone(o) : o)),
  }
}

/** The opposition with one opponent moved into a group, or out of every group (`null`). */
export function moveToGroup(
  opposition: readonly EncounterOpponent[],
  opponentId: string,
  groupId: string | null
): EncounterOpponent[] {
  return opposition.map((o) => {
    if (o.id !== opponentId) return o
    return groupId === null ? alone(o) : { ...o, groupId }
  })
}

function alone(opponent: EncounterOpponent): EncounterOpponent {
  const { groupId: _group, ...rest } = opponent
  return rest
}

/** One block of the opposition as the page lists it: a group and its members, or those alone. */
export type OppositionBlock = { group: EncounterGroup | null; opponents: EncounterOpponent[] }

/**
 * The opposition in the order it arrives: those fighting alone first (they
 * come with the encounter), then each group by wave, in the order they were
 * made. An empty group still shows, so it can be filled or removed.
 */
export function oppositionBlocks(
  encounter: Pick<Encounter, 'groups' | 'opposition'>
): OppositionBlock[] {
  const groups = groupsOf(encounter)
  const known = new Set(groups.map((g) => g.id))
  const solo = encounter.opposition.filter((o) => o.groupId === undefined || !known.has(o.groupId))
  const byWave = [...groups].sort((a, b) => a.wave - b.wave)
  return [
    ...(solo.length > 0 || groups.length === 0 ? [{ group: null, opponents: solo }] : []),
    ...byWave.map((group) => ({
      group,
      opponents: encounter.opposition.filter((o) => o.groupId === group.id),
    })),
  ]
}

/** "Wave 1", or "Wave 2 · held back". */
export function waveLabel(wave: number): string {
  return wave <= 1 ? buildPrepCopy('waveOne') : buildPrepCopy('waveHeld', { wave })
}

/** The opponent menu's group rows: move to each other group, or out of the one it is in. */
export function moveMenu(
  opponent: EncounterOpponent,
  groups: readonly EncounterGroup[],
  move: (groupId: string | null) => void
): HeaderMenuItem[] {
  const into = groups
    .filter((g) => g.id !== opponent.groupId)
    .map((g) => ({
      id: `move-${g.id}`,
      label: buildPrepCopy('moveTo', { name: g.name }),
      onSelect: () => move(g.id),
    }))
  return opponent.groupId === undefined
    ? into
    : [...into, { id: 'alone', label: buildPrepCopy('fightAlone'), onSelect: () => move(null) }]
}
