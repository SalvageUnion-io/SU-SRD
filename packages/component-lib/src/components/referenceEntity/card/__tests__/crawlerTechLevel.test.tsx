/**
 * A Union Crawler TECH LEVEL is a table row in the book (p.218) with no prose at
 * all: its whole content is Structure Points, Upkeep, Upgrade and a population
 * band. Four of those six fields reached no renderer, so every card in the
 * schema — catalog tile AND full page — showed nothing but a name, a TL and an
 * SP. These tests pin each field to a surface so that cannot silently return.
 */
import { beforeAll, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { crawlerPopulationRange } from '../crawlerPopulationRange'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const tier = (name: string) => {
  const found = SalvageUnionReference.CrawlerTechLevels.all().find((t) => t.name === name)
  if (!found) throw new Error(`${name} fixture missing`)
  return found
}

/** Rendered text, whitespace-collapsed, for substring assertions. */
const textOf = (node: Parameters<typeof render>[0]) =>
  (render(node).container.textContent ?? '').replace(/\s+/g, ' ')

describe('crawler tech level card', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('the CATALOG tile carries every stored field', () => {
    const text = textOf(
      <ReferenceEntityCard data={tier('Hamlet Crawler')} size="medium" extent="catalog" />
    )
    expect(text).toContain('Hamlet Crawler')
    expect(text).toContain('TL')
    expect(text).toContain('SP')
    expect(text).toContain('Upkeep')
    expect(text).toContain('Upgrade')
    expect(text).toContain('Population 100–500')
  })

  test('the FULL card carries them with the long stat labels', () => {
    const text = textOf(<ReferenceEntityCard data={tier('Town Crawler')} size="large" />)
    expect(text).toContain('Upkeep')
    expect(text).toContain('Upgrade')
    expect(text).toContain('Cost')
    expect(text).toContain('Population 2,000–5,000')
  })

  test('the MAXIMUM tier states no upgrade cost and an open-ended population', () => {
    // Megacity is the top of the table: `upgradeCost` is null in the data
    // because there is no next tier to buy, and `populationMax` is the
    // dataset's 0 "unbounded" marker.
    const text = textOf(
      <ReferenceEntityCard data={tier('Megacity Crawler')} size="medium" extent="catalog" />
    )
    expect(text).toContain('Upkeep')
    expect(text).not.toContain('Upgrade')
    expect(text).toContain('Population 25,000+')
  })

  test('every tier in the schema renders more than its bare name', () => {
    for (const t of SalvageUnionReference.CrawlerTechLevels.all()) {
      const text = textOf(<ReferenceEntityCard data={t} size="medium" extent="catalog" />)
      expect(text).toContain('Upkeep')
      expect(text).toContain('Population')
      cleanup()
    }
  })
})

describe('crawlerPopulationRange', () => {
  beforeAll(async () => {
    await SalvageUnionReference.preload('all')
  })

  test('formats a bounded band with an en dash and grouped thousands', () => {
    expect(crawlerPopulationRange(tier('City Crawler'))).toBe('5,000–15,000')
  })

  test('formats the unbounded top tier open-ended', () => {
    expect(crawlerPopulationRange(tier('Megacity Crawler'))).toBe('25,000+')
  })

  test('returns undefined for an entity that has no population band', () => {
    const mule = SalvageUnionReference.Chassis.all().find((c) => c.name === 'Mule')
    if (!mule) throw new Error('Mule fixture missing')
    expect(crawlerPopulationRange(mule)).toBeUndefined()
  })
})
