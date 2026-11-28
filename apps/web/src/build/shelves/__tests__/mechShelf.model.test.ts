import { describe, expect, test } from 'bun:test'
import {
  MECH_SORT_KEY,
  mechBuildFigures,
  nextSort,
  rememberSort,
  sortShelfRows,
  storedSort,
} from '../mechShelf.model'

describe('mechBuildFigures', () => {
  test('a bare chassis: its Tech Level, empty slots of its own, its Scrap', () => {
    const figures = mechBuildFigures({ chassisRef: 'mule', systems: [], modules: [] })
    expect(figures.techLevel).toBe(1)
    expect(figures.systems).toMatch(/^0\/\d+$/)
    expect(figures.modules).toMatch(/^0\/\d+$/)
    // By Tech Level, and its sort reads the highest level first (r6 E4).
    expect(figures.scrap).toMatch(/^TL1 \d+$/)
    expect(figures.scrapSort).toBeGreaterThan(0)
  })

  test('no chassis: nothing to say but the Scrap, which is none', () => {
    expect(mechBuildFigures({ chassisRef: '', systems: [], modules: [] })).toEqual({
      techLevel: undefined,
      systems: '',
      modules: '',
      scrap: '',
      scrapSort: 0,
      over: false,
    })
  })

  test('more slots than the chassis has is over (r2 G4); within them is not', () => {
    const within = mechBuildFigures({ chassisRef: 'scrapper', systems: ['chainsaw'], modules: [] })
    expect(within.over).toBe(false)
    const past = mechBuildFigures({
      chassisRef: 'scrapper',
      systems: Array.from({ length: 12 }, () => 'mini-mortar'),
      modules: [],
    })
    expect(past.over).toBe(true)
  })
})

describe('the remembered sort (r2 G4)', () => {
  test('a pressed sort is read back; nonsense in storage is no sort', () => {
    localStorage.removeItem(MECH_SORT_KEY)
    expect(storedSort()).toBeUndefined()
    rememberSort({ key: 'Scrap', descending: true })
    expect(storedSort()).toEqual({ key: 'Scrap', descending: true })
    localStorage.setItem(MECH_SORT_KEY, '{nope')
    expect(storedSort()).toBeUndefined()
    localStorage.removeItem(MECH_SORT_KEY)
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

describe('the Mechs shelf columns', () => {
  test('a narrow shelf spares the live readings and keeps what tells two builds apart', async () => {
    const { MECH_COLUMNS } = await import('../shelfColumns')
    expect(MECH_COLUMNS.filter((column) => column.spare).map((column) => column.key)).toEqual([
      'SP',
      'EP',
      'Heat',
    ])
    // A phone keeps the chassis and the build's Scrap, by Tech Level: one
    // name for it wherever a build is costed (r6 E4).
    expect(MECH_COLUMNS.filter((column) => column.phone).map((column) => column.key)).toEqual([
      'chassis',
      'Scrap',
    ])
  })
})
