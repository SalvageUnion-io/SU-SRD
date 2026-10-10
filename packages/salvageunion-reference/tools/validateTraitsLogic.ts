/**
 * Pure logic for trait-data validation in Salvage Union data.
 *
 * Five checks, all fixture-free (they flow from the schema/data, not from any
 * named entity):
 *
 *  1. Trait casing — every `traits[].type` must be lowercase. The convention is
 *     lowercase everywhere, and case-sensitive consumers (e.g. getInventorySlots
 *     matches `heavy`/`portable`) silently misbehave on a capitalized type.
 *  2. removeTrait resolvability — a choice effect `removeTrait <X>` must target a
 *     trait the entity actually carries (a base `traits[]` entry, or one added by
 *     an `addTrait` effect on the same entity). Otherwise it is a silent no-op,
 *     which usually means the base trait lives somewhere the resolver can't see.
 *  3. Vocabulary membership — every `traits[].type` must resolve against traits.json
 *     or keywords.json. Unknown types silently fall back to plain text in the UI
 *     (TraitKeywordDisplayView), so they never surface as visible errors.
 *  4. Inline links — every `[[Trait]]` / `[[[Trait] (n)]]` in any string must
 *     name a trait in traits.json (without case, as both renderers resolve it).
 *     A miss renders as an unlinked mark, so a dead link never looks broken.
 *  5. Inline markup — a `[[` the parser cannot read renders as raw brackets,
 *     and `[(CHASSIS)]` already reads "The <chassis>", so "the [(CHASSIS)]"
 *     renders "The The …".
 */

import { parseTraitReferences } from '../lib/traitText.js'

export type TraitIssue = {
  file: string
  entity: string
  kind:
    | 'casing'
    | 'unresolvable-removeTrait'
    | 'unknown-trait-type'
    | 'dead-inline-trait'
    | 'inline-markup'
  detail: string
}

type Entity = Record<string, unknown>

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function entityName(entity: Entity): string {
  return String(entity.name ?? entity.id ?? 'unknown')
}

/**
 * Collect the `type` of every trait in every `traits[]` array reachable from a
 * node, at any nesting depth (top-level traits, action traits, etc.).
 */
export function collectTraitTypes(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) {
    for (const item of node) collectTraitTypes(item, out)
    return out
  }
  if (isObject(node)) {
    for (const [key, value] of Object.entries(node)) {
      if (key === 'traits' && Array.isArray(value)) {
        for (const trait of value) {
          if (isObject(trait) && typeof trait.type === 'string') {
            out.push(trait.type)
          }
        }
      }
      collectTraitTypes(value, out)
    }
  }
  return out
}

/** Trait types (lowercased) carried by an entity's own top-level `traits[]`. */
function baseTraitTypes(entity: Entity): Set<string> {
  const set = new Set<string>()
  if (Array.isArray(entity.traits)) {
    for (const trait of entity.traits) {
      if (isObject(trait) && typeof trait.type === 'string') {
        set.add(trait.type.toLowerCase())
      }
    }
  }
  return set
}

type Effect = { op: string; value: string }

/**
 * Effects declared on every `choices[].source.options[].effects[]` of an entity.
 */
function collectChoiceEffects(entity: Entity): Effect[] {
  const effects: Effect[] = []
  if (!Array.isArray(entity.choices)) return effects
  for (const choice of entity.choices) {
    if (!isObject(choice)) continue
    const source = choice.source
    if (!isObject(source) || source.kind !== 'options' || !Array.isArray(source.options)) continue
    for (const option of source.options) {
      if (!isObject(option) || !Array.isArray(option.effects)) continue
      for (const effect of option.effects) {
        if (isObject(effect) && typeof effect.op === 'string') {
          effects.push({ op: effect.op, value: String(effect.value ?? '') })
        }
      }
    }
  }
  return effects
}

/** Flag any `traits[].type` that is not lowercase. */
export function findTraitCasingIssues(file: string, entities: Entity[]): TraitIssue[] {
  const issues: TraitIssue[] = []
  for (const entity of entities) {
    for (const type of collectTraitTypes(entity)) {
      if (type !== type.toLowerCase()) {
        issues.push({
          file,
          entity: entityName(entity),
          kind: 'casing',
          detail: `trait type "${type}" must be lowercase ("${type.toLowerCase()}")`,
        })
      }
    }
  }
  return issues
}

