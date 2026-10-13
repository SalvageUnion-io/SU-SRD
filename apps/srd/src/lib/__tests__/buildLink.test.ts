import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { buildLinkFor, guideExitsFor, STARTER_SET_HREF } from '../buildLink'
import { ITUN_URL } from '../constants'

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture not found')
  return value
}

describe('buildLinkFor', () => {
  test('a Tech 1 chassis opens the mech wizard on it, by slug, from ITUN_URL', () => {
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(buildLinkFor('chassis', mule)).toEqual({
      href: `${ITUN_URL}mechs/new?mode=guided&chassis=mule`,
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
      `${ITUN_URL}pilots/new?mode=guided&class=engineer`
    )
    const advanced = must(classes.find((c) => !('coreTrees' in c)))
    expect(buildLinkFor('classes', advanced)).toBeNull()
  })

  test('every crawler type opens the crawler wizard on it', () => {
    for (const type of SalvageUnionReference.Crawlers.all()) {
      expect(buildLinkFor('crawlers', type)?.href).toBe(
        `${ITUN_URL}crawlers/new?mode=guided&type=${getEntitySlug(type)}`
      )
    }
  })

  test('nothing else links to the builder', () => {
    const system = must(SalvageUnionReference.Systems.all()[0])
    expect(buildLinkFor('systems', system)).toBeNull()
  })
})

describe('guideExitsFor', () => {
  const guide = (name: string) => must(SalvageUnionReference.Guides.getByName(name))

  test('Create a Pilot builds a pilot, walks on to Create a Mech, offers the Starter Set', () => {
    expect(guideExitsFor('guides', guide('Create a Pilot'))).toEqual({
      build: { href: `${ITUN_URL}pilots/new?mode=guided`, label: 'Build a pilot' },
      next: { href: '/guides/create-a-mech/', label: 'Next: Create a Mech' },
      starterSet: { href: `${ITUN_URL}starter`, label: 'Or play the Starter Set' },
    })
  })

  test('Create a Mech walks on to Create a Crawler; Create a Crawler is the last', () => {
    const mech = guideExitsFor('guides', guide('Create a Mech'))
    expect(mech?.build.href).toBe(`${ITUN_URL}mechs/new?mode=guided`)
    expect(mech?.next?.href).toBe('/guides/create-a-crawler/')
    const crawler = guideExitsFor('guides', guide('Create a Crawler'))
    expect(crawler?.build).toEqual({
      href: `${ITUN_URL}crawlers/new?mode=guided`,
      label: 'Build a crawler',
    })
    expect(crawler?.next).toBeNull()
  })

  test('any other guide, or any other page, has no exits', () => {
    expect(guideExitsFor('guides', guide('Heat'))).toBeNull()
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(guideExitsFor('chassis', mule)).toBeNull()
  })

  test("the Starter Set is ITUN's /starter", () => {
    expect(STARTER_SET_HREF).toBe(`${ITUN_URL}starter`)
  })
})
