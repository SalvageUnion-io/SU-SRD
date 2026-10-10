import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color } from '../../../design/tokens'
import { OgCard } from '../OgCard'
import { ogCardForEntity } from '../ogCardForEntity'
import type { OgCardProps } from '../ogCardText'
import { ogCardDescription, ogCardThemeColor, ogCardTitle, ogTitleSize } from '../ogCardText'

/**
 * OgCard (issue 1280, board PV1): the link preview, one layout for both apps.
 * A snapshot per kind holds the markup each preview is screenshotted from, so
 * a change to a shared part (ChapterBand, the speckle, the stat boxes) shows
 * up here as a reviewed diff rather than silently in every unfurl.
 */

const SHEET: OgCardProps = {
  kind: 'sheet',
  kicker: 'Pilot · Engineer',
  title: 'Bonesaw',
  tone: color.pilot,
  stats: [
    { label: 'HP', value: '8/10' },
    { label: 'AP', value: '3/5' },
    { label: 'TP', value: '2' },
  ],
  byline: "Rosa's pilot · Reclamation of the Wastes",
  address: 'intheunionnow.com/p/pilot/0a1b',
}

const PATTERN: OgCardProps = {
  kind: 'userMade',
  kicker: 'Mech Pattern · Scrapper',
  title: 'Tow Rig',
  tone: color.mech,
  stats: [
    { label: 'TL', value: '1' },
    { label: 'SYS', value: '12/12' },
  ],
  madeBy: 'alxjrvs',
  address: 'intheunionnow.com/p/pattern/0a1b',
}

const NPC: OgCardProps = {
  kind: 'userMade',
  kicker: 'NPC · From Veteran',
  title: 'Sergeant Kessler',
  tone: color.adversary,
  stats: [
    { label: 'HP', value: '9' },
    { label: 'Actions', value: '2' },
  ],
  madeBy: 'alxjrvs',
  address: 'intheunionnow.com',
}

const INVITE: OgCardProps = {
  kind: 'invite',
  kicker: "You're invited · Player seat",
  title: 'Reclamation of the Wastes',
  tone: color.crawler,
  summary: 'Mediated by alxjrvs.',
  terms: 'Link expires 15 Oct · the Mediator lets you in',
  address: 'intheunionnow.com',
}

const PRIVATE: OgCardProps = { kind: 'private', address: 'intheunionnow.com' }

function chassis(name: string): SURefMetaEntity {
  const entity = SalvageUnionReference.Chassis.getByName(name)
  if (!entity) throw new Error(`no chassis ${name}`)
  return entity
}

function ability(name: string): SURefMetaEntity {
  const entity = SalvageUnionReference.Abilities.getByName(name)
  if (!entity) throw new Error(`no ability ${name}`)
  return entity
}

const THING = ogCardForEntity({
  schemaName: 'chassis',
  entity: chassis('Scrapper'),
  address: '/schema/chassis/item/scrapper',
})

const DO = ogCardForEntity({
  schemaName: 'abilities',
  entity: ability('Mass Field Repair'),
  address: '/schema/abilities/item/mass-field-repair',
})

const KINDS: [string, OgCardProps][] = [
  ['reference thing', THING],
  ['reference do', DO],
  ['player sheet', SHEET],
  ['user-made pattern', PATTERN],
  ['user-made NPC', NPC],
  ['game invite', INVITE],
  ['private', PRIVATE],
]

describe('OgCard snapshots', () => {
  for (const [name, props] of KINDS) {
    test(name, () => {
      expect(renderToStaticMarkup(<OgCard {...props} />)).toMatchSnapshot()
    })
  }
})