/** Flag any `removeTrait` effect whose target the entity does not carry. */
export function findUnresolvableRemoveTraitIssues(file: string, entities: Entity[]): TraitIssue[] {
  const issues: TraitIssue[] = []
  for (const entity of entities) {
    const effects = collectChoiceEffects(entity)
    if (effects.length === 0) continue
    const reachable = baseTraitTypes(entity)
    for (const effect of effects) {
      if (effect.op === 'addTrait') reachable.add(effect.value.toLowerCase())
    }
    for (const effect of effects) {
      if (effect.op !== 'removeTrait') continue
      if (!reachable.has(effect.value.toLowerCase())) {
        issues.push({
          file,
          entity: entityName(entity),
          kind: 'unresolvable-removeTrait',
          detail: `removeTrait "${effect.value}" targets no base trait or added trait — it would be a silent no-op (is the base trait stored in traits[]?)`,
        })
      }
    }
  }
  return issues
}

/** Run all checks across a set of loaded data files. */
export function findTraitIssues(filesByName: Record<string, Entity[]>): TraitIssue[] {
  const issues: TraitIssue[] = []
  for (const [file, entities] of Object.entries(filesByName)) {
    issues.push(...findTraitCasingIssues(file, entities))
    issues.push(...findUnresolvableRemoveTraitIssues(file, entities))
  }
  issues.push(...findUnknownTraitTypes(filesByName))
  issues.push(...findDeadInlineTraitLinks(filesByName))
  return issues
}

// ---------------------------------------------------------------------------
// Vocabulary check
// ---------------------------------------------------------------------------

function buildKnownVocabulary(filesByName: Record<string, Record<string, unknown>[]>): Set<string> {
  const vocab = new Set<string>()
  for (const filename of ['traits.json', 'keywords.json']) {
    const entries = filesByName[filename] ?? []
    for (const entry of entries) {
      if (typeof entry.name === 'string') vocab.add(entry.name)
    }
  }
  return vocab
}

/**
 * Walk every traits[].type in every data file and flag any type that is
 * defined in neither traits.json nor keywords.json.
 */
export function findUnknownTraitTypes(
  filesByName: Record<string, Record<string, unknown>[]>
): TraitIssue[] {
  const vocab = buildKnownVocabulary(filesByName)
  const issues: TraitIssue[] = []

  for (const [filename, entities] of Object.entries(filesByName)) {
    for (const entity of entities) {
      const name = String(entity.name ?? entity.id ?? 'unknown')
      for (const type of collectTraitTypes(entity)) {
        if (vocab.has(type)) continue
        issues.push({
          file: filename,
          entity: name,
          kind: 'unknown-trait-type',
          detail: `trait type "${type}" is not defined in traits.json or keywords.json`,
        })
      }
    }
  }
  return issues
}

// ---------------------------------------------------------------------------
// Inline link check
// ---------------------------------------------------------------------------

function collectStrings(node: unknown, out: string[] = []): string[] {
  if (typeof node === 'string') out.push(node)
  else if (Array.isArray(node)) for (const item of node) collectStrings(item, out)
  else if (isObject(node)) for (const value of Object.values(node)) collectStrings(value, out)
  return out
}

/**
 * Flag every inline trait link, in any string of any row, whose name is not a
 * trait, and any inline markup that renders wrong. The renderers resolve
 * against traits.json only, ignoring case; component-lib's TraitRef does not
 * trim, so neither does this.
 */
export function findDeadInlineTraitLinks(
  filesByName: Record<string, Record<string, unknown>[]>
): TraitIssue[] {
  const traits = new Set(
    (filesByName['traits.json'] ?? [])
      .map((t) => t.name)
      .filter((n): n is string => typeof n === 'string')
      .map((n) => n.toLowerCase())
  )
  const issues: TraitIssue[] = []
  for (const [filename, entities] of Object.entries(filesByName)) {
    for (const entity of entities) {
      for (const text of collectStrings(entity)) {
        if (/\bthe \[\(CHASSIS\)\]/i.test(text)) {
          issues.push({
            file: filename,
            entity: entityName(entity),
            kind: 'inline-markup',
            detail:
              '"the [(CHASSIS)]" renders "The The <chassis>" — the token already supplies "The"',
          })
        }
        if (!text.includes('[[')) continue
        const refs = parseTraitReferences(text)
        let rest = text
        for (const ref of refs) rest = rest.replace(ref.fullMatch, '')
        if (rest.includes('[[')) {
          issues.push({
            file: filename,
            entity: entityName(entity),
            kind: 'inline-markup',
            detail: `unreadable "[[" markup renders as raw brackets: "${text.slice(0, 80)}"`,
          })
        }
        for (const ref of refs) {
          if (traits.has(ref.traitName.toLowerCase())) continue
          issues.push({
            file: filename,
            entity: entityName(entity),
            kind: 'dead-inline-trait',
            detail: `inline link ${ref.fullMatch} names no trait in traits.json — unlink it, or name a real trait`,
          })
        }
      }
    }
  }
  return issues
}
