/**
 * THE stat order (owner, 2026-10-14): every surface draws an entity's stats in
 * one order, a smaller form dropping stats but never moving them. Tech Level
 * leads, then the groups: provenance (TL, Slots, SV), vitals (SP or HP, EP,
 * Heat, Bio-Salvage), capacity (SYS, MODS, Cargo; Upkeep, Upgrade), then the
 * action type and the action's facets (RNG, DMG), the traits, the cost.
 *
 * The order is the model's (`bookStats`, then the action); each surface's
 * labels must be a subsequence of it: Row, Tile, Token, Card, Peek, the Page's
 * band, the link preview and the Discord card.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefEntity, SURefEnumSchemaName, SURefMetaEntity } from 'salvageunion-reference'
import {
  discordCardParts,
  SalvageUnionReference,
  splitStatLine,
  toEntityModel,
} from 'salvageunion-reference'
import { ogCardForEntity } from '../../components/compositions/ogCardForEntity'
import { EntityPageStamps } from '../../components/referenceEntity/card/EntityPageStamps'
import { resolveEntityPageMeta } from '../../components/referenceEntity/card/entityPage'
import { ReferenceEntityCard } from '../../components/referenceEntity/card/ReferenceEntityCard'
import { Entity } from '../Entity'
import { PeekCard } from '../PeekCard'
import { actionTypeStamps } from '../parts/actionStamps'

const SCHEMAS: SURefEnumSchemaName[] = [
  'chassis',
  'systems',
  'modules',
  'equipment',
  'abilities',
  'drones',
  'vehicles',
  'creatures',
  'npcs',
  'squads',
  'bio-titans',
  'crawler-bays',
  'crawler-tech-levels',
]

/** A few of each kind: the first, and the first with an action type and stats both. */
function fixtures(schemaName: SURefEnumSchemaName): SURefMetaEntity[] {
  const all = SalvageUnionReference.findAllIn(schemaName, () => true) as SURefMetaEntity[]
  const both = all.find((entity) => {
    const model = toEntityModel(entity)
    return model.actionType && model.facts.some((fact) => fact.group !== 'action')
  })
  return [...all.slice(0, 2), ...(both ? [both] : [])]
}

const squash = (text: string) => text.replace(/[^a-z]/gi, '').toLowerCase()

/** The canonical order, each label under every name a surface prints it by. */
function canonical(entity: SURefMetaEntity) {
  const model = toEntityModel(entity)
  const { action } = splitStatLine(model.facts)
  const order: { id: string; names: string[] }[] = [
    ...model.bookStats.map((fact) => ({
      id: fact.short,
      names: [fact.short, fact.label, fact.label.split(' ')[0] ?? fact.label],
    })),
    ...actionTypeStamps(model.actionType, model.mechActionType).map((stamp) => ({
      id: stamp,
      names: [stamp],
    })),
    ...action.map((fact) => ({ id: fact.short, names: [fact.short, fact.label] })),
  ]
  const index = new Map<string, number>()
  order.forEach((entry, i) => {
    for (const name of entry.names) if (!index.has(squash(name))) index.set(squash(name), i)
  })
  return { order, index }
}

/** The positions in the canonical order of the labels a surface printed, in its order. */
function positions(entity: SURefMetaEntity, labels: string[]): number[] {
  const { index } = canonical(entity)
  return labels.flatMap((label) => {
    const at = index.get(squash(label))
    return at === undefined ? [] : [at]
  })
}

function expectInOrder(entity: SURefMetaEntity, surface: string, labels: string[]) {
  const at = positions(entity, labels)
  const sorted = [...at].sort((a, b) => a - b)
  expect({ surface, at }).toEqual({ surface, at: sorted })
}

/** Every label plate under `root`, in document order. */
function domLabels(root: Element | null): string[] {
  if (!root) return []
  return Array.from(root.querySelectorAll('.su-stat-plate--label, .su-stat-column__label')).map(
    (plate) => plate.textContent ?? ''
  )
}

