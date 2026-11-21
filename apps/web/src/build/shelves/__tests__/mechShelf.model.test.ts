import { describe, expect, test } from 'bun:test'
import { mechBuildFigures, nextSort, sortShelfRows } from '../mechShelf.model'

describe('mechBuildFigures', () => {
  test('a bare chassis: its Tech Level, empty slots of its own, its Scrap', () => {
    const figures = mechBuildFigures({ chassisRef: 'mule', systems: [], modules: [] })
    expect(figures.techLevel).toBe(1)
    expect(figures.systems).toMatch(/^0\/\d+$/)
    expect(figures.modules).toMatch(/^0\/\d+$/)
    expect(figures.scrap).toBeGreaterThan(0)
  })

  test('no chassis: nothing to say but the Scrap, which is none', () => {
    expect(mechBuildFigures({ chassisRef: '', systems: [], modules: [] })).toEqual({
      techLevel: undefined,
      systems: '',
      modules: '',
      scrap: 0,
    })
  })
})

describe('sortShelfRows', () => {
  const rows = [
    { name: 'Bravo', scrap: 9, sys: '12/12' },
    { name: 'alpha', scrap: 20, sys: '3/12' },
    { name: 'Charlie', scrap: 9, sys: '10/12' },
  ]
  const keys = (row: (typeof rows)[number], key: string) => row[key as 'scrap' | 'sys']

  test('unsorted keeps the order given', () => {
    expect(sortShelfRows(rows, undefined, keys).map((r) => r.name)).toEqual([
      'Bravo',
      'alpha',
      'Charlie',
    ])
  })

  test('a figure sorts by its number, the name breaking a tie; a second press flips it', () => {
    const up = nextSort(undefined, 'scrap')
    expect(sortShelfRows(rows, up, keys).map((r) => r.name)).toEqual(['Bravo', 'Charlie', 'alpha'])
    const down = nextSort(up, 'scrap')
    expect(down).toEqual({ key: 'scrap', descending: true })
    expect(sortShelfRows(rows, down, keys).map((r) => r.name)).toEqual([
      'alpha',
      'Bravo',
      'Charlie',
    ])
  })

  test('used/max sorts by what is used; names sort without case', () => {
    expect(sortShelfRows(rows, { key: 'sys', descending: false }, keys).map((r) => r.name)).toEqual(
      ['alpha', 'Charlie', 'Bravo']
    )
    expect(
      sortShelfRows(rows, { key: 'name', descending: false }, keys).map((r) => r.name)
    ).toEqual(['alpha', 'Bravo', 'Charlie'])
  })
})
