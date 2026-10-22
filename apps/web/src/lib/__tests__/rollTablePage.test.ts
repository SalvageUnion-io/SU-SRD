import { describe, expect, test } from 'bun:test'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { RollTableRow } from '../rollTablePage'
import {
  plainText,
  rangeLabel,
  refText,
  rollAnnouncement,
  rollTableDensity,
  rowForRoll,
  splitRows,
} from '../rollTablePage'
import { rollTablePageData } from '../rollTablePageData'

const need = <T>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}

const tableNamed = (name: string) =>
  need(SalvageUnionReference.RollTables.getByName(name), name) as RefEntity
const firstOfType = (type: string) =>
  need(
    SalvageUnionReference.RollTables.all().find((t) => t.table.type === type),
    `a ${type} table`
  ) as RefEntity

describe('refText', () => {
  test('a band’s trait markup becomes references, resolved where the trait exists', () => {
    const vulnerable = {
      schemaName: 'traits' as const,
      id: 'vulnerable-id',
      slug: 'vulnerable',
      name: 'Vulnerable',
    }
    const resolve = (name: string) => (name === 'Vulnerable' ? vulnerable : undefined)
    const parts = refText('It gains the [[Vulnerable]] Trait and [[[Burn](X)]].', resolve)
    expect(parts).toEqual([
      'It gains the ',
      { text: 'Vulnerable', ref: vulnerable },
      ' Trait and ',
      { text: 'Burn (X)', ref: null },
      '.',
    ])
    expect(plainText(parts)).toBe('It gains the Vulnerable Trait and Burn (X).')
  })

  test('the names it prints in plain words are references too, outside the markup', () => {
    const prone = { schemaName: 'keywords' as const, id: 'prone-id', slug: 'prone', name: 'prone' }
    const parts = refText('It falls Prone and gains [[Prone]].', () => undefined, {
      nameRefs: { prone: [{ ref: prone }] },
    })
    expect(parts).toEqual([
      'It falls ',
      { text: 'Prone', ref: prone },
      ' and gains ',
      { text: 'Prone', ref: null },
      '.',
    ])
  })

  test('a page reference links where the index resolves it, as a card’s prose does', () => {
    const table = {
      schemaName: 'roll-tables' as const,
      id: 'overload-id',
      slug: 'reactor-overload',
      name: 'Reactor Overload',
    }
    const parts = refText(
      'Roll on the Reactor Overload Table p. 235.\n\nSee p. 9.',
      () => undefined,
      { pageRefs: { 235: [{ ref: table, noun: 'roll table' }] } }
    )
    expect(parts).toEqual([
      'Roll on the Reactor Overload Table ',
      { text: 'p. 235', ref: table },
      '.\n\nSee p. 9.',
    ])
  })
})

describe('splitRows', () => {
  const rowsOf = (name: string) => need(rollTablePageData(tableNamed(name)) ?? undefined, name).rows

  test('a long or wordy table splits in two; a short one stays one column', () => {
    expect(splitRows(rowsOf('Mechapult'))).toBe(true)
    expect(splitRows(rowsOf('Motto'))).toBe(true)
    expect(splitRows(rowsOf('Crawler Destruction'))).toBe(true)
    expect(splitRows(rowsOf('Core Mechanic'))).toBe(false)
  })
})

describe('rollTableDensity', () => {
  const densityOf = (name: string) => {
    const data = need(rollTablePageData(tableNamed(name)) ?? undefined, name)
    return rollTableDensity(data.rows, data.description)
  }
  const row = (label: string | null, value: string): RollTableRow => ({
    key: '1',
    label,
    value: [value],
  })

  test('bands that run long even in two columns set dense', () => {
    expect(densityOf('Mechapult')).toBe('dense')
    expect(densityOf('Anomalous Zone')).toBe('dense')
    expect(densityOf('Background')).toBe('dense')
  })

  test('a split table, or a long note over short bands, sets compact', () => {
    expect(densityOf('Motto')).toBe('compact')
    expect(densityOf('Crawler Destruction')).toBe('compact')
    expect(densityOf('Morale')).toBe('compact')
  })

  test('a short table under a short note keeps the board’s setting', () => {
    expect(densityOf('Area Salvage')).toBe('roomy')
  })

  test('labels count toward the bands, and the note toward compact only', () => {
    const bands = [row('x'.repeat(900), 'y'.repeat(900))]
    expect(rollTableDensity(bands, [])).toBe('dense')
    const short = [row(null, 'y'.repeat(600))]
    expect(rollTableDensity(short, [])).toBe('roomy')
    expect(rollTableDensity(short, ['z'.repeat(600)])).toBe('compact')
    expect(rollTableDensity(short, ['z'.repeat(5000)])).toBe('compact')
  })
})

