import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { buildLinkFor } from '../buildLink'
import { ITUN_URL } from '../constants'

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture not found')
  return value
}

describe('buildLinkFor', () => {
  test('a Tech 1 chassis opens the mech wizard on it, by slug, from ITUN_URL', () => {
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(buildLinkFor('chassis', mule)).toEqual({
      href: `${ITUN_URL}/mechs/new?mode=guided&chassis=mule`,
      label: 'Build a mech with this',
    })
  })

  test('a chassis the wizard never offers gets no link', () => {
    const tech2 = must(SalvageUnionReference.Chassis.all().find((c) => c.techLevel === 2))
    expect(buildLinkFor('chassis', tech2)).toBeNull()
  })

  test('a core class opens the pilot wizard; an advanced or hybrid class gets no link', () => {
    const classes = SalvageUnionReference.Classes.all()
    const engineer = must(SalvageUnionReference.Classes.getByName('Engineer'))
    expect(buildLinkFor('classes', engineer)?.href).toBe(
      `${ITUN_URL}/pilots/new?mode=guided&class=engineer`
    )
    const advanced = must(classes.find((c) => !('coreTrees' in c)))
    expect(buildLinkFor('classes', advanced)).toBeNull()
  })

  test('every crawler type opens the crawler wizard on it', () => {
    for (const type of SalvageUnionReference.Crawlers.all()) {
      expect(buildLinkFor('crawlers', type)?.href).toBe(
        `${ITUN_URL}/crawlers/new?mode=guided&type=${getEntitySlug(type)}`
      )
    }
  })

  test('nothing else links to the builder', () => {
    const system = must(SalvageUnionReference.Systems.all()[0])
    expect(buildLinkFor('systems', system)).toBeNull()
  })
})
