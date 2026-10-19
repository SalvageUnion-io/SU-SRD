/**
 * A chassis PATTERN has no entity of its own — it is a nested object on the
 * chassis, so its card's `data` IS the chassis. These tests pin the three
 * things that makes true of the UI:
 *
 * 1. A pattern row in a chassis's Patterns list is a real link to that
 *    pattern's own page, resolved through the surface's `hrefFor`.
 * 2. With no routes (an app whose patterns have no pages) the row stays inert
 *    rather than linking nowhere.
 * 3. The full pattern view reads chassis prose → pattern prose → systems →
 *    modules, so the pattern is framed by the chassis it belongs to.
 * 4. The chassis ability shows only on a PAGE — the chassis page and its
 *    pattern pages — and on the app's builder pick cards (`showChassisAbility`),
 *    never on any other card, a catalog tile or a nested card.
 */
import { describe, expect, test } from 'bun:test'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { EntityRef, RefObjectPattern } from 'salvageunion-reference'
import { nameToSlug, SalvageUnionReference, visiblePatterns } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { LEGAL_STARTING_PATTERN_NOTE } from '../legalStartingPattern'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** The Mule — a chassis carrying patterns, a chassis ability and chassis prose. */
const mule = () => {
  const found = SalvageUnionReference.Chassis.getByName('Mule')
  if (!found) throw new Error('Mule fixture missing')
  return found
}

/** Stands in for srd's routes: a pattern's page only. */
const testPatternHref = (ref: EntityRef) =>
  ref.pattern ? `/chassis/${nameToSlug(ref.name)}/pattern/${nameToSlug(ref.pattern)}` : undefined

/** A surface whose routes are `hrefFor`'s, as the SRD's are. */
const withRoutes = (hrefFor: (ref: EntityRef) => string | undefined, children: ReactNode) => (
  <EntitySurfaceProvider value={{ hrefFor }}>{children}</EntitySurfaceProvider>
)

describe('chassis pattern rows', () => {
  test('each row links to its pattern page', () => {
    const chassis = mule()
    render(withRoutes(testPatternHref, <ReferenceEntityCard data={chassis} />))

    const links = screen.getAllByRole('link', { name: /— Mule pattern$/ })
    expect(links.length).toBe(visiblePatterns(chassis.patterns ?? []).length)
    expect(links.length).toBeGreaterThan(0)

    const hauler = screen.getByRole('link', { name: 'Hauler — Mule pattern' })
    expect(hauler.getAttribute('href')).toBe('/chassis/mule/pattern/hauler')
  })

  test('a hidden pattern gets no row', () => {
    const chassis = mule()
    const hidden = (chassis.patterns ?? []).filter((p) => p.hidden)
    expect(hidden.length).toBeGreaterThan(0)

    render(withRoutes(testPatternHref, <ReferenceEntityCard data={chassis} />))

    for (const pattern of hidden) {
      expect(screen.queryByRole('link', { name: `${pattern.name} — Mule pattern` })).toBeNull()
    }
  })

  test('without a href builder the row is not a link', () => {
    render(<ReferenceEntityCard data={mule()} />)
    expect(screen.queryAllByRole('link', { name: /— Mule pattern$/ }).length).toBe(0)
    // The row itself still renders — it just isn't navigable.
    expect(screen.queryAllByText(/Hauler/).length).toBeGreaterThan(0)
  })
})

/** How many times the Mule's chassis ability prints. */
const abilityCount = (container: HTMLElement) =>
  (container.textContent ?? '').split('Integrated Cargo Bay').length - 1

