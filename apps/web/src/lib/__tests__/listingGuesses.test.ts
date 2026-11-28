import { describe, expect, test } from 'bun:test'
import { ancestorOf, listingGuessesFor } from '../listingGuesses'

/** RR-21: a missed address that names a listing is offered the listing. */
describe('listingGuessesFor', () => {
  test('a misspelt listing is offered the listing', () => {
    expect(listingGuessesFor('/chasis/')[0]).toEqual({
      schemaId: 'chassis',
      label: 'Chassis',
      href: '/chassis/',
    })
    expect(listingGuessesFor('/sytems/')[0]?.href).toBe('/systems/')
    expect(listingGuessesFor('/Roll-Table/')[0]?.href).toBe('/roll-tables/')
  })

  test('a miss under a real listing is offered that listing', () => {
    expect(listingGuessesFor('/chassis/atlas/patterns/')[0]?.href).toBe('/chassis/')
  })

  test('an address that names no listing is offered none', () => {
    expect(listingGuessesFor('/zzzqxv/')).toEqual([])
    expect(listingGuessesFor('/')).toEqual([])
  })

  test('at most two', () => {
    expect(listingGuessesFor('/crawler/').length).toBeLessThanOrEqual(2)
  })
})

describe('ancestorOf', () => {
  test('the entry a deeper miss sits under', () => {
    expect(ancestorOf('/chassis/atlas/patterns/')).toEqual({ schemaId: 'chassis', slug: 'atlas' })
  })

  test('none for a miss at or above an entry', () => {
    expect(ancestorOf('/chassis/atlus/')).toBeUndefined()
    expect(ancestorOf('/nope/atlas/patterns/')).toBeUndefined()
  })
})
