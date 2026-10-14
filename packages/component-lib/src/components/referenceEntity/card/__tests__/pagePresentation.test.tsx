/**
 * THE CARD AS A PAGE (boards 07 and 08) — `presentation="page"`.
 *
 * Rendered through the real card with real SRD data:
 * - no frame, seam, header or footer: the page's chapter band carries the
 *   title, so the card prints no heading of its own;
 * - the line art is the hero; the stats are the book's, in its order and its
 *   words (`resolveEntityPageMeta`), and ride the band, never the body;
 * - a chassis ability is a framed card with no "Chassis Ability" stamp;
 * - the page's section bands are h2s and the cards nested under them title
 *   themselves h3 (`nestedTitleLevel`), a Bio-Titan pattern's "Pattern
 *   Actions" among them; a card no band holds (the chassis ability, a page's
 *   drone) keeps a span, so the outline never skips a level;
 * - a basic chassis's patterns are full-width link rows with a "Show all"
 *   link for a phone;
 * - what the page's bands say comes from the card's own helpers
 *   (`resolveEntityPageMeta`).
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntityHrefProvider, PatternHrefProvider } from '../../entityHrefContext'
import { pageBodyStats, resolveEntityPageMeta } from '../entityPage'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const gopher = () => need(SalvageUnionReference.Chassis.getByName('Gopher'), 'gopher')
const juryRig = () => need(SalvageUnionReference.Abilities.getByName('Jury Rig'), 'jury rig')

const patternHref = () => '/pattern/'

// The manual's eight, in its order, under their full names: a Page prints the
// long label, never the book's abbreviations ("Structure Pts.").
const BOOK_EIGHT = [
  'Structure Points',
  'Energy Points',
  'Heat Capacity',
  'System Slots',
  'Module Slots',
  'Cargo Capacity',
  'Tech Level',
  'Salvage Value',
]

describe('resolveEntityPageMeta — what the page’s bands say', () => {
  test('a chassis’s stats read the manual’s eight, in its order, in the body', () => {
    expect(resolveEntityPageMeta(gopher()).stats).toEqual([])
    const stats = pageBodyStats(gopher())
    expect(stats.map((s) => s.label)).toEqual(BOOK_EIGHT)
    expect(stats[0]?.value).toBe(String(gopher().structurePoints))
  })

  test('stats drop what the entity does not carry, and the TL when it has none', () => {
    const labels = resolveEntityPageMeta(juryRig()).stats.map((s) => s.label)
    expect(labels).not.toContain('Tech Level')
    expect(labels).not.toContain('Structure Points')
  })

  test('a chassis: its kind, TL and printings, its reprint after the book', () => {
    const meta = resolveEntityPageMeta(gopher())
    expect(meta.typeLabel).toBe('Chassis')
    expect(meta.techLevel).toBe('2')
    expect(meta.printings[0]).toEqual({ book: 'Workshop Manual', page: gopher().page })
    expect(meta.printings[1]).toEqual({ book: 'Salvage Union Starter Set (PC)', page: 26 })
  })

  test('an ability: its tree in its kind, its tier numeral, and its action type and cost on the band', () => {
    const ability = juryRig()
    const meta = resolveEntityPageMeta(ability)
    expect(meta.typeLabel).toContain('Tree')
    expect(meta.numeral).toBe(String(ability.level))
    expect(meta.actionTypes).toEqual(['Turn Action'])
    expect(meta.cost).toEqual({ value: '2', currency: 'AP' })
  })

  test("every chip rides the band: a system's action type, range, damage and traits", () => {
    const missilePod = need(SalvageUnionReference.Systems.getByName('Missile Pod'), 'Missile Pod')
    const meta = resolveEntityPageMeta(missilePod)
    expect(meta.actionTypes).toEqual(['Turn Action'])
    expect(meta.facts.map((f) => [f.label, f.value])).toEqual([
      ['RNG', 'Long'],
      ['DMG', '8 SP'],
    ])
    expect(meta.tags.map((t) => t.name)).toEqual(['Explosive', 'Hot', 'Missile', 'Uses'])
  })

  test('a chassis has no chips past its stats', () => {
    const meta = resolveEntityPageMeta(gopher())
    expect(meta.actionTypes).toEqual([])
    expect(meta.facts).toEqual([])
    expect(meta.tags).toEqual([])
    expect(meta).not.toHaveProperty('cost')
  })

  test('a pattern is a "Pattern" to screen readers', () => {
    const chassis = gopher()
    const pattern = need(chassis.patterns?.[0], 'gopher pattern')
    expect(resolveEntityPageMeta(chassis, pattern).typeLabel).toBe('Pattern')
  })
})

describe('the card as a page', () => {
  test('prints no title, seam or footer of its own: the page’s bands carry them', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    // The page body is the whole render: no card frame around it.
    expect(container.firstElementChild?.classList.contains('su-entity-page')).toBe(true)
    expect(container.querySelector('h1')).toBeNull()
    // The only header fills are the framed chassis ability's and the pattern
    // cards' heads, never the entity's own.
    for (const fill of container.querySelectorAll('[data-fill]')) {
      expect(fill.closest('.su-entity-page__lead, .su-pattern-rows')).not.toBeNull()
    }
    expect(container.textContent).not.toContain('Workshop Manual')
  })

  test('the line art is the hero, beside the right column', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    expect(container.querySelector('.su-entity-page__main--art')).not.toBeNull()
    expect(container.querySelector('.su-entity-page__art img')).not.toBeNull()
  })

  test('a chassis’s stats lead the body, inline, in the book’s words and order', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const column = container.querySelector('.su-entity-page__side > .su-entity-page__stats dl')
    expect(column?.getAttribute('aria-label')).toBe('Gopher stats')
    const labels = [...(column?.querySelectorAll('dt') ?? [])].map((dt) => dt.textContent)
    expect(labels).toEqual(BOOK_EIGHT)
  })

  test('the chassis ability is a framed card atop the right column, with no "Chassis Ability" stamp', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const lead = container.querySelector('.su-entity-page__lead')
    expect(lead).not.toBeNull()
    expect(lead?.textContent).not.toContain('Chassis Ability')
  })

  test('page prose carries no leaf size class, so it reads at the page’s 18px', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const prose = container.querySelector('.su-entity-page__prose')
    expect(prose).not.toBeNull()
    expect(prose?.querySelector('.text-sm, .text-xs')).toBeNull()
    expect(prose?.querySelector('[data-prose="flavor"], .font-medium')).not.toBeNull()
  })

  test('the chassis ability reads at 14px, not the compact 12px', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const lead = container.querySelector('.su-entity-page__lead')
    // Content sets its reading size inline (`fontSize: 0.875rem` is text-sm).
    const sizes = [...(lead?.querySelectorAll<HTMLElement>('[style]') ?? [])].map(
      (el) => el.style.fontSize
    )
    expect(sizes).toContain('0.875rem')
    expect(sizes).not.toContain('0.75rem')
  })

  test('a pattern page lists its loadout after its chassis ability, as full-width Tokens that Peek', () => {
    const chassis = gopher()
    const pattern = need(
      chassis.patterns?.find((p) => (p.systems?.length ?? 0) > 0),
      'gopher pattern with systems'
    )
    const { container } = render(
      <EntityHrefProvider value={() => '/entity/'}>
        <ReferenceEntityCard data={chassis} pattern={pattern} presentation="page" />
      </EntityHrefProvider>
    )
    const loadout = container.querySelector('.su-entity-page__loadout')
    expect(loadout).not.toBeNull()
    // pattern → chassis ability → Systems → Modules: after the chassis ability,
    // never in the opening above the chassis's prose.
    const following = (before: Element | null) =>
      !!before &&
      !!loadout &&
      !!(before.compareDocumentPosition(loadout) & Node.DOCUMENT_POSITION_FOLLOWING)
    expect(following(container.querySelector('.su-entity-page__lead'))).toBe(true)
    expect(container.querySelector('.su-entity-page__opening .su-entity-token')).toBeNull()
    // One Token a line, never a grid of Rows.
    expect(loadout?.querySelector('.su-entity-row')).toBeNull()
    const lists = loadout?.querySelectorAll('ul.su-entity-token-list') ?? []
    expect(lists.length).toBeGreaterThan(0)
    for (const list of lists) {
      for (const item of list.children) {
        expect(item.querySelectorAll('.su-entity-token[data-peek]')).toHaveLength(1)
      }
    }
  })

  test('patterns are full-width link rows, with a phone’s "Show all" link', () => {
    const chassis = gopher()
    const count = chassis.patterns?.length ?? 0
    render(
      <PatternHrefProvider value={patternHref}>
        <ReferenceEntityCard data={chassis} presentation="page" />
      </PatternHrefProvider>
    )
    const rows = screen.getAllByRole('link', { name: /Gopher pattern$/ })
    expect(rows).toHaveLength(count)
    expect(screen.getByRole('link', { name: `Show all ${count} patterns` })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Patterns', level: 2 })).toBeTruthy()
  })

  test('an entity with no art reads as one column', () => {
    const { container } = render(<ReferenceEntityCard data={juryRig()} presentation="page" />)
    expect(container.querySelector('.su-entity-page')).not.toBeNull()
    expect(container.querySelector('.su-entity-page__main--art')).toBeNull()
    expect(container.querySelector('.su-entity-page__art')).toBeNull()
  })

  test('cards nested in a page title themselves h3, under the section band’s h2', () => {
    const scylla = need(SalvageUnionReference.BioTitans.getByName('Scylla'), 'scylla')
    render(<ReferenceEntityCard data={scylla} presentation="page" />)
    expect(screen.getByRole('heading', { name: 'Actions', level: 2 })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tail Sweep (Action)', level: 3 })).toBeTruthy()
  })

  test('a stacked nested card is an h2 of its own: no "NPC" band repeats its stamp', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Command Bay'), 'command bay')
    render(<ReferenceEntityCard data={bay} presentation="page" />)
    expect(screen.queryByRole('heading', { name: 'NPC' })).toBeNull()
    const npc = need(bay.npc && 'position' in bay.npc ? bay.npc.position : undefined, 'npc')
    // Its kind ends its name, for screen readers only (E9).
    expect(screen.getByRole('heading', { name: new RegExp(`^${npc} \\(`), level: 2 })).toBeTruthy()
  })

  test('a bay’s crew NPC wears the cut-out head, its HP a chip right of the name', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Cantina'), 'cantina')
    render(<ReferenceEntityCard data={bay} presentation="page" />)
    const title = screen.getByRole('heading', { name: 'Chef (NPC)', level: 2 })
    const head = need(title.closest('.su-entity-row__head') ?? undefined, 'cut-out head')
    expect(head.getAttribute('data-notch')).toBe('true')
    expect(head.querySelector('.su-entity-row__notch')?.contains(title)).toBe(true)
    // The HP chip sits on the band beside the name, not on the tab.
    const heading = need(head.querySelector('.su-entity-row__heading--cut') ?? undefined, 'heading')
    const chips = need(
      heading.querySelector(
        ':scope > .su-chips, :scope > .su-entity-row__chip-group > .su-chips'
      ) ?? undefined,
      'chips on the band'
    )
    expect(chips.textContent).toBe('HP4')
    expect(head.textContent).toBe('Chef (NPC)HP4')
  })

  test('"When damaged" is a framed callout, its stamp riding the border', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Cantina'), 'cantina')
    render(<ReferenceEntityCard data={bay} presentation="page" />)
    const stamp = screen.getByText('When Damaged')
    expect(stamp.className).toContain('su-stamp-seam')
    const frame = need(stamp.parentElement ?? undefined, 'callout')
    expect(frame.style.borderWidth).toBe('var(--bw-chrome)')
    expect(frame.textContent).toContain(bay.damagedEffect ?? '')
  })

  test('the chassis ability and its seal stay spans: no band holds them', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const lead = need(container.querySelector('.su-entity-page__lead') ?? undefined, 'lead')
    expect(lead.querySelectorAll('h1, h2, h3, h4, h5, h6')).toHaveLength(0)
  })

  // The srd page's h1 is its ChapterBand, outside the card: from there the
  // outline may go down one level at a time, never skip one (axe
  // `heading-order`, which the srd a11y gate runs).
  const outlineSkips = (page: ReturnType<typeof render>) =>
    Array.from(page.container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .map((h) => ({ level: Number(h.tagName[1]), text: h.textContent ?? '' }))
      .filter((h, i, all) => i > 0 && h.level > (all[i - 1]?.level ?? 0) + 1)
      .map((h) => `h${h.level} ${h.text}`)
  type CardProps = Parameters<typeof ReferenceEntityCard>[0]
  const asPage = (data: CardProps['data'], pattern?: CardProps['pattern']) =>
    render(
      <main>
        <h1>Page</h1>
        <ReferenceEntityCard data={data} pattern={pattern} presentation="page" />
      </main>
    )
  // The headings between a band's h2 and the next h2: what the band holds.
  const underBand = (page: ReturnType<typeof render>, band: string) => {
    const headings = Array.from(page.container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    const start = headings.findIndex((h) => h.tagName === 'H2' && h.textContent === band)
    if (start === -1) return []
    const end = headings.findIndex((h, i) => i > start && Number(h.tagName[1]) <= 2)
    return headings
      .slice(start + 1, end === -1 ? undefined : end)
      .map((h) => `${h.tagName.toLowerCase()} ${h.textContent ?? ''}`)
  }

  test('a basic chassis page’s outline never skips a level from its h1', () => {
    for (const name of ['Gopher', 'Aegis']) {
      const page = asPage(need(SalvageUnionReference.Chassis.getByName(name), name))
      expect(outlineSkips(page)).toEqual([])
      page.unmount()
    }
  })

  // Every chassis page renders here (about a second alone, several under a
  // loaded parallel run), so it takes a longer timeout than the default 5s.
  test('no chassis page skips a heading level', () => {
    const skips = SalvageUnionReference.Chassis.all().flatMap((chassis) => {
      const page = asPage(chassis)
      const found = outlineSkips(page).map((skip) => `${chassis.name}: ${skip}`)
      page.unmount()
      return found
    })
    expect(skips).toEqual([])
  }, 30_000)

  test('a Bio-Titan pattern page titles its own actions h3 under "Pattern Actions"', () => {
    const typhon = need(SalvageUnionReference.BioTitans.getByName('Typhon'), 'typhon')
    const hillWorm = need(
      typhon.patterns?.find((p) => p.name === 'Hill Worm'),
      'typhon hill worm pattern'
    )
    const page = asPage(typhon, hillWorm)
    expect(screen.getByRole('heading', { name: 'Pattern Actions', level: 2 })).toBeTruthy()
    expect(underBand(page, 'Pattern Actions')).toContain('h3 Metallic Reconstitution (Action)')
    expect(outlineSkips(page)).toEqual([])
  })

  // Skip-free alone is not enough: a "Pattern Actions" h2 over span titles
  // skips nothing yet holds nothing, so each page's band must hold h3s too.
  test('every Bio-Titan pattern page holds its actions as h3s and skips no level', () => {
    const problems = SalvageUnionReference.BioTitans.all().flatMap((titan) =>
      (titan.patterns ?? []).flatMap((pattern) => {
        const page = asPage(titan, pattern)
        const label = `${titan.name} / ${pattern.name}`
        const found = outlineSkips(page).map((skip) => `${label}: ${skip}`)
        if ((pattern.actions?.length ?? 0) > 0) {
          const held = underBand(page, 'Pattern Actions')
          if (held.length === 0 || !held.every((h) => h.startsWith('h3 '))) {
            found.push(`${label}: Pattern Actions holds [${held.join(', ')}]`)
          }
        }
        page.unmount()
        return found
      })
    )
    expect(problems).toEqual([])
  }, 30_000)

  test('off a page, nested card titles stay spans', () => {
    const scylla = need(SalvageUnionReference.BioTitans.getByName('Scylla'), 'scylla')
    render(<ReferenceEntityCard data={scylla} />)
    expect(screen.queryAllByRole('heading')).toHaveLength(0)
  })

  test('a nested card never takes the page presentation', () => {
    const { container } = render(
      <ReferenceEntityCard data={gopher()} presentation="page" depth={1} />
    )
    expect(container.querySelector('.su-entity-page')).toBeNull()
  })
})

describe('nested cards read at one body size, their host’s', () => {
  /** Every prose size set inside the page's framed (nested) cards. */
  const nestedProseSizes = (container: HTMLElement): Set<string> =>
    new Set(
      Array.from(
        container.querySelectorAll<HTMLElement>(
          '.su-ec-frame .su-ec-block, .su-ec-frame .su-ec-block *'
        )
      )
        .map((el) => el.style.fontSize)
        .filter(Boolean)
    )

  test('a crawler page: its ability card and its NPC card alike (14px)', () => {
    const battle = SalvageUnionReference.getByNameIn('crawlers', 'Battle')
    if (!battle) throw new Error('fixture missing: Battle')
    const { container } = render(<ReferenceEntityCard data={battle} presentation="page" />)
    expect(nestedProseSizes(container)).toEqual(new Set(['0.875rem']))
  })

  test('a drone page: its systems read at the page’s card size too', () => {
    const drone = SalvageUnionReference.getByNameIn('drones', 'Combat Drone')
    if (!drone) throw new Error('fixture missing: Combat Drone')
    const { container } = render(<ReferenceEntityCard data={drone} presentation="page" />)
    expect(nestedProseSizes(container)).toEqual(new Set(['0.875rem']))
  })
})