describe('the chassis ability shows only on a page', () => {
  const hauler = () => {
    const pattern = mule().patterns?.find((p) => p.name === 'Hauler')
    if (!pattern) throw new Error('Hauler pattern fixture missing')
    return pattern
  }

  test('the chassis page shows it once', () => {
    const { container } = render(<ReferenceEntityCard data={mule()} presentation="page" />)
    expect(abilityCount(container)).toBe(1)
    expect(container.querySelector('.su-entity-page__lead')).not.toBeNull()
  })

  test('the pattern page shows it once, ahead of its Systems and Modules', () => {
    const { container } = render(
      <ReferenceEntityCard data={mule()} pattern={hauler()} presentation="page" />
    )
    expect(abilityCount(container)).toBe(1)
    const lead = container.querySelector('.su-entity-page__lead')
    const loadout = container.querySelector('.su-entity-page__loadout')
    expect(lead && loadout).toBeTruthy()
    expect(
      !!lead &&
        !!loadout &&
        !!(lead.compareDocumentPosition(loadout) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)
  })

  for (const [form, card] of [
    ['a chassis card', () => <ReferenceEntityCard data={mule()} size="full" />],
    ['a chassis catalog tile', () => <ReferenceEntityCard data={mule()} extent="catalog" />],
    ['a pattern card', () => <ReferenceEntityCard data={mule()} pattern={hauler()} />],
    [
      'a nested chassis card on a page',
      () => <ReferenceEntityCard data={mule()} depth={1} presentation="page" />,
    ],
  ] as const) {
    test(`${form} does not show it`, () => {
      const { container } = render(card())
      expect(abilityCount(container)).toBe(0)
    })
  }

  // The app's builder pick cards opt in: choosing a chassis or a pattern needs it.
  const PICK_HIDE = { actions: true, choices: true, patterns: true } as const

  test("the builder's chassis pick card shows it once, under the picker's hide.actions", () => {
    const { container } = render(
      <ReferenceEntityCard data={mule()} size="compact" hide={PICK_HIDE} showChassisAbility />
    )
    expect(abilityCount(container)).toBe(1)
  })

  test('the opt-in does not reach a catalog tile', () => {
    const { container } = render(
      <ReferenceEntityCard data={mule()} extent="catalog" showChassisAbility />
    )
    expect(abilityCount(container)).toBe(0)
  })

  /** The builder's pattern pick card, as `MechChassisStep` renders it. */
  function PatternPick({ showChassisAbility }: { showChassisAbility?: boolean }) {
    return (
      <ReferenceEntityCard
        data={mule()}
        pattern={hauler()}
        size="compact"
        hide={{ actions: true, choices: true }}
        showChassisAbility={showChassisAbility}
      />
    )
  }

  test("the builder's pattern pick card shows it once", () => {
    const { container } = render(<PatternPick showChassisAbility />)
    expect(abilityCount(container)).toBe(1)
  })

  test('a pattern card without the opt-in does not show it', () => {
    const { container } = render(<PatternPick />)
    expect(abilityCount(container)).toBe(0)
  })
})

describe('full pattern view reading order', () => {
  test('reads chassis prose → pattern prose → systems → modules', () => {
    const chassis = mule()
    const pattern = chassis.patterns?.find((p) => p.name === 'Hauler')
    if (!pattern) throw new Error('Hauler pattern fixture missing')

    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} size="full" />
    )
    const text = container.textContent ?? ''

    const chassisProse = text.indexOf("The 'M-63' Mule was developed")
    const patternProse = text.indexOf('This Mule, favoured by wastelanders')
    const systems = text.indexOf('Transport Hold')
    const modules = text.indexOf('Reactor Flare')

    for (const index of [chassisProse, patternProse, systems, modules]) {
      expect(index).toBeGreaterThan(-1)
    }
    expect(chassisProse).toBeLessThan(patternProse)
    expect(patternProse).toBeLessThan(systems)
    expect(systems).toBeLessThan(modules)
  })

  test('a system installed six times renders six badges, not one', () => {
    // The end-to-end guard for multiplicity in `resolvePatternGroups`. Atlas's
    // Thunder Storm prints as ".50 Cal Machine Gun x6" in the book; a loadout
    // de-duplicated by entity id renders a single machine gun and reads as a
    // far lighter build than it is.
    //
    // The loadout is the book's plain list of names rather than full cards,
    // and multiplicity REPEATS: six copies are six lines, not one
    // reading "×6". A count collapses the shape of the build out of the one
    // list whose job is showing it.
    const chassis = SalvageUnionReference.Chassis.getByName('Atlas')
    if (!chassis) throw new Error('Atlas fixture missing')
    const pattern = chassis.patterns?.find((p) => p.name === 'Thunder Storm')
    if (!pattern) throw new Error('Thunder Storm pattern fixture missing')
    // Guard the fixture: the count is what drives the expansion.
    expect(pattern.systems?.find((s) => s.name === '.50 Cal Machine Gun')?.count).toBe(6)

    render(<ReferenceEntityCard data={chassis} pattern={pattern} size="full" />)

    // One name node per rendered line.
    expect(screen.getAllByText('.50 Cal Machine Gun')).toHaveLength(6)
    // No collapsed count anywhere — the copies are the count.
    expect(screen.queryByText(/×6/)).toBeNull()
    // The uncounted systems stay single — the fix must not multiply everything.
    expect(screen.getAllByText('Shotgun Pit')).toHaveLength(1)
    expect(screen.getAllByText('Armour Plating')).toHaveLength(1)
  })
})