/** The link preview's chip labels, in order. */
function ogLabels(schemaName: SURefEnumSchemaName, entity: SURefMetaEntity): string[] {
  const card = ogCardForEntity({ schemaName, entity, address: '/x' })
  return 'stats' in card ? card.stats.map((stat) => stat.label) : []
}

describe('one stat order on every surface', () => {
  for (const schemaName of SCHEMAS) {
    test(schemaName, () => {
      for (const entity of fixtures(schemaName)) {
        const name = toEntityModel(entity).title
        for (const form of ['row', 'tile', 'token'] as const) {
          const { container, unmount } = render(<Entity form={form} entity={entity} />)
          expectInOrder(entity, `${name} ${form}`, domLabels(container))
          unmount()
        }
        const card = render(<ReferenceEntityCard data={entity} />)
        expectInOrder(
          entity,
          `${name} card`,
          domLabels(card.container.querySelector('[data-chip-group]'))
        )
        card.unmount()
        const peek = render(<PeekCard entity={entity as SURefEntity} />)
        expectInOrder(
          entity,
          `${name} peek`,
          domLabels(peek.container.querySelector('[data-chip-group]'))
        )
        peek.unmount()
        const page = render(<EntityPageStamps meta={resolveEntityPageMeta(entity)} />)
        expectInOrder(entity, `${name} page`, domLabels(page.container))
        page.unmount()
        expectInOrder(entity, `${name} og`, ogLabels(schemaName, entity))
        const discord = discordCardParts(toEntityModel(entity)).head.slice(1).join(' · ')
        const discordLabels = Array.from(discord.matchAll(/\*\*([^*]+)\*\*/g), (m) => m[1] ?? '')
        expectInOrder(entity, `${name} discord`, discordLabels)
      }
    })
  }

  test('Tech Level leads every stat line that has one', () => {
    const shield = SalvageUnionReference.getByNameIn(
      'systems',
      'Electro-Magnetic Shield Projector'
    ) as SURefMetaEntity
    const { container } = render(<Entity form="row" entity={shield} />)
    expect(domLabels(container)[0]).toBe('TL')
    expect(resolveEntityPageMeta(shield).stats[0]?.label).toBe('Tech Level')
    expect(ogLabels('systems', shield)[0]).toBe('TL')
  })

  test('every chip in a group sits the same gap apart: no wider gap between groups', () => {
    const mule = SalvageUnionReference.getByNameIn('chassis', 'Mule') as SURefMetaEntity
    const { container } = render(<Entity form="row" entity={mule} />)
    const group = container.querySelector('[data-chip-group]')
    const sequence = Array.from(group?.children ?? []).map(
      (child) => child.querySelector('.su-stat-plate--label')?.textContent ?? '?'
    )
    expect(sequence).toEqual(['TL', 'SV', 'SP', 'EP', 'SYS', 'MODS'])
  })

  test('the cost, the pointy box, comes last in every chip group that has one', () => {
    let checked = 0
    for (const schemaName of ['systems', 'modules', 'abilities'] as const) {
      for (const entity of fixtures(schemaName)) {
        for (const form of ['row', 'token'] as const) {
          const { container, unmount } = render(<Entity form={form} entity={entity} />)
          const group = container.querySelector('[data-chip-group]')
          const cost = group?.querySelector('.su-cost')
          if (group && cost) {
            checked += 1
            const last = group.lastElementChild
            expect({ form, last: last?.contains(cost) }).toEqual({ form, last: true })
          }
          unmount()
        }
      }
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('traits run alphabetically, Uses last', () => {
    for (const schemaName of ['systems', 'modules', 'equipment'] as const) {
      for (const entity of SalvageUnionReference.findAllIn(
        schemaName,
        () => true
      ) as SURefMetaEntity[]) {
        const names = toEntityModel(entity).traits.map((trait) => trait.name.toLowerCase())
        const rest = names.filter((trait) => trait !== 'uses')
        const expected = [
          ...[...rest].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })),
          ...names.filter((trait) => trait === 'uses'),
        ]
        expect(names).toEqual(expected)
      }
    }
  })
})
