/**
 * THE CARD AS A PAGE — `presentation="page"`.
 *
 * Rendered through the real card with real SRD data:
 * - no frame, seam, header or footer: the page's chapter band carries the
 *   title, so the card prints no heading of its own;
 * - every entity's Page is the manual's (`.su-manual`): its stats lead the
 *   body as the stat column, all of them, in the book's order and its words
 *   (`pageStatLine`); the line art is the hero of the side column;
 * - a chassis ability and an entity's actions stand under their section's
 *   h2, each a contentful Mini (its rules text alone), never a heading;
 * - a host's patterns are one Ledger, a line each, each a link to its Page;
 * - a pattern's and a guide's Page keep the art-led layout: a pattern's
 *   stats ride its band (`resolveEntityPageMeta`), the cards nested under a
 *   section band title themselves h3 (`nestedTitleLevel`), a Bio-Titan
 *   pattern's "Pattern Actions" among them, so the outline never skips a
 *   level.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { EntityRef } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { pageBodyStats, pageStatLine, resolveEntityPageMeta } from '../entityPage'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const gopher = () => need(SalvageUnionReference.Chassis.getByName('Gopher'), 'gopher')
const juryRig = () => need(SalvageUnionReference.Abilities.getByName('Jury Rig'), 'jury rig')

/** Stands in for the reference site's routes: every pattern's page. */
const PATTERN_ROUTES = { hrefFor: (ref: EntityRef) => (ref.pattern ? '/pattern/' : undefined) }

// The manual's eight, in its order, under their full names: a Page prints the
// long label, never the book's abbreviations ("Structure Pts.").
// The book's eight, in the stat order every surface keeps: provenance,
// vitals, capacity.
const BOOK_EIGHT = [
  'Tech Level',
  'Salvage Value',
  'Structure Points',
  'Energy Points',
  'System Slots',
  'Module Slots',
  'Heat Capacity',
  'Cargo Capacity',
]

