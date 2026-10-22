/**
 * Hard rule R11: a Live Sheet's vitals are named from one map. The sheet
 * grammar e2e (`e2e/_sheetGrammar.ts`) checks each gauge's caption against its
 * own copy of the words; this keeps that copy equal to the map, and the map's
 * book stats equal to the names `bookStats` prints on a Page.
 */
import { describe, expect, test } from 'bun:test'
import { STAT_LABELS } from 'salvageunion-reference'
import { SHEET_VITAL_WORDS } from '../../../../e2e/_sheetGrammar'
import { SHEET_VITALS, vitalWords } from '../sheetVitals.model'

describe('the one vitals map', () => {
  test('the e2e copy is the map', () => {
    expect(SHEET_VITAL_WORDS).toEqual(
      Object.fromEntries(Object.entries(SHEET_VITALS).map(([key, v]) => [key, v.label]))
    )
  })

  test('the book stats are the book’s words', () => {
    expect(SHEET_VITALS.hp).toEqual(STAT_LABELS.hitPoints)
    expect(SHEET_VITALS.sp).toEqual(STAT_LABELS.structurePoints)
    expect(SHEET_VITALS.ep).toEqual(STAT_LABELS.energyPoints)
    expect(SHEET_VITALS.heat).toEqual(STAT_LABELS.heatCapacity)
  })

  test('a gauge stamps the short label and captions the full words', () => {
    expect(vitalWords('sp')).toEqual({ label: 'SP', subLabel: 'Structure Points' })
  })
})
