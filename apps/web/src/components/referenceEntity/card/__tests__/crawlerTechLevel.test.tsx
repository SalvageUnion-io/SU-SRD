/**
 * A Union Crawler TECH LEVEL is a table row in the book (p.218) with no prose at
 * all: its whole content is Structure Points, Upkeep, Upgrade and a population
 * band. These tests pin each field to the card so none goes unrendered.
 */
import { describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const tier = (name: string) => {
  const found = SalvageUnionReference.CrawlerTechLevels.getByName(name)
  if (!found) throw new Error(`${name} fixture missing`)
  return found
}

/** Rendered text, whitespace-collapsed, for substring assertions. */
const textOf = (node: Parameters<typeof render>[0]) =>
  (render(node).container.textContent ?? '').replace(/\s+/g, ' ')

describe('crawler tech level card', () => {
  test('the card carries every stored field', () => {
    const text = textOf(<ReferenceEntityCard data={tier('Hamlet Crawler')} />)
    expect(text).toContain('Hamlet Crawler')
    expect(text).toContain('TL')
    expect(text).toContain('SP')
    expect(text).toContain('Upkeep')
    expect(text).toContain('Upgrade')
    expect(text).toContain('POP100–500')
  })

  test('another tier carries them in the same value cells', () => {
    const text = textOf(<ReferenceEntityCard data={tier('Town Crawler')} />)
    expect(text).toContain('Upkeep')
    expect(text).toContain('Upgrade')
    expect(text).toContain('POP2,000–5,000')
  })

  test('the MAXIMUM tier states no upgrade cost and an open-ended population', () => {
    // Megacity is the top of the table: `upgradeCost` is null in the data
    // because there is no next tier to buy, and `populationMax` is the
    // dataset's 0 "unbounded" marker.
    const text = textOf(<ReferenceEntityCard data={tier('Megacity Crawler')} />)
    expect(text).toContain('Upkeep')
    expect(text).not.toContain('Upgrade')
    expect(text).toContain('POP25,000+')
  })

  test('every tier in the schema renders more than its bare name', () => {
    for (const t of SalvageUnionReference.CrawlerTechLevels.all()) {
      const text = textOf(<ReferenceEntityCard data={t} />)
      expect(text).toContain('Upkeep')
      expect(text).toContain('POP')
      cleanup()
    }
  })
})