describe('resolveEntityPageMeta — what the page’s bands say', () => {
  test('a chassis’s stats read the manual’s eight, in the stat order, all in its Page’s body: its band has none', () => {
    expect(resolveEntityPageMeta(gopher()).stats).toEqual([])
    const line = pageStatLine(gopher())
    expect(line.map((s) => s.label)).toEqual(BOOK_EIGHT)
    expect(line[2]?.value).toBe(String(gopher().structurePoints))
  })

  test('a pattern’s page is its chassis’s: no stat on the band, the eight in the body', () => {
    const pattern = need(gopher().patterns?.[0], 'gopher pattern')
    expect(resolveEntityPageMeta(gopher(), pattern).stats).toEqual([])
    expect(pageStatLine(gopher()).map((s) => s.label)).toEqual(BOOK_EIGHT)
    const stats = pageBodyStats(gopher())
    expect(stats.map((s) => s.label)).toEqual(BOOK_EIGHT.slice(2))
    expect(stats[0]?.value).toBe(String(gopher().structurePoints))
  })

  test('stats drop what the entity does not carry, and the TL when it has none', () => {
    const labels = pageStatLine(juryRig()).map((s) => s.label)
    expect(labels).not.toContain('Tech Level')
    expect(labels).not.toContain('Structure Points')
  })

  test('a chassis: its kind, TL and printings, its reprint after the book', () => {
    const meta = resolveEntityPageMeta(gopher())
    expect(meta.typeLabel).toBe('Chassis')
    expect(meta.techLevel).toBe('2')
    expect(meta.printings[0]).toEqual({
      book: 'Workshop Manual',
      page: gopher().page,
      source: 'Salvage Union Workshop Manual',
    })
    expect(meta.printings[1]).toEqual({
      book: 'Salvage Union Starter Set (PC)',
      page: 26,
      source: 'Salvage Union Starter Set',
    })
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

  test('a lettered Tech Level is a letter in a chassis’s stat column, spelled out on an item’s band', () => {
    const chassis = need(SalvageUnionReference.Chassis.getByName('Stormterror'), 'Stormterror')
    const pattern = need(chassis.patterns?.[0], 'stormterror pattern')
    const tl = (stats: { key: string; value: string | number }[]) =>
      stats.find((s) => s.key === 'tech-level')?.value
    expect(tl(resolveEntityPageMeta(chassis, pattern).stats)).toBeUndefined()
    // The numeral's frame holds a letter, not a word.
    expect(tl(pageStatLine(chassis))).toBe('B')
    const nanite = SalvageUnionReference.Systems.all().find((s) => s.techLevel === 'N')
    if (nanite) expect(tl(resolveEntityPageMeta(nanite).stats)).toBe('Nanite')
    const bioTech = SalvageUnionReference.Systems.all().find((s) => s.techLevel === 'B')
    if (bioTech) expect(tl(resolveEntityPageMeta(bioTech).stats)).toBe('Bio-Tech')
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
    expect(container.firstElementChild?.classList.contains('su-manual')).toBe(true)
    expect(container.querySelector('h1')).toBeNull()
    expect(container.querySelector('.su-ec-frame')).toBeNull()
    // No head is filled in the entity's own tone but its patterns' Ledger's.
    for (const fill of container.querySelectorAll('[data-fill]')) {
      expect(fill.closest('.su-ledger')).not.toBeNull()
    }
    // The book is cited once, on the patterns' Ledger: the Page's own
    // citation is its foot band's, outside the card.
    const outside = container.cloneNode(true) as HTMLElement
    for (const ledger of outside.querySelectorAll('.su-ledger')) ledger.remove()
    expect(outside.textContent).not.toContain('Workshop Manual')
  })

  test('a suggested pick says so in a stamp under the band, after any extra line', () => {
    const { container } = render(
      <ReferenceEntityCard
        data={juryRig()}
        presentation="page"
        suggested
        subtitleExtra={<span>extra line</span>}
      />
    )
    const tags = container.querySelector('.su-entity-page__tags')
    expect(tags?.textContent).toBe('Suggested')
    const text = container.textContent ?? ''
    expect(text.indexOf('extra line')).toBeLessThan(text.indexOf('Suggested'))
  })

  test('a page that is not a suggested pick prints no stamp line', () => {
    const { container } = render(<ReferenceEntityCard data={juryRig()} presentation="page" />)
    expect(container.querySelector('.su-entity-page__tags')).toBeNull()
  })

  test('the line art is the hero, at the head of the side column', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const side = container.querySelector('.su-manual > .su-manual__side')
    expect(side?.firstElementChild?.classList.contains('su-manual__art')).toBe(true)
    expect(side?.querySelector('.su-manual__art img')).not.toBeNull()
  })

  test('a chassis’s stats lead the body as the stat column, in the book’s words, in the stat order', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const column = container.querySelector('.su-manual__main > ul.su-manual__stats')
    expect(column?.getAttribute('aria-label')).toBe('Gopher stats')
    const labels = [...(column?.querySelectorAll('.su-stat-label--long') ?? [])].map(
      (label) => label.textContent
    )
    expect(labels).toEqual(BOOK_EIGHT)
    // The Description leads the main track; the stat column follows it.
    expect(column?.previousElementSibling?.classList.contains('su-entity-page__prose')).toBe(true)
  })

  test('the chassis ability stands in the side column under its own h2: its rules text, never a heading', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const section = need(
      screen.getByRole('heading', { name: 'Chassis Ability', level: 2 }).closest('section') ??
        undefined,
      'the chassis ability section'
    )
    expect(section.closest('.su-manual__side')).not.toBeNull()
    expect(section.querySelector('.su-row-rules')?.textContent).toContain('Cargo Capacity')
    expect(section.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0)
    expect(container.querySelector('.su-ec-frame')).toBeNull()
  })

  test('page prose carries no leaf size class, so it reads at the page’s 18px', () => {
    const { container } = render(<ReferenceEntityCard data={gopher()} presentation="page" />)
    const prose = container.querySelector('.su-entity-page__prose')
    expect(prose).not.toBeNull()
    expect(prose?.querySelector('.text-sm, .text-xs')).toBeNull()
    expect(prose?.querySelector('[data-prose="flavor"], .font-medium')).not.toBeNull()
  })

  test('a pattern page lists its loadout after its opening, as open Ledger rows', () => {
    const chassis = gopher()
    const pattern = need(
      chassis.patterns?.find((p) => (p.systems?.length ?? 0) > 0),
      'gopher pattern with systems'
    )
    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} presentation="page" />
    )
    const loadout = container.querySelector('.su-entity-page__loadout')
    expect(loadout).not.toBeNull()
    // pattern → its opening → Systems → Modules, never in the opening itself.
    const opening = container.querySelector('.su-entity-page__opening')
    expect(
      !!opening &&
        !!loadout &&
        !!(opening.compareDocumentPosition(loadout) & Node.DOCUMENT_POSITION_FOLLOWING)
    ).toBe(true)
    expect(opening?.querySelector('.su-entity-mini')).toBeNull()
    // A row a part in its group's open Ledger (L1), never a framed card or a Compact.
    const rows = loadout?.querySelectorAll('table.su-open tr.su-open__row') ?? []
    expect(rows.length).toBeGreaterThanOrEqual((pattern.systems?.length ?? 0) > 0 ? 1 : 0)
    expect(loadout?.querySelector('.su-entity-compact')).toBeNull()
    expect(loadout?.querySelector('.su-ec-frame')).toBeNull()
  })

  test('patterns are one Ledger, a line each: its name the link, its loadout said whole', () => {
    const chassis = gopher()
    const count = chassis.patterns?.length ?? 0
    render(
      <EntitySurfaceProvider value={PATTERN_ROUTES}>
        <ReferenceEntityCard data={chassis} presentation="page" />
      </EntitySurfaceProvider>
    )
    const ledger = screen.getByRole('table', { name: 'Gopher patterns' })
    const rows = [...ledger.querySelectorAll('tbody tr')]
    expect(rows).toHaveLength(count)
    expect(ledger.querySelectorAll('tbody a[href="/pattern/"]')).toHaveLength(count)
    expect(rows[0]?.textContent).toContain(chassis.patterns?.[0]?.systems?.[0]?.name ?? '')
    expect(screen.queryByRole('link', { name: /show all/i })).toBeNull()
  })

  test('a pattern’s line counts a multiple and names each drone as the pattern does', () => {
    const chassis = need(SalvageUnionReference.Chassis.getByName('Big Brother'), 'big brother')
    render(<ReferenceEntityCard data={chassis} presentation="page" />)
    const line = screen.getByRole('table', { name: 'Big Brother patterns' }).textContent ?? ''
    expect(line).toContain('Shield Drone')
    expect(line).toContain('Minelayer Drone')
    const multiple = SalvageUnionReference.Chassis.all()
      .flatMap((c) => (c.patterns ?? []).map((p) => ({ c, p })))
      .find(({ p }) => p.systems?.some((s) => (s.count ?? 1) > 1))
    const { c, p } = need(multiple, 'a pattern with a counted system')
    const part = need(
      p.systems?.find((s) => (s.count ?? 1) > 1),
      'counted system'
    )
    render(<ReferenceEntityCard data={c} presentation="page" />)
    expect(screen.getByRole('table', { name: `${c.name} patterns` }).textContent).toContain(
      `${part.name} ×${part.count}`
    )
  })

  test('an entity with no art reads as one column', () => {
    const { container } = render(<ReferenceEntityCard data={juryRig()} presentation="page" />)
    expect(container.querySelector('.su-entity-page')).not.toBeNull()
    expect(container.querySelector('.su-manual__art')).toBeNull()
  })

  test('an entity’s actions stand under the "Actions" h2, each a Mini with its rules text', () => {
    const scylla = need(SalvageUnionReference.BioTitans.getByName('Scylla'), 'scylla')
    render(<ReferenceEntityCard data={scylla} presentation="page" />)
    const section = need(
      screen.getByRole('heading', { name: 'Actions', level: 2 }).closest('section') ?? undefined,
      'the actions section'
    )
    const names = [...section.querySelectorAll('.su-entity-mini[data-contentful]')].map(
      (mini) => mini.querySelector('.su-entity-mini__name')?.textContent
    )
    expect(names).toContain('Tail Sweep (Action)')
    expect(section.querySelectorAll('h3, h4, h5, h6')).toHaveLength(0)
  })

  test('a bay’s crew NPC on its Page is drawn open, never a Mini (N8)', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Cantina'), 'cantina')
    render(<ReferenceEntityCard data={bay} presentation="page" />)
    // One level deep on the Page: the NPC's own card, its heading and its text…
    expect(screen.getByRole('heading', { name: 'Chef (NPC)', level: 2 })).toBeTruthy()
    // …and no Mini for it.
    const token = Array.from(document.querySelectorAll('.su-entity-mini')).find((t) =>
      t.textContent?.startsWith('Chef')
    )
    expect(token).toBeUndefined()
  })

  test('a bay’s crew NPC in a Card is a Mini that Peeks its card through the bay', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Cantina'), 'cantina')
    render(<ReferenceEntityCard data={bay} />)
    const token = need(
      Array.from(document.querySelectorAll('.su-entity-mini')).find((t) =>
        t.textContent?.startsWith('Chef')
      ),
      'crew token'
    )
    expect(token.getAttribute('data-peek')).toBe(`crawler-bays:${bay.id}/npc`)
  })

  test('a card’s crew NPC is a Mini even under a write layer: level 2 holds Minis only (N1)', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Command Bay'), 'command bay')
    render(<ReferenceEntityCard data={bay} selections={{}} onSelectionChange={() => {}} />)
    const npc = need(bay.npc && 'position' in bay.npc ? bay.npc.position : undefined, 'npc')
    const token = need(
      Array.from(document.querySelectorAll('.su-entity-mini')).find((t) =>
        t.textContent?.startsWith(npc)
      ),
      'crew token'
    )
    expect(token).toBeTruthy()
    expect(screen.queryByRole('heading', { name: `${npc} (NPC)` })).toBeNull()
  })

  test('"When damaged" is the one block (R18): its Slab over the effect, as in a card', () => {
    const bay = need(SalvageUnionReference.CrawlerBays.getByName('Cantina'), 'cantina')
    const { container } = render(<ReferenceEntityCard data={bay} presentation="page" />)
    const slab = need(
      Array.from(container.querySelectorAll('[data-slab]')).find(
        (n) => n.textContent === 'When Damaged'
      ),
      'slab'
    )
    expect(slab.closest('.su-box')).toBeNull()
    expect(slab.nextElementSibling?.textContent).toContain(bay.damagedEffect ?? '')
  })

  // The reference page's h1 is its ChapterBand, outside the card: from there the
  // outline may go down one level at a time, never skip one (axe
  // `heading-order`, which the reference a11y gate runs).
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

  test('a crawler page: its ability and NPC chip what they are, under no band', () => {
    const augmented = SalvageUnionReference.getByNameIn('crawlers', 'Augmented')
    if (!augmented) throw new Error('fixture missing: Augmented')
    const { container } = render(<ReferenceEntityCard data={augmented} presentation="page" />)
    const text = container.textContent ?? ''
    expect(text).not.toContain('Ability and NPC')
    expect(text).toContain('Crawler Ability')
    const npcSeal = Array.from(container.querySelectorAll('.su-badge-stamp')).find(
      (el) => el.textContent === 'NPC'
    )
    expect(npcSeal).toBeTruthy()
  })

  test('a drone page: its choice table is collapsed to its head', () => {
    const drone = SalvageUnionReference.getByNameIn('drones', 'Sestra Drone')
    if (!drone) throw new Error('fixture missing: Sestra Drone')
    const { container } = render(<ReferenceEntityCard data={drone} presentation="page" />)
    expect(container.querySelector('.su-roll-token')).not.toBeNull()
    expect(container.querySelector('.su-roll__rows')).toBeNull()
  })

  test('a drone page: its systems read at the page’s card size too', () => {
    const drone = SalvageUnionReference.getByNameIn('drones', 'Combat Drone')
    if (!drone) throw new Error('fixture missing: Combat Drone')
    const { container } = render(<ReferenceEntityCard data={drone} presentation="page" />)
    expect(nestedProseSizes(container)).toEqual(new Set(['0.875rem']))
  })
})

