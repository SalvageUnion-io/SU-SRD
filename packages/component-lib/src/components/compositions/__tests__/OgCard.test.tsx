import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SURefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { color } from '../../../design/tokens'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'
import { OgCard } from '../OgCard'
import { ogCardForEntity } from '../ogCardForEntity'
import type { OgCardProps } from '../ogCardText'
import {
  ogCardDescription,
  ogCardPrintedTitle,
  ogCardThemeColor,
  ogCardTitle,
  ogTitleSize,
} from '../ogCardText'

/**
 * OgCard (board PV1): the link preview, one layout for both apps.
 * Each kind's card is read back for what a reader sees in the unfurl (the
 * title, the band's tone, the mark, the stat cells, the lines and the foot)
 * rather than snapshotted, so a token change does not rewrite every card.
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
    { label: 'Mech', value: 'Scrapper' },
  ],
  byline: "Rosa's pilot · Reclamation of the Wastes",
  address: 'itun.salvageunion.io/p/pilot/0a1b',
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
  address: 'itun.salvageunion.io/p/pattern/0a1b',
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
  quoted: false,
  address: 'itun.salvageunion.io',
}

const LONG = 'Sergeant Kessler of the Ninth Reclamation Wing, Retired'

const LONG_NPC: OgCardProps = { ...NPC, title: LONG } as OgCardProps
const LONG_PATTERN: OgCardProps = { ...PATTERN, title: LONG } as OgCardProps

const INVITE: OgCardProps = {
  kind: 'invite',
  kicker: "You're invited · Player seat",
  title: 'Reclamation of the Wastes',
  tone: color.crawler,
  summary: 'Mediated by alxjrvs.',
  terms: 'Link expires 15 Oct · the Mediator lets you in',
  address: 'itun.salvageunion.io',
}

const LONG_INVITE: OgCardProps = { ...INVITE, title: LONG } as OgCardProps

const PRIVATE: OgCardProps = { kind: 'private', address: 'itun.salvageunion.io' }

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
  address: '/chassis/scrapper',
})

const DO = ogCardForEntity({
  schemaName: 'abilities',
  entity: ability('Mass Field Repair'),
  address: '/abilities/mass-field-repair',
})

const KINDS: [string, OgCardProps][] = [
  ['reference thing', THING],
  ['reference do', DO],
  ['player sheet', SHEET],
  ['user-made pattern', PATTERN],
  ['user-made NPC', NPC],
  ['game invite', INVITE],
  ['long user-made NPC name', LONG_NPC],
  ['long user-made pattern name', LONG_PATTERN],
  ['long invite name', LONG_INVITE],
  ['private', PRIVATE],
]

type Seen = {
  kind: string
  title: string
  printed: string
  tone: string
  cells: [string, string][]
  lines: string[]
  wordmark: string
  address: string
}

/** Reads a rendered card back as the parts a reader sees. */
function read(props: OgCardProps): Seen & { src: string | null } {
  const host = document.createElement('div')
  host.innerHTML = renderToStaticMarkup(<OgCard {...props} />)
  const card = host.querySelector('article')
  const band = host.querySelector('.su-chapter-band')
  const body = card?.children[1]
  const foot = card?.children[2]
  if (!card || !band || !body || !foot) throw new Error('the card lost a part')
  const text = (el: Element | null | undefined) => el?.textContent ?? ''
  return {
    kind: card.getAttribute('data-og-card') ?? '',
    title: card.getAttribute('aria-label') ?? '',
    printed: text(host.querySelector('.su-chapter-band__title')),
    tone: band.getAttribute('style')?.match(/background-color:([^;]+)/)?.[1] ?? '',
    cells: [...body.querySelectorAll(':scope > div > div')].map((cell) => [
      text(cell.children[0]),
      text(cell.children[1]),
    ]),
    lines: [...body.querySelectorAll(':scope > p')].map(text),
    src: foot.querySelector('img')?.getAttribute('src') ?? null,
    wordmark: text(foot.querySelector('img + span')),
    address: text(foot.querySelector(':scope > span')),
  }
}

