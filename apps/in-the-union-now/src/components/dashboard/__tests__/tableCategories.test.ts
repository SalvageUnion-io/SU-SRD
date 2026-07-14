/**
 * Tests for the D3 Tables category map — the app-side `name → category`
 * classifier that drives the 5-column picker (roll tables carry no category
 * field). Pure logic: curated map first, then Crawler/Salvage substring rules,
 * then the COMBAT default; grouping always yields all 5 columns.
 */

import { describe, expect, test } from 'bun:test'

import { TABLE_CATEGORY_ORDER, categorizeTable, groupTablesByCategory } from '../tableCategories'

describe('categorizeTable', () => {
  test('curated headline tables map to their category', () => {
    expect(categorizeTable('Core Mechanic')).toBe('COMBAT')
    expect(categorizeTable('Critical Injury')).toBe('PILOT')
    expect(categorizeTable('Keepsake')).toBe('PILOT')
    expect(categorizeTable('Harvesting Chimerium')).toBe('SALVAGE')
    expect(categorizeTable('Trading Bay')).toBe('DOWNTIME')
  })

  test('substring rules catch the Crawler and Salvage families', () => {
    expect(categorizeTable('Crawler Deterioration')).toBe('CRAWLER')
    expect(categorizeTable('Crawler Name')).toBe('CRAWLER')
    expect(categorizeTable('Area Salvage')).toBe('SALVAGE')
    expect(categorizeTable('Salvage Cache Table (We Were Here First!)')).toBe('SALVAGE')
  })

  test('unknown tables fall to the COMBAT default', () => {
    expect(categorizeTable('Aardvarks Tongue')).toBe('COMBAT')
    expect(categorizeTable('The Hive Random Encounters')).toBe('COMBAT')
  })
})

describe('groupTablesByCategory', () => {
  test('always returns all 5 columns in order, even when empty', () => {
    const grouped = groupTablesByCategory([])
    expect(grouped.map((g) => g.category)).toEqual([...TABLE_CATEGORY_ORDER])
    for (const col of grouped) expect(col.tables).toEqual([])
  })

  test('routes each table into its column and sorts alphabetically', () => {
    const grouped = groupTablesByCategory([
      { id: 'b', name: 'Mech Salvage' },
      { id: 'a', name: 'Area Salvage' },
      { id: 'c', name: 'Core Mechanic' },
      { id: 'd', name: 'Crawler Damage' },
    ])
    const byCat = new Map(grouped.map((g) => [g.category, g.tables]))
    expect(byCat.get('SALVAGE')?.map((t) => t.name)).toEqual(['Area Salvage', 'Mech Salvage'])
    expect(byCat.get('COMBAT')?.map((t) => t.name)).toEqual(['Core Mechanic'])
    expect(byCat.get('CRAWLER')?.map((t) => t.name)).toEqual(['Crawler Damage'])
    expect(byCat.get('PILOT')).toEqual([])
    expect(byCat.get('DOWNTIME')).toEqual([])
  })
})
