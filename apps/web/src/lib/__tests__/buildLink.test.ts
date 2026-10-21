import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from 'salvageunion-reference'
import { appPath } from '../appBase'
import { buildLinkFor, guideExitsFor, patternBuildLinkFor, STARTER_SET_HREF } from '../buildLink'

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('fixture not found')
  return value
}

describe('buildLinkFor', () => {
  test('a Tech 1 chassis opens the mech wizard on it, by slug, under the app base', () => {
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(buildLinkFor('chassis', mule)).toEqual({
      href: `${appPath('/mechs/new?mode=guided&chassis=mule')}`,
      label: 'Build With This',
      ariaLabel: 'Build With This: a mech',
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
      `${appPath('/pilots/new?mode=guided&class=engineer')}`
    )
    const advanced = must(classes.find((c) => !('coreTrees' in c)))
    expect(buildLinkFor('classes', advanced)).toBeNull()
  })

  test('a creation guide opens the builder for what it creates; another guide gets none', () => {
    const guides = SalvageUnionReference.Guides.all()
    const mech = must(guides.find((g) => g.guideType === 'mech-creation'))
    expect(buildLinkFor('guides', mech)).toMatchObject({ label: 'Build a mech' })
    expect(buildLinkFor('guides', mech)?.href).toContain('/mechs/new')
    const other = must(guides.find((g) => !String(g.guideType).endsWith('-creation')))
    expect(buildLinkFor('guides', other)).toBeNull()
  })

  test('every crawler type opens the crawler wizard on it', () => {
    for (const type of SalvageUnionReference.Crawlers.all()) {
      expect(buildLinkFor('crawlers', type)?.href).toBe(
        `${appPath('/crawlers/new?mode=guided&type=')}${getEntitySlug(type)}`
      )
    }
  })

  test('nothing else links to the builder', () => {
    const system = must(SalvageUnionReference.Systems.all()[0])
    expect(buildLinkFor('systems', system)).toBeNull()
  })
})

describe('patternBuildLinkFor', () => {
  const mule = () => must(SalvageUnionReference.Chassis.getByName('Mule'))
  const patternOf = (name: string) => must(mule().patterns?.find((p) => p.name === name))

  test('a legal starting pattern opens the mech wizard on its chassis and pattern', () => {
    expect(patternBuildLinkFor('chassis', mule(), patternOf('Hauler'))).toEqual({
      href: `${appPath('/mechs/new?mode=guided&chassis=mule&pattern=hauler')}`,
      label: 'Build With This',
      ariaLabel: 'Build With This: the Hauler mech',
    })
  })

  test('every tagged pattern gets the link; an untagged one none', () => {
    for (const chassis of SalvageUnionReference.Chassis.all()) {
      for (const pattern of chassis.patterns ?? []) {
        const link = patternBuildLinkFor('chassis', chassis, pattern)
        expect({ pattern: pattern.name, linked: link !== null }).toEqual({
          pattern: pattern.name,
          linked: pattern.legalStarting === true,
        })
      }
    }
    expect(patternBuildLinkFor('chassis', mule(), patternOf('Crusher'))).toBeNull()
  })

  test("a Bio-Titan's pattern gets no link", () => {
    const titan = must(SalvageUnionReference.BioTitans.all().find((t) => t.patterns?.length))
    const pattern = must(titan.patterns?.[0])
    expect(patternBuildLinkFor('bio-titans', titan, pattern)).toBeNull()
  })
})

describe('guideExitsFor', () => {
  const guide = (name: string) => must(SalvageUnionReference.Guides.getByName(name))

  test('Create a Pilot builds a pilot, walks on to Create a Mech, offers the Starter Set', () => {
    expect(guideExitsFor('guides', guide('Create a Pilot'))).toEqual({
      build: { href: `${appPath('/pilots/new?mode=guided')}`, label: 'Build a pilot' },
      next: { href: '/guides/create-a-mech/', label: 'Create a Mech' },
      starterSet: { href: `${appPath('/starter')}`, label: 'Or play the Starter Set' },
    })
  })

  test('Create a Mech walks on to Create a Crawler; Create a Crawler is the last', () => {
    const mech = guideExitsFor('guides', guide('Create a Mech'))
    expect(mech?.build.href).toBe(`${appPath('/mechs/new?mode=guided')}`)
    expect(mech?.next?.href).toBe('/guides/create-a-crawler/')
    const crawler = guideExitsFor('guides', guide('Create a Crawler'))
    expect(crawler?.build).toEqual({
      href: `${appPath('/crawlers/new?mode=guided')}`,
      label: 'Build a crawler',
    })
    expect(crawler?.next).toBeNull()
  })

  test('any other guide, or any other page, has no exits', () => {
    expect(guideExitsFor('guides', guide('Heat'))).toBeNull()
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    expect(guideExitsFor('chassis', mule)).toBeNull()
  })

  test("the Starter Set is the app's /starter", () => {
    expect(STARTER_SET_HREF).toBe(`${appPath('/starter')}`)
  })
})
