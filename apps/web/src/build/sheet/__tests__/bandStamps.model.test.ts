import { describe, expect, test } from 'bun:test'
import { nameToSlug } from 'salvageunion-reference'
import { resolveChassisRef } from 'salvageunion-reference/rules'
import { mechPatternStamp } from '../bandStamps.model'

const none = () => undefined

describe('mechPatternStamp', () => {
  test('a saved pattern: its name, linked to its page', () => {
    expect(
      mechPatternStamp({ chassisRef: 'mule', sourcePattern: 'p1' }, (id) =>
        id === 'p1' ? 'Nimble Hauler' : undefined
      )
    ).toEqual({ name: 'Nimble Hauler', href: '/p/pattern/p1' })
  })

  test('a saved pattern this browser does not hold still links', () => {
    expect(mechPatternStamp({ chassisRef: 'mule', sourcePattern: 'p1' }, none)?.href).toBe(
      '/p/pattern/p1'
    )
  })

  test('a book pattern: its name, linked under its chassis', () => {
    const chassis = resolveChassisRef('mule')
    const pattern = chassis?.patterns?.[0]
    if (!chassis || !pattern) throw new Error('the Mule has a pattern')
    const stamp = mechPatternStamp(
      { chassisRef: 'mule', startingPatternRef: nameToSlug(pattern.name) },
      none
    )
    expect(stamp?.name).toBe(pattern.name)
    expect(stamp?.href).toContain('/chassis/mule/pattern/')
  })

  test('a blank build says nothing', () => {
    expect(mechPatternStamp({ chassisRef: 'mule' }, none)).toBeUndefined()
  })
})
