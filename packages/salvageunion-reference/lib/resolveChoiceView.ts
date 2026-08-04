/**
 * resolveChoiceView — pure resolver for granted-equipment choices.
 *
 * Given an entity (e.g. Custom Sniper Rifle) carrying a base `datavalues`
 * content block, base `traits`, and a set of `choices`, plus the player's
 * current `selections`, compute the live dataview:
 *
 *   { datavalues, traits, prompts }
 *
 * - `datavalues`: the base datavalue row with applied effects (setRange
 *   replaces Range, addDamage bumps Damage), and unresolved required-choice
 *   prompts removed once resolved.
 * - `traits`: base traits with `addTrait`/`removeTrait` effects applied
 *   (explicit on a `source.kind: 'options'` option, or inferred from a
 *   shortlist `source.kind: 'catalog'` choice). Adding an existing trait
 *   upgrades its amount (Explosive 1 → 2).
 * - `prompts`: one entry per unresolved required choice (nothing selected),
 *   e.g. { choiceId, label, text: 'Choose: Ballistic or Energy' }.
 *
 * The function is deterministic and performs no I/O. It is the single source
 * of truth shared by srd (ephemeral selection state) and ITUN
 * (persisted selection state).
 *
 * It reads the UNIFIED choice encoding only — `source` / `cardinality` — never
 * the legacy `schemaEntities` / `choiceOptions` / `customSystemOptions` /
 * `multiSelect` / `constraints` fields. Reading the legacy half while the data
 * carried both was the live hazard: deleting a legacy duplicate would have
 * turned a resolved trait + prompt off silently, with the card still rendering
 * correctly. All 88 choices in the dataset were verified to resolve identically
 * across the switch.
 */

import type {
  SURefObjectChoice,
  SURefObjectContentBlock,
  SURefObjectDataValue,
  SURefObjectTrait,
} from './schemas/index.js'

/**
 * Selections keyed by choice id, each holding the selected option values.
 */
export type ChoiceSelections = Record<string, string[]>

/**
 * Unresolved required-choice prompt surfaced in the dataview row.
 */
export type ChoicePrompt = {
  choiceId: string
  label: string
  text: string
}

/**
 * The resolved dataview for an entity given a set of selections.
 */
export type ResolvedChoiceView = {
  datavalues: SURefObjectDataValue[]
  traits: SURefObjectTrait[]
  prompts: ChoicePrompt[]
}

/**
 * Minimal structural shape the resolver needs from an entity. Kept local so
 * the resolver accepts any entity carrying content + choices without forcing
 * the caller through the full SURefEntity union.
 */
type ResolvableEntity = {
  content?: SURefObjectContentBlock[]
  traits?: SURefObjectTrait[]
  choices?: SURefObjectChoice[]
}

/**
 * Find the entity's base `datavalues` content block and return a deep-ish copy
 * of its values (so effects mutate the view, never the source data).
 */
function baseDataValues(entity: ResolvableEntity): SURefObjectDataValue[] {
  const block = entity.content?.find((c) => c.type === 'datavalues')
  if (!block || !Array.isArray(block.value)) {
    return []
  }
  return block.value.map((dv) => ({ ...dv }))
}

/**
 * Locate a datavalue by case-insensitive label match.
 */
function findByLabel(
  datavalues: SURefObjectDataValue[],
  label: string
): SURefObjectDataValue | undefined {
  return datavalues.find(
    (dv) => typeof dv.label === 'string' && dv.label.toLowerCase() === label.toLowerCase()
  )
}

/**
 * A **shortlist catalog** choice — `source.kind: 'catalog'` naming specific
 * `entities` (e.g. Weapon Type → Ballistic / Energy) — is a trait-schema option
 * choice: the resolver infers `addTrait <selectedEntityName>` for each
 * selection. The option cards keep their entity linkage in the UI.
 *
 * A catalog with no shortlist ("pick any System that deals SP damage") is not
 * one of these: the pick is an entity, not a trait.
 */
function isInferredTraitChoice(choice: SURefObjectChoice): boolean {
  const source = choice.source
  return source?.kind === 'catalog' && Array.isArray(source.entities) && source.entities.length > 0
}

/**
 * Whether a choice is required — i.e. whether an unresolved one emits a
 * `Choose: …` prompt.
 *
 * `cardinality.min` is the answer whenever the choice declares one; a
 * multi-select modification choice declares `min: 0` (the player may take zero)
 * and so never prompts. A shortlist catalog with no declared cardinality is a
 * pick-one and is required.
 *
 * This used to read `constraints.min`, which is NOT a pick count — on the two
 * body-kit choices `constraints` is a `techLevel` RANGE (`{field:'techLevel',
 * min:3, max:4}`), and reading its `min` as "at least 3 picks" made them
 * required by accident. Both now declare `cardinality: {min:1, max:1}`, which
 * says the same thing on purpose.
 */
function isRequired(choice: SURefObjectChoice): boolean {
  if (choice.cardinality) {
    return choice.cardinality.min > 0
  }
  return isInferredTraitChoice(choice)
}

/**
 * Human-readable list of option labels for a choice, used in prompt text.
 */
