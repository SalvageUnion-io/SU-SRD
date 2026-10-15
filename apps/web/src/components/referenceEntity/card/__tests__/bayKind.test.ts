/**
 * BAY KIND PILL. A crawler bay card names which kind of bay it is in its
 * labels — `[Bay | Standard]` for the facilities on every Union Crawler,
 * `[Bay | Expansion]` for the ones built or found in play — read off the
 * stored `expansion` tag.
 */
import { describe, expect, test } from 'bun:test'
import { SalvageUnionReference } from 'salvageunion-reference'
import { resolveAxisMarkers } from '../entityCardTone'

const bayByName = (name: string) => {
  const found = SalvageUnionReference.CrawlerBays.getByName(name)
  if (!found) throw new Error(`crawler bay fixture missing: ${name}`)
  return found
}

describe('crawler bay kind', () => {
  test('a standard bay wears [Bay | Standard]', () => {
    expect(resolveAxisMarkers(bayByName('Med Bay'))).toEqual([{ label: 'Bay', value: 'Standard' }])
  })

  test('an expansion bay wears [Bay | Expansion]', () => {
    expect(resolveAxisMarkers(bayByName('Nanite Processing Bay'))).toEqual([
      { label: 'Bay', value: 'Expansion' },
    ])
  })
})
