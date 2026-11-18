// MOCK (Working Manual, wave 2): what a picker's and a review Ledger's columns
// read off an entity, one place for both. The values are the entity model's
// own (`toEntityModel`: its book stats, its action's facts, its traits), so a
// row says what the entity's card says. A component whose options are chosen
// reads through `resolveChoiceView`: its range, damage and traits are the
// chosen ones (the criteria's "chosen options must update the action").
import type { ReactNode } from 'react'
import type {
  ChoiceSelections,
  EntityModel,
  RefMetaEntity,
  RefObjectChoice,
} from 'salvageunion-reference'
import { resolveChoiceView, SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { Stat } from '../../components/index'
import { readReference } from '../../lib/readReference'
import type { PickColumn } from './PickList'

const models = new WeakMap<object, EntityModel>()

/** The entity's display model, built once an entity. */
export function modelOf(entity: RefMetaEntity): EntityModel {
  const known = models.get(entity)
  if (known) return known
  const built = toEntityModel(entity)
  models.set(entity, built)
  return built
}

type ActionRecord = {
  name: string
  activationCost?: number | string
  content?: unknown[]
  traits?: unknown[]
  choices?: RefObjectChoice[]
}

/** The action an ability or a piece of equipment folds into its card. */
function actionOf(entity: RefMetaEntity): ActionRecord | undefined {
  const names = 'actions' in entity && Array.isArray(entity.actions) ? entity.actions : []
  const first = names[0]
  if (typeof first !== 'string') return undefined
  return readReference(
    'pickColumns.actionOf',
    () => SalvageUnionReference.Actions.getByName(first) as ActionRecord | undefined,
    undefined
  )
}

/** Every choice the entity asks: its own, then its folded action's. */
export function choicesOf(entity: RefMetaEntity): RefObjectChoice[] {
  const own =
    'choices' in entity && Array.isArray(entity.choices)
      ? (entity.choices as RefObjectChoice[])
      : []
  return [...own, ...(actionOf(entity)?.choices ?? [])]
}

/** The entity as its options leave it: its range, damage and traits. */
function resolved(entity: RefMetaEntity, selections: ChoiceSelections | undefined) {
  if (!selections || Object.keys(selections).length === 0) return undefined
  const action = actionOf(entity)
  return resolveChoiceView(
    {
      content: (action?.content ?? ('content' in entity ? entity.content : undefined)) as never,
      traits: (action?.traits ?? []) as never,
      choices: choicesOf(entity),
    },
    selections
  )
}

const titleCase = (text: string) => text.replace(/\b[a-z]/g, (letter) => letter.toUpperCase())

/** Traits that are facts with a column of their own, or say only the kind. */
const NOT_A_TRAIT = /^(range|damage|pilot equipment)$/i

type Selected<T> = (row: T) => ChoiceSelections | undefined

function factValue(model: EntityModel, key: string): string {
  const found = model.facts.find((entry) => entry.key === key)
  if (found) return String(found.value)
  // A custom weapon prints its range and damage as keyword values.
  const keyword = model.traits.find((trait) => trait.name.toLowerCase() === key)
  return keyword?.param ? String(keyword.param) : ''
}

function bookValue(model: EntityModel, key: string): string {
  const found = model.bookStats.find((fact) => fact.key === key)
  return found ? String(found.value) : ''
}

function dataValue<T extends RefMetaEntity>(
  row: T,
  label: 'Range' | 'Damage',
  selected: Selected<T> | undefined
): string {
  const view = resolved(row, selected?.(row))
  const found = view?.datavalues.find(
    (value) => String(value.label).toLowerCase() === label.toLowerCase()
  )
  if (found && found.value !== undefined) {
    const unit = 'unit' in found && found.unit ? ` ${found.unit}` : ''
    return `${found.value}${unit}`
  }
  return factValue(modelOf(row), label.toLowerCase())
}

function traitLine<T extends RefMetaEntity>(row: T, selected: Selected<T> | undefined): string {
  const names = modelOf(row)
    .traits.filter((trait) => !NOT_A_TRAIT.test(trait.name))
    .map((trait) => (trait.param ? `${trait.name} ${trait.param}` : trait.name))
  const view = resolved(row, selected?.(row))
  for (const trait of view?.traits ?? []) {
    const name = titleCase(String((trait as { type?: string }).type ?? ''))
    if (name && !NOT_A_TRAIT.test(name) && !names.some((known) => known.startsWith(name)))
      names.push(name)
  }
  return names.join(', ')
}

/** The columns every acting thing shares, in §2.6's order: timing, range, damage, traits. */
function actionColumns<T extends RefMetaEntity>(selected?: Selected<T>): PickColumn<T>[] {
  return [
    {
      key: 'action',
      label: 'Action',
      kind: 'text',
      value: (row) => modelOf(row).actionType ?? '',
    },
    {
      key: 'range',
      label: 'RNG',
      title: 'Range',
      kind: 'text',
      value: (row) => dataValue(row, 'Range', selected),
    },
    {
      key: 'damage',
      label: 'DMG',
      title: 'Damage',
      kind: 'text',
      value: (row) => dataValue(row, 'Damage', selected),
    },
    { key: 'traits', label: 'Traits', kind: 'quiet', value: (row) => traitLine(row, selected) },
  ]
}

/** A system's or a module's columns: Slots, SV, then what it does. */
export function loadoutColumns<T extends RefMetaEntity>(): PickColumn<T>[] {
  return [
    {
      key: 'slots',
      label: 'Slots',
      title: 'Slots Required',
      phone: true,
      value: (row) => bookValue(modelOf(row), 'book-Slots Required'),
    },
    {
      key: 'sv',
      label: 'SV',
      title: 'Salvage Value, its cost in Scrap',
      phone: true,
      value: (row) => bookValue(modelOf(row), 'book-Salvage Value'),
    },
    ...actionColumns<T>(),
  ]
}

/** A piece of pilot equipment's columns; its options change them. */
export function equipmentColumns<T extends RefMetaEntity>(selected?: Selected<T>): PickColumn<T>[] {
  const [action, ...rest] = actionColumns<T>(selected)
  return [{ ...(action as PickColumn<T>), phone: true }, ...rest]
}

/** An ability's columns: its tree, its timing, its cost, its range, what it does. */
export function abilityColumns<T extends RefMetaEntity>(): PickColumn<T>[] {
  const [action, range] = actionColumns<T>()
  return [
    {
      key: 'tree',
      label: 'Tree',
      kind: 'text',
      phone: true,
      value: (row) => ('tree' in row && typeof row.tree === 'string' ? row.tree : ''),
    },
    action as PickColumn<T>,
    {
      key: 'ap',
      label: 'AP',
      title: 'Ability Points to use it',
      phone: true,
      value: (row) => {
        const cost = actionOf(row)?.activationCost
        return cost === undefined ? '' : String(cost)
      },
    },
    range as PickColumn<T>,
    {
      key: 'lead',
      label: 'What it does',
      kind: 'quiet',
      value: (row) => modelOf(row).lead ?? '',
    },
  ]
}

/**
 * The choices made on a component, each a `CHOSEN`-style chip (hard rule R60):
 * the choice's name its label, the pick its value. Nothing when none is made.
 */
export function chosenChips(
  entity: RefMetaEntity,
  selections: ChoiceSelections | undefined
): ReactNode {
  if (!selections) return undefined
  const made = choicesOf(entity).flatMap((choice) => {
    const picks = selections[choice.id] ?? []
    return picks.length > 0 ? [{ choice, picks }] : []
  })
  if (made.length === 0) return undefined
  return made.map(({ choice, picks }) => (
    <Stat key={choice.id} label={choice.name} value={picks.join(', ')} size="mini" />
  ))
}

/** How many of the entity's choices still want a pick. */
export function openChoices(
  entity: RefMetaEntity,
  selections: ChoiceSelections | undefined
): number {
  return choicesOf(entity).filter((choice) => (selections?.[choice.id]?.length ?? 0) === 0).length
}

/** A crawler weapon's columns: it costs nothing to mount, so what it does. */
export function weaponColumns<T extends RefMetaEntity>(): PickColumn<T>[] {
  return actionColumns<T>().map((column) =>
    column.key === 'range' || column.key === 'damage' ? { ...column, phone: true } : column
  )
}