describe('rollTablePageData', () => {
  test('the Core Mechanic: its prose and its five bands, highest first', () => {
    const data = need(rollTablePageData(tableNamed('Core Mechanic')) ?? undefined, 'data')
    expect(data.name).toBe('Core Mechanic')
    expect(data.description.length).toBeGreaterThan(0)
    expect(data.rows.map((row) => row.key)).toEqual(['20', '11-19', '6-10', '2-5', '1'])
    expect(data.rows[1]?.label).toBe('Success')
  })

  test('a two-roll columns table keeps the card’s view', () => {
    expect(rollTablePageData(firstOfType('columns'))).toBeNull()
  })

  test('anything that is not a roll table has no roll page', () => {
    const chassis = need(SalvageUnionReference.Chassis.getByName('Gopher'), 'gopher')
    expect(rollTablePageData(chassis)).toBeNull()
  })
})

describe('rowForRoll', () => {
  const data = need(rollTablePageData(tableNamed('Core Mechanic')) ?? undefined, 'data')

  test('a roll lands on the band whose range holds it', () => {
    expect(rowForRoll(data.table, data.rows, 14)?.key).toBe('11-19')
    expect(rowForRoll(data.table, data.rows, 20)?.label).toBe('Nailed it')
    expect(rowForRoll(data.table, data.rows, 1)?.label).toBe('Cascade Failure')
  })

  test('a table that prints only its 20 reads "Nothing happens." on 1–19', () => {
    const dramatic = need(rollTablePageData(firstOfType('dramatic')) ?? undefined, 'dramatic')
    expect(rowForRoll(dramatic.table, dramatic.rows, 20)?.key).toBe('20')
    expect(rowForRoll(dramatic.table, dramatic.rows, 5)?.key).toBe('1-19')
  })
})

describe('rollAnnouncement — what a roll’s toast reads', () => {
  test('the die, the range it lands on, the outcome’s name and text', () => {
    const core = need(rollTablePageData(tableNamed('Core Mechanic')) ?? undefined, 'core')
    const announced = rollAnnouncement(core, 14)
    expect(announced).toMatchObject({ table: 'Core Mechanic', roll: 14, range: '11–19' })
    expect(announced.label).toBe('Success')
    expect(announced.text.length).toBeGreaterThan(0)
  })

  test('a row with no name reads its text alone', () => {
    const data = need(rollTablePageData(tableNamed('Crawler Damage')) ?? undefined, 'data')
    const row = data.rows.find((r) => r.label === null)
    if (!row) throw new Error('fixture: an unlabelled Crawler Damage row')
    const roll = Number(row.key.split('-')[0])
    const announced = rollAnnouncement(data, roll)
    expect(announced.label).toBeUndefined()
    expect(announced.text).toBe(plainText(row.value))
  })

  test('a roll under a lone 20 lands on 1–19, "Nothing happens."', () => {
    const dramatic = need(rollTablePageData(firstOfType('dramatic')) ?? undefined, 'dramatic')
    expect(rollAnnouncement(dramatic, 5)).toMatchObject({
      table: dramatic.name,
      roll: 5,
      range: '1–19',
      text: 'Nothing happens.',
    })
  })
})

describe('reading the page', () => {
  test('a range reads with an en dash, as the book sets it', () => {
    expect(rangeLabel('11-19')).toBe('11–19')
    expect(rangeLabel('20')).toBe('20')
  })
})
