import type { RefEntity } from 'salvageunion-reference'
import { Entity } from '../index'

type EntityListingRowProps = {
  entity: RefEntity
  /** The entity's own page. */
  href: string
  /** What the listing's context already says: `kind` under a one-kind listing,
   *  a fact key (`tech-level`) under a slab that names it. */
  omit?: readonly string[]
}

/**
 * One entity in a schema listing (ruleset §1, Listing: "one card, one click";
 * entity display language E2, E11): a Compact in link mode, the whole row a real
 * `<a>` to the entity's page. Its head carries the name (two lines, then
 * clamped), its body the facts as Stats, the traits as Tags and the entity's
 * opening prose; its head's art window the artwork, where the entity has any.
 */
export function EntityIndexCompact({ entity, href, omit }: EntityListingRowProps) {
  return <Entity size="compact" entity={entity} mode={{ kind: 'link', href }} omit={omit} lead />
}