const SEEN: [string, OgCardProps, Seen][] = [
  [
    'reference thing',
    THING,
    {
      kind: 'thing',
      title: 'Scrapper',
      printed: 'Scrapper',
      tone: 'var(--color-mech)',
      cells: [
        ['SP', '9'],
        ['EP', '9'],
        ['Heat', '8'],
        ['SYS', '12'],
        ['MOD', '2'],
        ['Cargo', '6'],
      ],
      lines: ['Workshop Manual · p.104 · 5 patterns'],
      wordmark: 'salvageunion.io',
      address: '/chassis/scrapper',
    },
  ],
  [
    'reference do',
    DO,
    {
      kind: 'do',
      title: 'Mass Field Repair',
      printed: 'Mass Field Repair',
      tone: color.inkDeep,
      cells: [],
      lines: [
        'You repair any number of damaged Mech Chassis, Vehicles, Systems, or Modules within Range to Intact Condition. They must be of a Tech Level equal to or lower than your Union Crawler.',
        'Workshop Manual · p.29',
      ],
      wordmark: 'salvageunion.io',
      address: '/abilities/mass-field-repair',
    },
  ],
  [
    'player sheet',
    SHEET,
    {
      kind: 'sheet',
      title: 'Bonesaw',
      printed: 'Bonesaw',
      tone: color.pilot,
      cells: [
        ['HP', '8/10'],
        ['AP', '3/5'],
        ['TP', '2'],
        ['Mech', 'Scrapper'],
      ],
      lines: ["Rosa's pilot · Reclamation of the Wastes"],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io/p/pilot/0a1b',
    },
  ],
  [
    'user-made pattern',
    PATTERN,
    {
      kind: 'userMade',
      title: 'Tow Rig',
      printed: '\u201CTow Rig\u201D',
      tone: color.mech,
      cells: [
        ['TL', '1'],
        ['SYS', '12/12'],
      ],
      lines: ['Made by alxjrvs'],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io/p/pattern/0a1b',
    },
  ],
  [
    'user-made NPC',
    NPC,
    {
      kind: 'userMade',
      title: 'Sergeant Kessler',
      printed: 'Sergeant Kessler',
      tone: color.adversary,
      cells: [
        ['HP', '9'],
        ['Actions', '2'],
      ],
      lines: ['Made by alxjrvs'],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io',
    },
  ],
  [
    'game invite',
    INVITE,
    {
      kind: 'invite',
      title: 'Reclamation of the Wastes',
      printed: 'Reclamation of the Wastes',
      tone: color.crawler,
      cells: [],
      lines: ['Mediated by alxjrvs.', 'Link expires 15 Oct · the Mediator lets you in'],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io',
    },
  ],
  [
    'long user-made NPC name',
    LONG_NPC,
    {
      kind: 'userMade',
      title: LONG,
      printed: LONG,
      tone: color.adversary,
      cells: [
        ['HP', '9'],
        ['Actions', '2'],
      ],
      lines: ['Made by alxjrvs'],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io',
    },
  ],
  [
    'long user-made pattern name',
    LONG_PATTERN,
    {
      kind: 'userMade',
      title: LONG,
      printed: `\u201C${LONG}\u201D`,
      tone: color.mech,
      cells: [
        ['TL', '1'],
        ['SYS', '12/12'],
      ],
      lines: ['Made by alxjrvs'],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io/p/pattern/0a1b',
    },
  ],
  [
    'long invite name',
    LONG_INVITE,
    {
      kind: 'invite',
      title: LONG,
      printed: LONG,
      tone: color.crawler,
      cells: [],
      lines: ['Mediated by alxjrvs.', 'Link expires 15 Oct · the Mediator lets you in'],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io',
    },
  ],
  [
    'private',
    PRIVATE,
    {
      kind: 'private',
      title: 'Private',
      printed: 'Private',
      tone: color.inkDeep,
      cells: [],
      lines: ["Its owner hasn't shared this."],
      wordmark: 'ITUN',
      address: 'itun.salvageunion.io',
    },
  ],
]

