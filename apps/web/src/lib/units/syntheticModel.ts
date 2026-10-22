/**
 * syntheticModel — the one builder of a model for a thing no reference record
 * describes (a player unit, a Game, a member, a Play line, a carried thing the
 * catalog does not hold). Its ref is `synthetic`, so it never links or Peeks
 * by itself (`peekContext`), and it carries no traits; the callers say only
 * what differs: its schema, id, kind, tone, and any facts, art or lead.
 */

import type { EntitySchemaName } from 'salvageunion-reference'
import type { EntityFormModel } from '../../components/index'

type Kind = EntityFormModel['kind']

export function syntheticModel({
  schemaName,
  id,
  slug,
  name,
  title = name,
  kind,
  tone,
  facts = [],
  art = { kind: 'none' },
  lead,
  userMade = false,
}: {
  /** The catalog it stands in: its kind for screen readers. */
  schemaName: EntitySchemaName
  /** Its identity, unique among synthetic refs (`unit/mech/<slug>`, `game/<slug>`). */
  id: string
  slug: string
  name: string
  /** What its head prints, when not its name (a user-made unit's quoted name). */
  title?: string
  /** Its kind: `label` is both the stamp and the type screen readers hear. */
  kind: {
    label: string
    domain: Kind['domain']
    nature?: Kind['nature']
    note?: string | undefined
  }
  tone: EntityFormModel['tone']
  facts?: EntityFormModel['facts']
  art?: EntityFormModel['art']
  lead?: string | undefined
  userMade?: boolean
}): EntityFormModel {
  const { label, domain, nature = 'have', note } = kind
  return {
    ref: { schemaName, id, slug, name, synthetic: true },
    title,
    kind: { stamp: label, type: label, domain, nature, ...(note ? { note } : {}) },
    tone,
    facts,
    traits: [],
    art,
    ...(lead ? { lead } : {}),
    ...(userMade ? { userMade: true } : {}),
  }
}
