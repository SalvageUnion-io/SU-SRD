/**
 * A PLAYER UNIT as the entity forms draw it (entity display language §7,
 * "Player-made units"): a pilot, mech, crawler, saved pattern or custom NPC is
 * the player's own build, which no reference record describes, so it has no
 * `toEntityModel`. This is its model for a Row or a Token — its kind, its tone,
 * its name and the readings the surface shows — with a synthetic ref, so it
 * never links by itself (its sheet's route goes in the link mode).
 */

import type { EntityRowModel } from 'component-lib'
import type { EntitySchemaName } from 'salvageunion-reference'
import { nameToSlug } from 'salvageunion-reference'

export type UnitKind = 'pilot' | 'mech' | 'crawler' | 'pattern' | 'npc'

/** One reading a unit shows, label first: `SP | 9/9`, `TL | 2`. */
export type UnitReading = { label: string | number; value: string | number }

/** The reference schema each kind is built on, the tone it wears and its domain. */
const KIND: Record<
  UnitKind,
  {
    schemaName: EntitySchemaName
    tone: string
    domain: EntityRowModel['kind']['domain']
    /** The kind, for screen readers only (never a stamp, EDL E9). */
    label: string
  }
> = {
  pilot: { schemaName: 'classes', tone: 'pilot', domain: 'pilot', label: 'Pilot' },
  mech: { schemaName: 'chassis', tone: 'mech', domain: 'mech', label: 'Mech' },
  crawler: { schemaName: 'crawlers', tone: 'crawler', domain: 'crawler', label: 'Crawler' },
  pattern: { schemaName: 'chassis', tone: 'mech', domain: 'mech', label: 'Pattern' },
  npc: { schemaName: 'npcs', tone: 'adversary', domain: 'actor', label: 'NPC' },
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
  /** Its readings (`SP 9/9`), as Stat cells. */
  readings?: readonly UnitReading[]
  /** A pattern or an NPC: dashed, its name quoted (ruleset §3.9). */
  userMade?: boolean
  /** The art of what it is built on (a pilot's class, a mech's chassis); none by default. */
  art?: EntityRowModel['art']
  /** Its own line, for a Row's `lead` (a pilot's motto). */
  lead?: string
}): EntityRowModel {
  const { schemaName, tone, domain, label } = KIND[kind]
  const slug = nameToSlug(name)
  return {
    ref: { schemaName, id: `unit/${kind}/${slug}`, slug, name, synthetic: true },
    title: userMade ? `“${name}”` : name,
    kind: { stamp: label, type: label, domain, nature: 'have', ...(note ? { note } : {}) },
    tone,
    facts: readings.map((r) => {
      const label = String(r.label)
      return { key: label, label, short: label, value: String(r.value) }
    }),
    traits: [],
    art,
    ...(lead ? { lead } : {}),
    ...(userMade ? { userMade: true } : {}),
  }
}
