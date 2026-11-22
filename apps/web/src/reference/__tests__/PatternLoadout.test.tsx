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
})
