import type { EntityRef, TraitMention } from 'salvageunion-reference'
import { glossaryRef } from 'salvageunion-reference'

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
  /**
   * What a RELATION opens where it has no dataset entry (a player unit's
   * sheet): a related pilot, mech or crawler (`chips-and-actions.md` C11).
   */
  href?: string
}

/**
 * One RELATION chip (C11): what an entity is built on or linked to, label
 * first, `CLASS | Engineer`, `PILOT | Bonesaw`. A book entity carries its ref
 * (it Peeks and opens it), a player unit its sheet's `href` (it opens it).
 */
export function relation(
  key: string,
  label: string,
  value: string,
  target: { ref?: EntityRef; href?: string | undefined } = {}
): TagItem {
  return {
    key,
    name: label,
    param: value,
    ...(target.ref ? { ref: target.ref } : {}),
    ...(target.href ? { href: target.href } : {}),
  }
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

/**
 * The entry a `[[Name]]` in rules text names: a trait, else a keyword (the
 * book's markup does not say which glossary). `undefined` when neither carries
 * it, or neither is loaded: the Mention renders inert.
 */
export function mentionRef(name: string): EntityRef | undefined {
  return glossaryRef('traits', name) ?? glossaryRef('keywords', name)
}
