/**
 * Pure logic for trait-data validation in Salvage Union data.
 *
 * Three checks, all fixture-free (they flow from the schema/data, not from any
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
 */

import { readdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

export type TraitIssue = {
  file: string
  entity: string
  kind: 'casing' | 'unresolvable-removeTrait' | 'unknown-trait-type'
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

/** Effects declared on every `choices[].choiceOptions[].effects[]` of an entity. */
function collectChoiceEffects(entity: Entity): Effect[] {
  const effects: Effect[] = []
  if (!Array.isArray(entity.choices)) return effects
  for (const choice of entity.choices) {
    if (!isObject(choice) || !Array.isArray(choice.choiceOptions)) continue
    for (const option of choice.choiceOptions) {
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

/** Run both checks across a set of loaded data files. */
export function findTraitIssues(filesByName: Record<string, Entity[]>): TraitIssue[] {
  const issues: TraitIssue[] = []
  for (const [file, entities] of Object.entries(filesByName)) {
    issues.push(...findTraitCasingIssues(file, entities))
    issues.push(...findUnresolvableRemoveTraitIssues(file, entities))
  }
  issues.push(...findUnknownTraitTypes())
  return issues
}

// ---------------------------------------------------------------------------
// Vocabulary check
// ---------------------------------------------------------------------------

/** Trait types that intentionally resolve via keywords.json or are pending
 *  trait definitions sourced from the books. Shrink this list over time. */
const KNOWN_NON_TRAIT_TYPES = new Set([
  // pending trait definitions (need book text):
  'reliable',
  'deployable',
  'bio-equipment',
  'meld infection',
])

export type UnknownTraitType = {
  type: string
  file: string
  entityName: string
}

function loadDataDir(): Record<string, Record<string, unknown>[]> {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  const dataDir = join(__dirname, '..', 'data')
  const result: Record<string, Record<string, unknown>[]> = {}
  for (const filename of readdirSync(dataDir)) {
    if (!filename.endsWith('.json')) continue
    try {
      const parsed = JSON.parse(readFileSync(join(dataDir, filename), 'utf-8'))
      if (Array.isArray(parsed)) result[filename] = parsed
    } catch {
      // skip unparseable files
    }
  }
  return result
}

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
 * defined in neither traits.json nor keywords.json and is not in the
 * KNOWN_NON_TRAIT_TYPES allowlist.
 */
export function findUnknownTraitTypes(): UnknownTraitType[] {
  const filesByName = loadDataDir()
  const vocab = buildKnownVocabulary(filesByName)
  const issues: UnknownTraitType[] = []

  for (const [filename, entities] of Object.entries(filesByName)) {
    for (const entity of entities) {
      const name = String(entity.name ?? entity.id ?? 'unknown')
      for (const type of collectTraitTypes(entity)) {
        if (vocab.has(type)) continue
        if (KNOWN_NON_TRAIT_TYPES.has(type)) continue
        issues.push({ type, file: filename, entityName: name })
      }
    }
  }
  return issues
}