describe('OgCard', () => {
  test('draws at 1200 × 630', () => {
    const html = renderToStaticMarkup(<OgCard {...SHEET} />)
    expect(html).toContain('width:1200px')
    expect(html).toContain('height:630px')
  })

  test('sets no type under 34px at source, so the floor holds at 400px wide', () => {
    for (const [, props] of KINDS) {
      const html = renderToStaticMarkup(<OgCard {...props} />)
      const sizes = [...html.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((m) => Number(m[1]))
      expect(sizes.length).toBeGreaterThan(0)
      for (const size of sizes) expect(size).toBeGreaterThanOrEqual(34)
    }
  })

  test('canon is solid; user-made is dashed, hatched and stamped', () => {
    const solid = renderToStaticMarkup(<OgCard {...SHEET} />)
    expect(solid).toContain('border-style:solid')
    expect(solid).not.toContain('User-made')
    expect(solid).not.toContain('data-user-made')

    const made = renderToStaticMarkup(<OgCard {...PATTERN} />)
    expect(made).toContain('border-style:dashed')
    expect(made).toContain('data-user-made="true"')
    expect(made).toContain('User-made')
    expect(made).toContain('Made by alxjrvs')
  })

  test('the private card carries no name, stats or maker', () => {
    const html = renderToStaticMarkup(<OgCard {...PRIVATE} />)
    expect(html).toContain('Private')
    expect(html).toContain('Its owner hasn&#x27;t shared this.')
    expect(html).not.toContain('Made by')
    expect(ogCardTitle(PRIVATE)).toBe('Private')
    expect(ogCardDescription(PRIVATE)).toBe("Its owner hasn't shared this.")
  })

  test('the reference cards say SalvageUnion.io; the player cards say ITUN', () => {
    expect(renderToStaticMarkup(<OgCard {...THING} />)).toContain('SalvageUnion.io')
    expect(renderToStaticMarkup(<OgCard {...SHEET} />)).toContain('ITUN')
  })

  test('theme-color is the band: the tone, resolved to a literal', () => {
    expect(ogCardThemeColor(SHEET)).toBe(color.pilot)
    expect(ogCardThemeColor(THING)).toBe(color.mech)
    expect(ogCardThemeColor(DO)).toBe(color.inkDeep)
    expect(ogCardThemeColor(PRIVATE)).toBe(color.inkDeep)
  })

  test('og:description is the kicker and the byline, never the body', () => {
    expect(ogCardDescription(SHEET)).toBe(
      "Pilot · Engineer · Rosa's pilot · Reclamation of the Wastes"
    )
    expect(ogCardDescription(PATTERN)).toBe('Mech Pattern · Scrapper · Made by alxjrvs')
    expect(ogCardDescription(DO)).not.toContain(DO.kind === 'do' ? (DO.rules ?? '-') : '-')
  })

  test('a long name steps the notch down, never under 56px', () => {
    expect(ogTitleSize('Scrapper')).toBe(120)
    expect(ogTitleSize('Reclamation of the Wastes')).toBeLessThan(120)
    expect(ogTitleSize('x'.repeat(200))).toBe(56)
  })
})

describe('ogCardForEntity', () => {
  test('a chassis is a thing: its tone, its stats, its cite', () => {
    expect(THING.kind).toBe('thing')
    if (THING.kind !== 'thing') return
    expect(THING.title).toBe('Scrapper')
    expect(THING.kicker).toBe('Chassis · Tech Level 1')
    expect(THING.tone).toBe('var(--color-mech)')
    expect(THING.stats.map((s) => s.label)).toContain('SP')
    expect(THING.cite).toContain('p.')
  })

  test('an ability is a thing you do: tier numeral, cost pennant, rules', () => {
    expect(DO.kind).toBe('do')
    if (DO.kind !== 'do') return
    expect(DO.kicker.startsWith('Ability · Mech-Tech')).toBe(true)
    expect(DO.tier).toBe('3')
    expect(DO.cost).toBe('X AP')
    expect(DO.rules).toContain('You repair any number')
  })

  test('a pattern is its own thing, under its chassis', () => {
    const scrapper = chassis('Scrapper')
    const pattern = (scrapper as { patterns?: { name: string }[] }).patterns?.[0]
    if (!pattern) throw new Error('Scrapper has no pattern')
    const card = ogCardForEntity({
      schemaName: 'chassis',
      entity: scrapper,
      pattern: pattern as never,
      address: '/schema/chassis/item/scrapper/pattern/x',
    })
    expect(card.kind).toBe('thing')
    if (card.kind !== 'thing') return
    expect(card.title).toBe(pattern.name)
    expect(card.kicker).toBe('Pattern · Scrapper')
  })
})