function promptOptionLabels(choice: SURefObjectChoice): string[] {
  const source = choice.source
  if (source?.kind === 'options') {
    return source.options.map((o) => o.label)
  }
  if (source?.kind === 'catalog' && source.entities) {
    return [...source.entities]
  }
  return []
}

/**
 * Build the `Choose: A or B` prompt text from a choice's options.
 */
function buildPromptText(choice: SURefObjectChoice): string {
  const labels = promptOptionLabels(choice)
  if (labels.length === 0) {
    return `Choose: ${choice.name}`
  }
  if (labels.length === 1) {
    return `Choose: ${labels[0]}`
  }
  const head = labels.slice(0, -1).join(', ')
  const tail = labels[labels.length - 1]
  return `Choose: ${head} or ${tail}`
}

/**
 * Add a trait (by name) to the trait list. If the trait is already present,
 * upgrade its `amount` when a new one is given (e.g. Explosive 1 → Explosive 2);
 * otherwise leave the existing entry untouched. A fresh trait is pushed with its
 * `amount` when provided (e.g. Burn 1).
 */
function addTrait(traits: SURefObjectTrait[], type: string, amount?: string | number): void {
  const existing = traits.find((t) => t.type.toLowerCase() === type.toLowerCase())
  if (existing) {
    if (amount !== undefined) {
      existing.amount = amount
    }
    return
  }
  traits.push(amount !== undefined ? { type, amount } : { type })
}

/**
 * Remove a trait (by name) from the trait list, if present (e.g. Portable strips
 * Heavy). No-op when the trait isn't there.
 */
function removeTrait(traits: SURefObjectTrait[], type: string): void {
  const index = traits.findIndex((t) => t.type.toLowerCase() === type.toLowerCase())
  if (index !== -1) {
    traits.splice(index, 1)
  }
}

/**
 * Apply a `setRange` effect: replace the Range datavalue's value.
 */
function applySetRange(datavalues: SURefObjectDataValue[], value: string | number): void {
  const range = findByLabel(datavalues, 'Range')
  if (range) {
    range.value = value
  } else {
    datavalues.push({ label: 'Range', type: 'keyword', value })
  }
}

/**
 * Apply an `addDamage` effect: increase the Damage datavalue, respecting unit.
 * Numeric damage values are summed; non-numeric values are concatenated with
 * the unit (e.g. "2 SP / +1 SP") so no information is silently dropped.
 */
function applyAddDamage(
  datavalues: SURefObjectDataValue[],
  value: string | number,
  unit?: string
): void {
  const damage = findByLabel(datavalues, 'Damage')
  const numericDelta = typeof value === 'number' ? value : Number(value)
  if (!damage) {
    // Set the `unit` field (not concatenated into the value) so this matches the
    // mutate path and renders via the same [LABEL][value][unit] segmented chrome.
    datavalues.push({ label: 'Damage', type: 'keyword', value, unit })
    return
  }
  const current = damage.value
  if (typeof current === 'number' && !Number.isNaN(numericDelta)) {
    damage.value = current + numericDelta
    return
  }
  if (typeof current === 'string') {
    const currentNumeric = Number(current)
    if (!Number.isNaN(currentNumeric) && !Number.isNaN(numericDelta)) {
      damage.value = currentNumeric + numericDelta
      return
    }
  }
  const suffix = unit !== undefined ? `+${value} ${unit}` : `+${value}`
  damage.value = current === undefined ? suffix : `${current} / ${suffix}`
}

/**
 * Resolve the live dataview for an entity given a set of choice selections.
 */
export function resolveChoiceView(
  entity: ResolvableEntity,
  selections: ChoiceSelections
): ResolvedChoiceView {
  const datavalues = baseDataValues(entity)
  const traits: SURefObjectTrait[] = (entity.traits ?? []).map((t) => ({ ...t }))
  const prompts: ChoicePrompt[] = []

  const choices = entity.choices ?? []

  for (const choice of choices) {
    const selected = selections[choice.id] ?? []

    if (selected.length === 0) {
      // Unresolved. Emit a prompt only for required choices.
      if (isRequired(choice)) {
        prompts.push({
          choiceId: choice.id,
          label: choice.name,
          text: buildPromptText(choice),
        })
      }
      continue
    }

    if (isInferredTraitChoice(choice)) {
      // Trait-schema choice: infer addTrait for each selected entity name.
      for (const value of selected) {
        addTrait(traits, value)
      }
      continue
    }

    // An inline option list with explicit effects (`source.kind: 'options'`).
    if (choice.source?.kind === 'options') {
      const options = choice.source.options
      for (const value of selected) {
        const option = options.find((o) => o.value === value)
        if (!option?.effects) {
          continue
        }
        for (const effect of option.effects) {
          switch (effect.op) {
            case 'addTrait':
              addTrait(traits, String(effect.value), effect.amount)
              break
            case 'removeTrait':
              removeTrait(traits, String(effect.value))
              break
            case 'setRange':
              applySetRange(datavalues, effect.value)
              break
            case 'addDamage':
              applyAddDamage(datavalues, effect.value, effect.unit)
              break
          }
        }
      }
    }
  }

  return { datavalues, traits, prompts }
}