/**
 * THE LOADOUT IS THE BOOK'S PLAIN LIST. A pattern's systems and modules are
 * ordinary catalogue entities whose full text lives on their own pages, so the
 * pattern view names each one as a Mention with its framed TL, as Core Book
 * p.101 lists them, and links out, rather than reprinting every rule inline —
 * six full-length, identical .50 Cal Machine Gun cards for Thunder Storm — or
 * painting a TL-toned pill per part.
 */
describe('pattern loadout tokens', () => {
  /** Stands in for srd's entity routes. */
  const testEntityHref = (ref: EntityRef) =>
    ref.pattern ? undefined : `/${ref.schemaName}/${nameToSlug(ref.name)}`

  const thunderStorm = () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Atlas')
    if (!chassis) throw new Error('Atlas fixture missing')
    const pattern = chassis.patterns?.find((p) => p.name === 'Thunder Storm')
    if (!pattern) throw new Error('Thunder Storm pattern fixture missing')
    return { chassis, pattern }
  }

  /** The SRD's setup: a surface with routes, which links out through them. */
  const srdLinks = (children: ReactNode) => withRoutes(testEntityHref, children)

  test('every loadout entry links to its own page', () => {
    const { chassis, pattern } = thunderStorm()
    render(srdLinks(<ReferenceEntityCard data={chassis} pattern={pattern} size="full" />))

    // All six machine-gun copies are links, each to the system's one page.
    const guns = screen.getAllByRole('link', { name: /\.50 Cal Machine Gun/ })
    expect(guns).toHaveLength(6)
    for (const gun of guns) {
      expect(gun.getAttribute('href')).toBe('/systems/50-cal-machine-gun')
    }
    // Modules link out through the same builder.
    expect(screen.getByRole('link', { name: /Comms Module/ }).getAttribute('href')).toBe(
      '/modules/comms-module'
    )
  })

  test('the loadout does not reprint the entities` rules inline', () => {
    const { chassis, pattern } = thunderStorm()
    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} size="full" />
    )
    // The machine gun's own description belongs on its page, not six times over
    // in a pattern's loadout.
    expect(container.textContent).not.toContain('This simple ballistic weapon')
  })

  test('without a route the names are not links', () => {
    const { chassis, pattern } = thunderStorm()
    render(<ReferenceEntityCard data={chassis} pattern={pattern} size="full" />)
    expect(screen.queryAllByRole('link', { name: /\.50 Cal Machine Gun/ })).toHaveLength(0)
    // The names themselves still render — they just aren't navigable.
    expect(screen.getAllByText('.50 Cal Machine Gun')).toHaveLength(6)
  })

  test('on a surface with a Page opener, each name opens its Page', () => {
    // The app: no route, a detail dialog. The Mention follows the surface.
    const { chassis, pattern } = thunderStorm()
    const opened: EntityRef[] = []
    render(
      <EntitySurfaceProvider value={{ openPage: (ref) => opened.push(ref) }}>
        <ReferenceEntityCard data={chassis} pattern={pattern} size="full" />
      </EntitySurfaceProvider>
    )
    const guns = screen.getAllByRole('button', { name: '.50 Cal Machine Gun' })
    expect(guns).toHaveLength(6)
    guns[0]?.click()
    expect(opened.map((ref) => ref.name)).toEqual(['.50 Cal Machine Gun'])
  })

  test('each entry is one full-width Token: its name (its kind read out), then its action type, TL and Slots', () => {
    const { chassis, pattern } = thunderStorm()
    render(srdLinks(<ReferenceEntityCard data={chassis} pattern={pattern} size="full" />))
    const systems = screen.getByRole('list', { name: 'Systems installed' })
    expect(systems.classList.contains('su-entity-token-list')).toBe(true)
    const entries = Array.from(systems.querySelectorAll(':scope > li'))
    expect(entries.length).toBeGreaterThan(0)
    for (const entry of entries) {
      // One Token a line, the link itself.
      const tokens = entry.querySelectorAll('a.su-entity-token')
      expect(tokens).toHaveLength(1)
      const pill = tokens[0]?.querySelector('.su-entity-token__pill')
      // The kind is never stamped (E9): screen readers hear it after the name.
      expect(pill?.querySelector('.su-entity-token__kind')).toBeNull()
      expect(pill?.querySelector('.su-sr-only')?.textContent).toBe(' (System)')
      // Its chips follow the name, inside the pill, in E17's order: the
      // action type (when it has one) first, then TL, then Slots.
      const cells = Array.from(
        pill?.querySelectorAll(
          ':scope > .su-entity-token__chips > .su-chip-lane > .su-stat-cell'
        ) ?? []
      ).map((cell) => cell.textContent ?? '')
      const tl = cells.findIndex((text) => /^TL\s*\d+$/.test(text))
      expect(tl).toBeGreaterThanOrEqual(0)
      expect(cells[tl + 1]).toMatch(/^Slots\s*\d+$/)
      for (const lead of cells.slice(0, tl)) expect(lead).toMatch(/Action|Reaction|Passive/)
    }
  })

  test('each loadout group is an announced list', () => {
    // The loadout is a countable set of installed parts, so it is a real `ul`:
    // a screen reader says "list, 6 items" instead of reading a run of
    // anonymous links. The links carry their own name (the entity's), NOT the
    // line's scraped text — that would read ".50 Cal Machine Gun TL 1".
    const { chassis, pattern } = thunderStorm()
    render(srdLinks(<ReferenceEntityCard data={chassis} pattern={pattern} size="full" />))
    expect(screen.getByRole('list', { name: 'Systems installed' })).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Modules installed' })).toBeTruthy()
    // Exact accessible name, tail excluded.
    expect(screen.getAllByRole('link', { name: '.50 Cal Machine Gun' })).toHaveLength(6)
  })
})

