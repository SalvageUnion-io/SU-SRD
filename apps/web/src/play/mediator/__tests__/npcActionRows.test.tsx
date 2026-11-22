/**
 * An Opposition unit's action rows, before Use is pressed: a weapon shows its
 * range, damage and traits (r5 B8), and a chassis ability names its chassis
 * where the book's text holds a placeholder (r5 B9; the data is unchanged).
 */

import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { newTrayNpc, readTrayNpc } from '../opposition.model'
import { PlayNpcActions } from '../PlayNpcActions'

function scrapperRows() {
  const scrapper = SalvageUnionReference.Chassis.getByName('Scrapper')
  const pattern = scrapper?.patterns?.[0]
  if (scrapper === undefined || pattern === undefined) throw new Error('no Scrapper pattern')
  const body = newTrayNpc('chassis', scrapper, [], '2026-11-22T00:00:00.000Z', { pattern })
  const npc = readTrayNpc({ _id: 'n1', body })
  const { container } = render(<PlayNpcActions npc={npc} canWrite onMorale={() => {}} />)
  return [...container.querySelectorAll('li.su-play-act')].map((li) => li.textContent ?? '')
}

describe('an Opposition unit’s action rows', () => {
  test('a weapon with no effect text still shows its traits before Use (r5 B8)', () => {
    const rigging = scrapperRows().find((row) => row.startsWith('Rigging Arm'))
    // Its Range chip and its trait, past the name.
    expect(rigging?.replace('Rigging Arm', '')).toContain('RNG')
    expect(rigging?.replace('Rigging Arm', '')).toContain('Rigging')
  })

  test('a chassis ability reads its chassis’s name, never the placeholder (r5 B9)', () => {
    const rows = scrapperRows()
    expect(rows.some((row) => row.includes('[(CHASSIS)]'))).toBe(false)
    expect(rows.some((row) => row.includes('Scrapper suffers no effect'))).toBe(true)
  })
})