describe("an ability's Page: Preceding and Next on one row", () => {
  test('in the app (a Page that opens Pages) both cut-outs share one row, Next at its end', () => {
    const arms = need(SalvageUnionReference.Abilities.getByName('Bionic Arms'), 'bionic arms')
    const { container } = render(
      <EntitySurfaceProvider value={{ openPage: () => {} }}>
        <ReferenceEntityCard data={arms} presentation="page" />
      </EntitySurfaceProvider>
    )
    const row = container.querySelector('.su-entity-page__neighbour-row')
    const sections = [...(row?.children ?? [])]
    expect(sections.map((s) => s.querySelector('.su-slab-section__head')?.textContent)).toEqual([
      'Preceding:\u00a0Bionic Senses',
      'Next:\u00a0Bionic Legs',
    ])
    expect(sections[1]?.classList.contains('su-entity-page__section--end')).toBe(true)
    expect(sections[0]?.classList.contains('su-entity-page__section--end')).toBe(false)
  })

  test('on the SRD the card draws none: the Page frame draws them at its foot', () => {
    const arms = need(SalvageUnionReference.Abilities.getByName('Bionic Arms'), 'bionic arms')
    const { container } = render(<ReferenceEntityCard data={arms} presentation="page" />)
    expect(container.querySelector('.su-entity-page__neighbour-row')).toBeNull()
  })
})