/**
 * A PATTERN CARD IS NEVER `flat` — it takes the aside lead, which drops the
 * float. `wrapFlat` DISCARDS the key it is handed when `flat` is false, so
 * every call site has to set the key on the card itself too. The drone row was
 * the one that didn't, which made every multi-drone pattern on an artwork
 * chassis (all three Little Sestra patterns, Big Brother's DronTek) render
 * keyless list children the moment patterns moved below the fold.
 */
describe('pattern drone rows keep their keys', () => {
  test('no keyless-children warning on a drone-fielding pattern', () => {
    const warnings: string[] = []
    const realError = console.error
    console.error = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '))
    }
    try {
      for (const name of ['Little Sestra', 'Big Brother']) {
        const chassis = SalvageUnionReference.Chassis.getByName(name)
        if (!chassis) throw new Error(`${name} fixture missing`)
        for (const pattern of chassis.patterns ?? []) {
          render(<ReferenceEntityCard data={chassis} pattern={pattern} size="full" />)
          cleanup()
        }
      }
    } finally {
      console.error = realError
    }
    expect(warnings.filter((w) => w.includes('unique "key"'))).toHaveLength(0)
  })
})

/**
 * FOOTER PROVENANCE. A pattern carries its OWN source/booklet/page — often a
 * DIFFERENT book than the chassis it hangs off (the Mule ships from the Workshop
 * Manual, but its Acid Spitter pattern is from "We Were Here First!"). Because a
 * pattern card's `data` IS the chassis, the identity footer must read the
 * pattern's provenance, never the chassis's. Booklet + page fall back as one
 * unit with the source, so a pattern's source is never paired with the chassis's
 * page.
 */
