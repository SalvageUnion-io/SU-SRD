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
  ogCardLayout,
  ogCardPrintedTitle,
  ogCardThemeColor,
  ogCardTitle,
  ogTitleSize,
} from '../ogCardText'

/**
 * OgCard (board PV1): the link preview, one layout for both apps.
 * Each kind's card is read back for what a reader sees in the unfurl (the
 * title, the band's tone, the mark, the chips, the lines and the foot)
 * rather than snapshotted, so a token change does not rewrite every card.
 * Nothing sits above the title (EDL E20): the kind rides the foot line.
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
  // The page footer's row (kind and cite on the band's colour), then the bar.
  const cite = card?.children.length === 4 ? card.children[2] : undefined
  const foot = card?.lastElementChild
  if (!card || !band || !body || !foot) throw new Error('the card lost a part')
  const text = (el: Element | null | undefined) => el?.textContent ?? ''
  return {
    kind: card.getAttribute('data-og-card') ?? '',
    title: card.getAttribute('aria-label') ?? '',
    printed: text(host.querySelector('.su-chapter-band__title')),
    tone: band.getAttribute('style')?.match(/background-color:([^;]+)/)?.[1] ?? '',
    cells: [...card.querySelectorAll('.su-og-chips .su-stat-cell')].map((cell) => [
      text(cell.querySelector('.su-stat-plate--label')),
      text(cell.querySelector('.su-stat-plate--value')),
    ]),
    lines: [
      ...[...body.querySelectorAll(':scope > p')].map(text),
      ...(cite
        ? [[...cite.querySelectorAll(':scope > span, :scope > p')].map(text).join(' · ')]
        : []),
    ],
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
        ['TL', '1'],
        ['SP', '9'],
        ['EP', '9'],
        ['SV', '6'],
        ['SYS', '12'],
        ['MODS', '2'],
        ['Cargo', '6'],
        ['Heat', '8'],
      ],
      lines: ['Chassis · Workshop Manual · p.104'],
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
      tone: 'var(--color-pilot)',
      cells: [
        ['Long Action', ''],
        ['RNG', 'Close'],
      ],
      lines: [
        'You repair any number of damaged Mech Chassis, Vehicles, Systems, or Modules within Range to Intact Condition. They must be of a Tech Level equal to or lower than your Union Crawler.',
        'Ability · Mech-Tech Tree · Workshop Manual · p.29',
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
      lines: ["Pilot · Engineer · Rosa's pilot · Reclamation of the Wastes"],
      wordmark: 'The Cantina',
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
      lines: ['Mech Pattern · Scrapper · Made by alxjrvs'],
      wordmark: 'The Cantina',
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
      lines: ['NPC · From Veteran · Made by alxjrvs'],
      wordmark: 'The Cantina',
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
      tone: color.crawlerBand,
      cells: [],
      lines: [
        'Mediated by alxjrvs.',
        "You're invited · Player seat · Link expires 15 Oct · the Mediator lets you in",
      ],
      wordmark: 'The Cantina',
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
      lines: ['NPC · From Veteran · Made by alxjrvs'],
      wordmark: 'The Cantina',
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
      lines: ['Mech Pattern · Scrapper · Made by alxjrvs'],
      wordmark: 'The Cantina',
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
      tone: color.crawlerBand,
      cells: [],
      lines: [
        'Mediated by alxjrvs.',
        "You're invited · Player seat · Link expires 15 Oct · the Mediator lets you in",
      ],
      wordmark: 'The Cantina',
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
      wordmark: 'The Cantina',
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

  test('the reference cards say salvageunion.io; the player cards say The Cantina', () => {
    expect(renderToStaticMarkup(<OgCard {...THING} />)).toContain('salvageunion.io')
    expect(renderToStaticMarkup(<OgCard {...SHEET} />)).toContain('The Cantina')
  })

  test('theme-color is the band: the tone, resolved to a literal', () => {
    expect(ogCardThemeColor(SHEET)).toBe(color.pilot)
    expect(ogCardThemeColor(THING)).toBe(color.mech)
    // An ability wears its tier (Core orange), as its page band and Discord stripe do.
    expect(ogCardThemeColor(DO)).toBe(color.pilot)
    expect(ogCardThemeColor({ ...DO, tone: undefined } as OgCardProps)).toBe(color.inkDeep)
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

  test('chips ride the band beside the title, stacking before the title shrinks far', () => {
    const chassis = ['TL', 'SP', 'EP', 'SV', 'SYS', 'MODS', 'Cargo', 'Heat'].map(
      (label) => ({ kind: 'stat', label, value: '16' }) as const
    )
    const mule = ogCardLayout('Mule', chassis)
    expect(mule.chips).toBe('beside')
    expect(mule.titleSize).toBe(120)
    // Eight chips stack over the notch's foot rather than spanning the band.
    expect(mule.chipsWidth).toBeLessThan(700)
    expect(mule.bandHeight).toBe(230)
    expect(ogCardLayout('Mule', [])).toEqual({
      chips: 'beside',
      chipsWidth: 0,
      bandHeight: 230,
      titleSize: 120,
    })
  })

  test('a name too long to share its line keeps it whole, the chips under it', () => {
    const name = '\u201CSergeant Kessler of the Ninth\u201D'
    const layout = ogCardLayout(name, [
      { kind: 'stamp', text: 'User-made' },
      { kind: 'stat', label: 'HP', value: '9' },
      { kind: 'stat', label: 'Actions', value: '2' },
    ])
    expect(layout.chips).toBe('below')
    expect(layout.titleSize).toBe(ogTitleSize(name))
    expect(layout.bandHeight).toBe(230)
    // The card draws them on the page ground under the notch, User-made first.
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<OgCard {...LONG_NPC} />)
    expect(host.querySelector('.su-chapter-band .su-og-chips')).toBeNull()
    const below = host.querySelector('article > :nth-child(2) .su-og-chips')
    expect(below?.firstElementChild?.textContent).toBe('User-made')
  })

  test('the chips render in the band, not the body', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<OgCard {...THING} />)
    expect(host.querySelector('.su-chapter-band .su-og-chips')).not.toBeNull()
    expect(host.querySelector('article > :nth-child(2) .su-og-chips')).toBeNull()
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

  test('every title is set in the condensed display face the SRD loads', () => {
    for (const [, props] of KINDS) {
      const html = renderToStaticMarkup(<OgCard {...props} />)
      expect(html).toContain('font-family:&#x27;Barlow Semi Condensed&#x27;')
    }
  })
})

describe('ogCardForEntity', () => {
  test('a chassis is a thing: its tone, its model chips (TL first, MODS), its cite', () => {
    expect(THING.kind).toBe('thing')
    if (THING.kind !== 'thing') return
    expect(THING.title).toBe('Scrapper')
    expect(THING.kicker).toBe('Chassis')
    expect(THING.tone).toBe('var(--color-mech)')
    expect(THING.stats[0]).toEqual({ label: 'TL', value: '1' })
    expect(THING.stats.map((s) => s.label)).toContain('MODS')
    expect(THING.cite).toContain('p.')
  })

  test('a system carries its action type as printed, RNG, DMG and traits, in E17 order', () => {
    const gun = SalvageUnionReference.Systems.getByName('.50 Cal Machine Gun')
    if (!gun) throw new Error('no .50 Cal')
    const card = ogCardForEntity({ schemaName: 'systems', entity: gun, address: '/systems/x' })
    if (card.kind !== 'thing') throw new Error('a system is a thing')
    expect(card.stats.map((s) => s.label)).toEqual([
      'Turn Action',
      'TL',
      'Slots',
      'SV',
      'RNG',
      'DMG',
      'Ballistic',
      'Jamming',
      'Pinning',
    ])
  })

  test('an ability is a thing you do: tier numeral, chips, cost last, rules', () => {
    expect(DO.kind).toBe('do')
    if (DO.kind !== 'do') return
    expect(DO.kicker).toBe('Ability · Mech-Tech Tree')
    expect(DO.tier).toBe('3')
    expect(DO.stats[0]).toEqual({ label: 'Long Action' })
    expect(DO.cost).toBe('X AP')
    expect(DO.rules).toContain('You repair any number')
  })

  test('the tier numeral sits left of the name on the band, never above it', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToStaticMarkup(<OgCard {...DO} />)
    const heading = host.querySelector('.su-chapter-band__heading')
    expect(heading?.querySelector('.su-chapter-band__lead')?.textContent).toBe('3')
    expect(host.querySelector('.su-chapter-band__eyebrow')).toBeNull()
    // The cost is the last chip.
    const chips = host.querySelector('.su-og-chips')
    expect(chips?.lastElementChild?.textContent).toBe('X AP')
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
    expect(card.stats[0]).toEqual({ label: 'TL', value: '1' })
  })
})