describe('OgCard, read back per kind', () => {
  test('covers every kind the layout tests draw', () => {
    expect(SEEN.map(([name]) => name)).toEqual(KINDS.map(([name]) => name))
  })

  for (const [name, props, seen] of SEEN) {
    test(name, () => {
      const { src, ...rest } = read(props)
      expect(rest).toEqual(seen)
      expect(src).toBe('/logos/su-cargo-dark.svg')
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
    // The notch's dashes are 4px at the og scale, so they survive Discord's 400px draw.
    expect(made).toContain('border-top-style:dashed;border-top-width:4px')
  })

  test('the private card carries no name, stats or maker', () => {
    const html = renderToStaticMarkup(<OgCard {...PRIVATE} />)
    expect(html).toContain('Private')
    expect(html).toContain('Its owner hasn&#x27;t shared this.')
    expect(html).not.toContain('Made by')
    expect(ogCardTitle(PRIVATE)).toBe('Private')
    expect(ogCardDescription(PRIVATE)).toBe("Its owner hasn't shared this.")
  })

  test('the reference cards say salvageunion.io; the player cards say ITUN', () => {
    expect(renderToStaticMarkup(<OgCard {...THING} />)).toContain('salvageunion.io')
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

  test('a long name steps the notch down, never under the 34px floor', () => {
    expect(ogTitleSize('Scrapper')).toBe(120)
    expect(ogTitleSize('Reclamation of the Wastes')).toBeLessThan(120)
    expect(ogTitleSize('x'.repeat(200))).toBe(34)
  })

  test('the notch is sized from the string it prints, quotes included', () => {
    expect(ogCardPrintedTitle(PATTERN)).toBe('\u201CTow Rig\u201D')
    expect(ogCardPrintedTitle(NPC)).toBe('Sergeant Kessler')
    // 16 characters fit at 120px bare; the quotes of a pattern make it 18.
    const name = 'Sergeant Kessler'
    expect(ogTitleSize(`\u201C${name}\u201D`)).toBeLessThan(ogTitleSize(name))
    // The user-made NPC story at 120px wrapped in the real font: it must step down.
    expect(ogTitleSize(name)).toBeLessThan(120)
  })

  test('the wrapping SRD names step down so they hold one line', () => {
    for (const name of [
      'Monomolecular Sword',
      'Network Takeover',
      'Portable Flamethrower',
      'FM-3 Flamethrower',
    ]) {
      expect(ogTitleSize(name)).toBeLessThan(120)
      // The old 0.52em estimate let these wrap in the real face; 0.62em holds them.
      expect(name.length * 0.62 * ogTitleSize(name)).toBeLessThanOrEqual(1028)
    }
  })

  test('the notch is one line: a long player name steps down and ellipsizes', () => {
    for (const props of [LONG_NPC, LONG_PATTERN, LONG_INVITE]) {
      const html = renderToStaticMarkup(<OgCard {...props} />)
      expect(html).toContain('font-size:34px')
      expect(html).toContain(LONG)
    }
    const css = readPackageStylesheet()
    expect(css).toMatch(
      /\.su-chapter-band\[data-scale='og'\] \.su-chapter-band__title \{[^}]*white-space: nowrap[^}]*\}/
    )
    expect(css).toMatch(
      /\.su-chapter-band\[data-scale='og'\] \.su-chapter-band__title \{[^}]*text-overflow: ellipsis[^}]*\}/
    )
  })

  test('a pattern is quoted, an NPC is not', () => {
    expect(renderToStaticMarkup(<OgCard {...PATTERN} />)).toContain('\u201CTow Rig\u201D')
    const npc = renderToStaticMarkup(<OgCard {...NPC} />)
    expect(npc).toContain('>Sergeant Kessler<')
    expect(npc).not.toContain('\u201C')
  })

  test('a pilot sheet carries the MECH cell after HP, AP and TP', () => {
    const html = renderToStaticMarkup(<OgCard {...SHEET} />)
    expect(html.indexOf('>TP<')).toBeLessThan(html.indexOf('>Mech<'))
    expect(html).toContain('>Scrapper<')
  })

  test('the invite names who mediates and never a token', () => {
    const html = renderToStaticMarkup(<OgCard {...INVITE} />)
    expect(html).toContain('Mediated by alxjrvs.')
    expect(html).toContain('the Mediator lets you in')
  })

  test('every title and kicker is set in the condensed display face the SRD loads', () => {
    for (const [, props] of KINDS) {
      const html = renderToStaticMarkup(<OgCard {...props} />)
      expect(html).toContain('font-family:&#x27;Barlow Semi Condensed&#x27;')
    }
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
      address: '/chassis/scrapper/pattern/x',
    })
    expect(card.kind).toBe('thing')
    if (card.kind !== 'thing') return
    expect(card.title).toBe(pattern.name)
    expect(card.kicker).toBe('Pattern · Scrapper')
  })
})