describe('pattern footer provenance', () => {
  const patternOf = (name: string): RefObjectPattern => {
    const found = mule().patterns?.find((p) => p.name === name)
    if (!found) throw new Error(`${name} pattern fixture missing`)
    return found
  }

  test("the footer shows the pattern's own source + page, not the chassis's", () => {
    const chassis = mule()
    const acidSpitter = patternOf('Acid Spitter')
    // Guard the fixture: the pattern must genuinely diverge from its chassis.
    expect(acidSpitter.source).toBe('We Were Here First!')
    expect(acidSpitter.source).not.toBe(chassis.source)
    expect(acidSpitter.page).not.toBe(chassis.page)

    render(<ReferenceEntityCard data={chassis} pattern={acidSpitter} />)

    // The footer joins source · page into one line.
    expect(screen.getByText(`We Were Here First! · p.${acidSpitter.page}`)).toBeTruthy()
    // The chassis's own provenance must NOT leak into the pattern footer.
    expect(screen.queryByText(`${chassis.source} · p.${chassis.page}`)).toBeNull()
  })

  test('a booklet rides with the pattern source', () => {
    const survivor = patternOf('Survivor')
    // Survivor is from the Starter Set, booklet "PC" — booklet must pair with
    // the pattern's source, not be borrowed from the chassis.
    expect(survivor.source).toBe('Salvage Union Starter Set')
    expect(survivor.booklet).toBe('PC')

    render(<ReferenceEntityCard data={mule()} pattern={survivor} />)
    expect(screen.getByText(`Salvage Union Starter Set (PC) · p.${survivor.page}`)).toBeTruthy()
  })
})

/**
 * The "Legal Starting Pattern" stamp. It sits in the header labels RIGHT of the
 * `[Chassis | …]` marker specifically so it survives the LISTING extent — the
 * pattern rows under a chassis are header-only, and that list is where a reader
 * choosing a starting mech actually looks. Driven purely by the stored
 * `legalStarting` data tag; never computed from tech level or salvage value.
 */
