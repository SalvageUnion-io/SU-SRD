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

/** The reference schema each kind is built on, the tone it wears and its domain. */
const KIND: Record<
  UnitKind,
  { schemaName: EntitySchemaName; tone: string; domain: EntityRowModel['kind']['domain'] }
> = {
  pilot: { schemaName: 'classes', tone: 'pilot', domain: 'pilot' },
  mech: { schemaName: 'chassis', tone: 'mech', domain: 'mech' },
  crawler: { schemaName: 'crawlers', tone: 'crawler', domain: 'crawler' },
  pattern: { schemaName: 'chassis', tone: 'mech', domain: 'mech' },
  npc: { schemaName: 'npcs', tone: 'adversary', domain: 'actor' },
}

export function unitRowModel({
  kind,
  stamp,
  name,
  readings = [],
  userMade = false,
}: {
  kind: UnitKind
  /** The kind as the unit's stamp says it: "Pilot · Engineer", "mech". */
  stamp: string
  name: string
  /** Its readings (`SP 9/9`), as Stat cells. */
  readings?: { label: string; value: string }[]
  /** A pattern or an NPC: dashed, its name quoted (ruleset §3.9). */
  userMade?: boolean
}): EntityRowModel {
  const { schemaName, tone, domain } = KIND[kind]
  const slug = nameToSlug(name)
  return {
    ref: { schemaName, id: `unit/${kind}/${slug}`, slug, name, synthetic: true },
    title: userMade ? `“${name}”` : name,
    kind: { stamp, type: stamp, domain, nature: 'have' },
    tone,
    facts: readings.map((r) => ({ key: r.label, label: r.label, short: r.label, value: r.value })),
    traits: [],
    art: { kind: 'none' },
    ...(userMade ? { userMade: true } : {}),
  }
}
