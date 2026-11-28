/**
 * A pattern Page's loadout: a book pattern whose total reads over its
 * chassis's slots says the book prints it so (r3 C5), and wears no
 * rule-breaking mark (R71).
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { RefChassis } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { PatternLoadout } from '../PatternLoadout'

function loadout(chassisName: string, patternName: string): string {
  const chassis = SalvageUnionReference.Chassis.getByName(chassisName) as RefChassis
  const pattern = chassis.patterns.find((p) => p.name === patternName)
  if (!pattern) throw new Error(`${patternName} fixture missing`)
  return renderToStaticMarkup(<PatternLoadout chassis={chassis} pattern={pattern} />)
}

describe('PatternLoadout', () => {
  test('a printed over-slot pattern’s total says it is as printed in the book', () => {
    const html = loadout('Atlas', 'Evantis')
    expect(html).toContain('4/2')
    expect(html).toContain('as printed in the book')
  })

  test('a pattern within its slots says nothing more', () => {
    expect(loadout('Mule', 'Hauler')).not.toContain('as printed')
  })

  test('the total’s Scrap reads by Tech Level, as TL, and says so (r5 E13)', () => {
    const html = loadout('Atlas', 'Throne')
    const foot = html.slice(html.indexOf('<tfoot'))
    expect(foot).toMatch(/TL1 \d+ · TL3 \d+/)
    expect(foot).not.toMatch(/>T\d /)
    expect(foot).toContain('Scrap by Tech Level')
  })

  test('says what each weapon reaches and deals, in columns and under its name (r7 E6)', () => {
    const html = loadout('Mule', 'Hauler')
    const head = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'))
    expect(head).toContain('RNG')
    expect(head).toContain('DMG')
    expect(html).toContain('su-loadout-reach')
    expect(html).toMatch(/Close|Medium|Long|Far/)
  })
})