describe('legal starting pattern stamp', () => {
  const patternOf = (name: string): RefObjectPattern => {
    const found = mule().patterns?.find((p) => p.name === name)
    if (!found) throw new Error(`${name} pattern fixture missing`)
    return found
  }

  test('the full pattern card stamps a tagged pattern', () => {
    render(<ReferenceEntityCard data={mule()} pattern={patternOf('Hauler')} />)
    expect(screen.getAllByText('Legal Starting Pattern').length).toBe(1)
  })

  test('an untagged pattern carries no stamp', () => {
    render(<ReferenceEntityCard data={mule()} pattern={patternOf('Crusher')} />)
    expect(screen.queryByText('Legal Starting Pattern')).toBeNull()
  })

  test('no pattern card or row wears a standalone "Pattern" tag', () => {
    render(<ReferenceEntityCard data={mule()} pattern={patternOf('Hauler')} />)
    expect(screen.queryByText(/^Pattern$/i)).toBeNull()
    cleanup()
    render(<ReferenceEntityCard data={mule()} presentation="page" />)
    expect(screen.queryByText(/^Pattern$/i)).toBeNull()
  })

  test('the chassis pattern LISTING stamps exactly its tagged patterns', () => {
    const chassis = mule()
    render(<ReferenceEntityCard data={chassis} />)
    const tagged = (chassis.patterns ?? []).filter((p) => p.legalStarting === true)
    expect(tagged.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Legal Starting Pattern').length).toBe(tagged.length)
  })

  test("a chassis PAGE's pattern rows stamp exactly its tagged patterns", () => {
    const chassis = mule()
    render(<ReferenceEntityCard data={chassis} presentation="page" />)
    const tagged = (chassis.patterns ?? []).filter((p) => p.legalStarting === true)
    expect(screen.getAllByText('Legal Starting Pattern').length).toBe(tagged.length)
  })

  for (const presentation of ['card', 'page'] as const) {
    test(`a tagged pattern closes its prose on the book's sentence (${presentation})`, () => {
      render(
        <ReferenceEntityCard
          data={mule()}
          pattern={patternOf('Hauler')}
          presentation={presentation}
        />
      )
      expect(screen.getAllByText(LEGAL_STARTING_PATTERN_NOTE).length).toBe(1)
    })

    test(`an untagged pattern carries no such sentence (${presentation})`, () => {
      render(
        <ReferenceEntityCard
          data={mule()}
          pattern={patternOf('Crusher')}
          presentation={presentation}
        />
      )
      expect(screen.queryByText(LEGAL_STARTING_PATTERN_NOTE)).toBeNull()
    })
  }
})

/**
 * A HOST'S PATTERN ROWS SHOW WHAT EACH PATTERN CHANGES. The host's stats and
 * abilities are shared by every pattern, so a row carries only the difference:
 * a mech pattern's loadout by name and TL, a Bio-Titan pattern's added
 * actions as contentful Tokens (N3: the row is level 1 at most, so they are
 * level 2). Both sit beside the row's link, never inside it —
 * they are links and controls of their own.
 */
describe('pattern rows show what each pattern changes', () => {
  const typhon = () => {
    const found = SalvageUnionReference.BioTitans.getByName('Typhon')
    if (!found) throw new Error('Typhon fixture missing')
    return found
  }
  const testHref = (ref: EntityRef) =>
    ref.pattern ? `/${nameToSlug(ref.name)}/pattern/${nameToSlug(ref.pattern)}` : undefined

  test('a mech pattern row on the Page lists its loadout by name', () => {
    render(<ReferenceEntityCard data={mule()} presentation="page" />)
    // A page's row splits Systems from Modules, each list named for its pattern.
    const systems = screen.getByRole('list', { name: 'Hauler Systems installed' })
    const modules = screen.getByRole('list', { name: 'Hauler Modules installed' })
    expect(systems.textContent).toContain('Transport Hold')
    expect(modules.textContent).toContain('Reactor Flare')
  })

  test('a Bio-Titan pattern row on the Page embeds the action it adds', () => {
    render(withRoutes(testHref, <ReferenceEntityCard data={typhon()} presentation="page" />))
    const row = screen.getByRole('link', { name: 'Hill Worm — Typhon pattern' })
    const added = screen.getByText('Metallic Reconstitution')
    // A contentful Token, its rules under its head; never a framed card.
    const token = added.closest('.su-entity-token[data-contentful]')
    expect(token?.querySelector('.su-entity-token__body')?.textContent).not.toBe('')
    expect(added.closest('.su-ec-frame .su-ec-frame')).toBeNull()
    // It is not nested inside the row's link.
    expect(row.contains(added)).toBe(false)
  })

  test("in a card a pattern is its Token alone: what it changes is its Peek's and Page's (E6)", () => {
    render(withRoutes(testHref, <ReferenceEntityCard data={typhon()} />))
    expect(screen.getByRole('link', { name: 'Hill Worm — Typhon pattern' })).toBeTruthy()
    expect(screen.queryByText('Metallic Reconstitution')).toBeNull()
    cleanup()
    const { container } = render(<ReferenceEntityCard data={mule()} />)
    expect(screen.queryByRole('list', { name: 'Hauler loadout' })).toBeNull()
    expect(container.textContent).not.toContain('Reactor Flare')
  })
})

describe('Bio-Titan pattern view', () => {
  test('reads pattern prose → its added action → the actions it inherits', () => {
    const host = SalvageUnionReference.BioTitans.getByName('Typhon')
    const pattern = host?.patterns?.find((p) => p.name === 'Hill Worm')
    if (!host || !pattern) throw new Error('Hill Worm fixture missing')

    const { container } = render(<ReferenceEntityCard data={host} pattern={pattern} size="full" />)
    const text = container.textContent ?? ''

    const patternProse = text.indexOf('lurks beneath the Wild Hills')
    const added = text.indexOf('Metallic Reconstitution')
    const inherited = text.indexOf('Burrower')
    for (const index of [patternProse, added, inherited]) expect(index).toBeGreaterThan(-1)
    expect(patternProse).toBeLessThan(added)
    expect(added).toBeLessThan(inherited)
    expect(screen.getByText('Pattern Actions')).toBeTruthy()
    // On a card the added action is level 2: a contentful Token (N3).
    const token = screen
      .getByText('Metallic Reconstitution')
      .closest('.su-entity-token[data-contentful]')
    expect(token).not.toBeNull()
  })
})
