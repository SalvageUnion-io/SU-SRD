/**
 * Saved mech patterns (issue 1276): what a pattern keeps of a mech, what a mech
 * built from one starts as, and the reference shapes a pattern renders through.
 *
 * A pattern keeps the chassis and its loadout. Damage, Heat and cargo stay on
 * the mech; a mech built from a pattern starts fresh and records which pattern
 * it came from (issue 401). Pure functions over the schemas — the stores and Convex
 * own the writes.
 */

import type { SURefChassis, SURefEntity, SURefObjectPattern } from 'salvageunion-reference'
import { resolveChassisRef, resolveModuleRef, resolveSystemRef } from 'salvageunion-reference/rules'
import type { CreateInput } from '../../stores/types'
import type { Mech } from '../schemas/mech'
import type { MechPattern } from '../schemas/pattern'

/** What `patternStore.create` takes: the id and timestamp come from the db layer. */
type PatternInput = Omit<MechPattern, 'id' | 'createdAt'>

/** Who may read a pattern — the three choices of board P1. */
export type PatternVisibility = 'private' | 'link' | 'game'

/** A pattern's address: its public page, which the maker and its readers share. */
export function patternHref(patternId: string): string {
  return `/p/pattern/${patternId}`
}

/**
 * The pattern a mech saves as: its chassis and loadout, a name and notes, and
 * nothing it has been through. Cargo stays on the mech with its Damage and Heat.
 */
export function patternFromMech(
  mech: Pick<Mech, 'chassisRef' | 'systems' | 'modules'>,
  { name, notes }: { name: string; notes: string }
): PatternInput {
  const trimmedNotes = notes.trim()
  return {
    schemaVersion: 1,
    name: name.trim(),
    chassisRef: mech.chassisRef,
    systems: [...mech.systems],
    modules: [...mech.modules],
    cargoLots: [],
    ...(trimmedNotes ? { notes: trimmedNotes } : {}),
  }
}

/**
 * A copy of somebody's pattern for the reader's own shelf. The db layer mints
 * it a new id — a copy is never the same pattern (the copy rule in
 * `apps/itun/CLAUDE.md`).
 */
export function patternCopy(pattern: MechPattern): PatternInput {
  const { id: _id, createdAt: _createdAt, ...rest } = pattern
  return { ...rest, systems: [...rest.systems], modules: [...rest.modules], cargoLots: [] }
}

/**
 * A fresh mech built from a pattern: the chassis and loadout, full SP and EP
 * from the chassis, Heat 0, an empty hold — and the pattern it came from. Its
 * name is the pattern's, written with `patternName` in lockstep, because a
 * mech's name IS its pattern.
 */
export function mechFromPattern(pattern: MechPattern): CreateInput<'mech'> {
  const chassis = resolveChassisRef(pattern.chassisRef)
  return {
    schemaVersion: 1,
    name: pattern.name,
    patternName: pattern.name,
    chassisRef: pattern.chassisRef,
    systems: [...pattern.systems],
    modules: [...pattern.modules],
    cargoLots: [],
    conditions: [],
    currentSP: chassis?.structurePoints,
    currentEP: chassis?.energyPoints,
    currentHeat: 0,
    sourcePattern: pattern.id,
  }
}

/** The pattern's loadout as reference entities, in its stored order. */
export function patternLoadout(pattern: Pick<MechPattern, 'systems' | 'modules'>): {
  systems: SURefEntity[]
  modules: SURefEntity[]
} {
  return {
    systems: pattern.systems.flatMap((ref) => resolveSystemRef(ref) ?? []),
    modules: pattern.modules.flatMap((ref) => resolveModuleRef(ref) ?? []),
  }
}

/** Slots a loadout fills: a system or module's `slotsRequired`, one when unstated. */
export function slotsUsed(items: SURefEntity[]): number {
  return items.reduce((sum, item) => {
    const slots = 'slotsRequired' in item ? Number(item.slotsRequired) : Number.NaN
    return sum + (Number.isFinite(slots) ? slots : 1)
  }, 0)
}

/**
 * A saved pattern as the reference's pattern shape, so it renders through the
 * same `ReferenceEntityCard` pattern view as a book pattern — named, with its
 * loadout — and wears `userMade` there to say it is not one.
 */
export function asReferencePattern(
  pattern: Pick<MechPattern, 'name' | 'systems' | 'modules'>
): SURefObjectPattern {
  const { systems, modules } = patternLoadout(pattern)
  return {
    name: pattern.name,
    systems: systems.map((s) => ({ name: s.name })),
    modules: modules.map((m) => ({ name: m.name })),
  }
}

/** The chassis a pattern is built on, or null for a slug the reference lacks. */
export function patternChassis(pattern: Pick<MechPattern, 'chassisRef'>): SURefChassis | null {
  return resolveChassisRef(pattern.chassisRef)
}
