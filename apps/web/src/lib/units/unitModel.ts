/**
 * A PLAYER UNIT as the entity forms draw it (entity display language §7,
 * "Player-made units"): a pilot, mech, crawler, saved pattern or custom NPC is
 * the player's own build, which no reference record describes, so it has no
 * `toEntityModel`. This is its model for a Compact or a Mini — its kind, its tone,
 * its name and the readings the surface shows — with a synthetic ref, so it
 * never links by itself (its sheet's route goes in the link mode).
 */

import type { EntitySchemaName } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'
import type { EntityFormModel } from '../../components/index'
import { syntheticModel } from './syntheticModel'

export type UnitKind = 'pilot' | 'mech' | 'crawler' | 'pattern' | 'npc' | 'encounter'

/**
 * A reading's chip class (`chips-and-actions.md` C2): its rank (`TL | 2`), a
 * measure (`SP | 9/9`, its lead vital), what it is built on or linked to
 * (`CHASSIS | Mule`, a relation), a mark that says what it is (`ROLE | Doc`,
 * `CALLSIGN | Ghost`), or its state after the cost (`CONDITION | Intact`).
 */
export type UnitChip = 'mark' | 'rank' | 'measure' | 'relation' | 'state'

/**
 * One reading a unit shows, label first: `SP | 9/9`, `TL | 2`. Its `chip`
 * names its class; unnamed, `TL` is the rank, a number or `n/m` reading a
 * measure, and a name a relation (`unitChipOf`).
 */
export type UnitReading = { label: string | number; value: string | number; chip?: UnitChip }

/** A reading's class: its own, else read off it (`UnitReading`). */
export function unitChipOf(reading: UnitReading): UnitChip {
  if (reading.chip) return reading.chip
  if (String(reading.label) === 'TL') return 'rank'
  return /^\d+(\/\d+)?(\s.*)?$/.test(String(reading.value)) ? 'measure' : 'relation'
}

/** The readings a unit's model carries as facts: its rank and measures. */
const isStat = (reading: UnitReading) => {
  const chip = unitChipOf(reading)
  return chip === 'rank' || chip === 'measure'
}

/** The reference schema each kind is built on, the tone it wears and its domain. */
const KIND: Record<
  UnitKind,
  {
    schemaName: EntitySchemaName
    tone: string
    domain: EntityFormModel['kind']['domain']
    /** The kind, for screen readers only (never a stamp, EDL E9). */
    label: string
  }
> = {
  pilot: { schemaName: 'classes', tone: 'pilot', domain: 'pilot', label: 'Pilot' },
  mech: { schemaName: 'chassis', tone: 'mech', domain: 'mech', label: 'Mech' },
  crawler: { schemaName: 'crawlers', tone: 'crawler', domain: 'crawler', label: 'Crawler' },
  pattern: { schemaName: 'chassis', tone: 'mech', domain: 'mech', label: 'Pattern' },
  npc: { schemaName: 'npcs', tone: 'adversary', domain: 'actor', label: 'NPC' },
  // A Mediator's prepared encounter (ADR-059) wears the Opposition's tone.
  encounter: { schemaName: 'npcs', tone: 'adversary', domain: 'actor', label: 'Encounter' },
}

export function unitRowModel({
  kind,
  note,
  name,
  readings = [],
  userMade = false,
  art = { kind: 'none' },
  lead,
}: {
  kind: UnitKind
  /** What it is built as, stamped where its kind is not: "Engineer", "Mule". */
  note?: string | undefined
  name: string
  /** Its readings (`SP 9/9`): its rank and measures become its facts (`isStat`). */
  readings?: readonly UnitReading[]
  /** A pattern or an NPC: dashed, its name quoted (ruleset §3.9). */
  userMade?: boolean
  /** The art of what it is built on (a pilot's class, a mech's chassis); none by default. */
  art?: EntityFormModel['art']
  /** Its own line, for a Compact's `lead` (a pilot's motto). */
  lead?: string
}): EntityFormModel {
  const { schemaName, tone, domain, label } = KIND[kind]
  const slug = nameToSlug(name)
  return syntheticModel({
    schemaName,
    id: `unit/${kind}/${slug}`,
    slug,
    name,
    title: userMade ? `“${name}”` : name,
    kind: { label, domain, note },
    tone,
    // The rank and the measures, grouped so a head's budget (C3) keeps the
    // rank and its context's one measure (`budgetFacts`): a roster's lead
    // vital, never every reading. Relations, marks and state are the host's
    // chips (`UnitRow`).
    facts: readings.filter(isStat).map((r) => {
      const label = String(r.label)
      const rank = unitChipOf(r) === 'rank'
      return {
        key: rank ? 'tech-level' : label,
        label,
        short: label,
        value: String(r.value),
        group: rank ? ('provenance' as const) : ('vitals' as const),
      }
    }),
    art,
    lead,
    userMade,
  })
}
