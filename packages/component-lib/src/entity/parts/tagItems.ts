import type { EntityRef, TraitMention } from 'salvageunion-reference'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'

/** One trait as a Tag: its name, its parameter and the glossary entry it names. */
export type TagItem = {
  key: string
  name: string
  param?: string
  /** The glossary the rule lives in, for its hovercard. */
  schemaName?: 'traits' | 'keywords'
  /** The entry, when the glossary carries one: what the Tag links to. */
  ref?: EntityRef
  /** Added or changed by a choice (the modified-stats language). */
  modified?: boolean
}

/** The model's traits as Tags. */
export function traitTags(traits: readonly TraitMention[]): TagItem[] {
  return traits.map((trait) => ({
    key: `${trait.schemaName}-${trait.name}`,
    name: trait.name,
    ...(trait.param !== undefined ? { param: trait.param } : {}),
    schemaName: trait.schemaName,
    ...(trait.ref ? { ref: trait.ref } : {}),
  }))
}

/** A glossary entry by name, exact or lower-cased (the glossaries store lower case). */
export function glossaryRef(
  schemaName: 'traits' | 'keywords',
  name: string
): EntityRef | undefined {
  if (!SalvageUnionReference.isLoaded(schemaName)) return undefined
  const entry =
    SalvageUnionReference.getByNameIn(schemaName, name) ??
    SalvageUnionReference.getByNameIn(schemaName, name.toLowerCase())
  return entry
    ? { schemaName, id: entry.id, slug: getEntitySlug(entry), name: entry.name }
    : undefined
}

/**
 * The entry a `[[Name]]` in rules text names: a trait, else a keyword (the
 * book's markup does not say which glossary). `undefined` when neither carries
 * it, or neither is loaded: the Mention renders inert.
 */
export function mentionRef(name: string): EntityRef | undefined {
  return glossaryRef('traits', name) ?? glossaryRef('keywords', name)
}
