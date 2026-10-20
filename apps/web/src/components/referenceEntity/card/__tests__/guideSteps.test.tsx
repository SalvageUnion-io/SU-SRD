/**
 * GUIDE STEPS — a guide's procedure rendered through the real card with real
 * SRD data:
 * - the steps are an ordered list whose every item opens on a solid Slab
 *   (numeral, then name, in the stamp) as a real heading;
 * - a `section` is a solid Slab heading its own list (on a page, the H2),
 *   the steps one heading level below it, numbering restarting inside it;
 * - on a page every section and step is an anchor, listed in an "On this
 *   page" rail (and its phone fold), and a "p. N" the surface can resolve
 *   links to the page that covers it;
 * - page pointers (`hint`) are left-aligned notes, any other hint and a
 *   `flavor` block are framed asides, and a run-in head (a value-only `label`,
 *   a sub-`heading`) becomes the stamp over its paragraph (the full rung on a
 *   page);
 * - a step's options are contentful Tokens in the masonry grid (`TokenGrid`);
 * - on a page the steps stand as a page section, not inside the prose column.
 */
import { describe, expect, test } from 'bun:test'
import { render, within } from '@testing-library/react'
import type { RefMetaEntity, RefObjectContentBlock } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { malformed } from 'salvageunion-reference/testing'
import { rollBandColor } from '../../../compositions/rollTableBands'
import { EntitySurfaceProvider } from '../../../entity/EntitySurface'
import { entityGuideToneColor } from '../entityCardTone'
import { chunkGuideStepProse } from '../guideStepProse'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const guide = (name: string) => {
  const found = SalvageUnionReference.Guides.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

const paragraph = (value: string): RefObjectContentBlock => ({ type: 'paragraph', value })

describe('chunkGuideStepProse', () => {
  test('a hint becomes a note, in place, between runs of prose', () => {
    const chunks = chunkGuideStepProse([
      paragraph('Make a copy of the Character Sheet on p. 24.'),
      { type: 'hint', value: 'Full details on Pilot Stats can be found on p. 20.' },
    ])
    expect(chunks).toEqual([
      { kind: 'prose', blocks: [paragraph('Make a copy of the Character Sheet on p. 24.')] },
      { kind: 'note', text: 'Full details on Pilot Stats can be found on p. 20.' },
    ])
  })

  test('a hint that names no page, and a flavour block, are asides', () => {
    const chunks = chunkGuideStepProse([
      paragraph('Then update your Upgrade Pool.'),
      { type: 'hint', value: "In the Union, paying Upkeep is also called 'paying your dues'." },
      { type: 'flavor', value: 'For example, a Pilot might want to try.' },
    ])
    expect(chunks).toEqual([
      { kind: 'prose', blocks: [paragraph('Then update your Upgrade Pool.')] },
      {
        kind: 'aside',
        text: "In the Union, paying Upkeep is also called 'paying your dues'.",
        flavor: false,
      },
      { kind: 'aside', text: 'For example, a Pilot might want to try.', flavor: true },
    ])
  })

  test("a hint's label rides along as its aside's stamp", () => {
    const chunks = chunkGuideStepProse([
      { type: 'hint', value: 'Paying Upkeep is paying your dues.', label: 'Note' },
    ])
    expect(chunks).toEqual([
      { kind: 'aside', text: 'Paying Upkeep is paying your dues.', flavor: false, label: 'Note' },
    ])
  })

  test('a value-only label folds onto the paragraph it heads, as its stamp', () => {
    const chunks = chunkGuideStepProse([
      paragraph('An area that can be Area Salvaged has two values.'),
      { type: 'label', value: 'Supply' },
      paragraph('This is the number of times an area can be area salvaged.'),
    ])
    expect(chunks).toEqual([
      { kind: 'prose', blocks: [paragraph('An area that can be Area Salvaged has two values.')] },
      {
        kind: 'prose',
        blocks: [
          {
            type: 'label',
            label: 'Supply',
            value: 'This is the number of times an area can be area salvaged.',
          },
        ],
      },
    ])
  })

  test('a sub-heading folds the same way; a level-1 heading and a labelled label do not', () => {
    const subHeading = chunkGuideStepProse([
      { type: 'heading', level: 3, value: 'In Combat' },
      paragraph('Deal half damage.'),
    ])
    expect(subHeading).toEqual([
      {
        kind: 'prose',
        blocks: [{ type: 'label', label: 'In Combat', value: 'Deal half damage.' }],
      },
    ])

    const kept: RefObjectContentBlock[] = [
      { type: 'heading', level: 1, value: 'Downtime' },
      { type: 'label', label: 'EFFECT', value: 'Deals 3 damage.' },
      paragraph('Then roll.'),
    ]
    expect(chunkGuideStepProse(kept)).toEqual([{ kind: 'prose', blocks: kept }])
  })

  test('a trailing label with nothing to head stays as it is', () => {
    const blocks: RefObjectContentBlock[] = [{ type: 'label', value: 'Off Camera' }]
    expect(chunkGuideStepProse(blocks)).toEqual([{ kind: 'prose', blocks }])
  })

  test('changes no shipped guide’s words — only regroups them', () => {
    for (const entry of SalvageUnionReference.Guides.all()) {
      for (const step of entry.steps) {
        const words = (step.content ?? [])
          .map((block) => (typeof block.value === 'string' ? block.value : ''))
          .join('|')
        const rendered = chunkGuideStepProse(step.content)
          .flatMap((chunk) =>
            chunk.kind !== 'prose'
              ? [chunk.text]
              : chunk.blocks.flatMap((block) => [
                  ...(block.label && !(step.content ?? []).includes(block) ? [block.label] : []),
                  typeof block.value === 'string' ? block.value : '',
                ])
          )
          .join('|')
        expect(rendered).toBe(words)
      }
    }
  })
})

describe('GuideSteps on the page', () => {
  test('the steps are an ordered list, each opening on its slab, numbered from 1', () => {
    const pilot = guide('Create a Pilot')
    const { container } = render(<ReferenceEntityCard data={pilot} presentation="page" />)
    const list = container.querySelector('ol.su-guide__steps')
    expect(list).not.toBeNull()
    const items = list?.querySelectorAll(':scope > li.su-guide__step') ?? []
    expect(items).toHaveLength(pilot.steps.length)

    const heads = [...container.querySelectorAll('.su-guide__head h2')]
    expect(heads).toHaveLength(pilot.steps.length)
    // The stamp reads numeral, then name.
    expect(heads[0]?.textContent).toBe(`1 ${pilot.steps[0]?.name}`)
  })

  test('an optional step says so on its slab', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Pilot')} presentation="page" />
    )
    const optional = container.querySelector('li[data-optional] .su-guide__head')
    expect(optional?.textContent).toContain('Choose your Appearance')
    expect(optional?.textContent).toContain('Optional')
  })

  test('page pointers are notes, not centred hints', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Pilot')} presentation="page" />
    )
    const notes = [...container.querySelectorAll('.su-guide__note')].map((n) => n.textContent)
    expect(notes).toContain('Full details on Pilot Stats can be found on p. 20.')
    expect(container.querySelector('.su-guide .text-center')).toBeNull()
  })

  test('an aside is a framed note in its step; a run-in head stamps at the full rung', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Tough Choices')} presentation="page" />
    )
    const asides = [...container.querySelectorAll('.su-guide__aside')]
    expect(asides).toHaveLength(1)
    expect(asides[0]?.getAttribute('role')).toBe('note')
    expect(asides[0]?.classList.contains('su-guide__aside--flavor')).toBe(true)
    expect(asides[0]?.textContent).toStartWith('For example, a Pilot might want')
    // No complementary landmark inside the page's main.
    expect(container.querySelector('.su-guide aside')).toBeNull()

    const runIn = [...container.querySelectorAll('.su-guide__prose .su-badge-stamp')].find(
      (stamp) => stamp.textContent === 'In Combat'
    )
    expect(runIn?.className).toContain('su-rung-label--full')
  })

  test('a labelled hint is a stamped callout: its NOTE stamp rides the frame', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Crawler Downtime')} presentation="page" />
    )
    const stamped = [...container.querySelectorAll('.su-guide__aside--stamped')]
    expect(stamped).toHaveLength(1)
    expect(stamped[0]?.getAttribute('role')).toBe('note')
    const stamp = stamped[0]?.querySelector('.su-badge-stamp.su-guide__aside-stamp')
    expect(stamp?.textContent).toBe('Note')
    expect(stamp?.className).toContain('su-stamp-seam')
    expect(stamped[0]?.querySelector('p')?.textContent).toContain('paying your dues')
  })

  test('a step prose run on a card keeps the compact stamp', () => {
    const { container } = render(<ReferenceEntityCard data={guide('Tough Choices')} />)
    const runIn = [...container.querySelectorAll('.su-guide__prose .su-badge-stamp')].find(
      (stamp) => stamp.textContent === 'In Combat'
    )
    expect(runIn?.className).toContain('su-rung-label--compact')
  })

  test('sections are H2 heads over their own lists; steps head one level below', () => {
    const downtime = guide('Crawler Downtime')
    const { container } = render(<ReferenceEntityCard data={downtime} presentation="page" />)
    const sections = [...container.querySelectorAll('section.su-guide__section')]
    const labels = downtime.steps.flatMap((step) => (step.section ? [step.section] : []))
    expect(sections).toHaveLength(labels.length)
    sections.forEach((section, index) => {
      expect(section.querySelector('.su-slab-section__head h2')?.textContent).toBe(labels[index])
      // Numbering restarts in every section.
      expect(section.querySelector('.su-guide__head h3')?.textContent).toMatch(/^1 /)
    })
    expect(container.querySelectorAll('.su-guide__head h3')).toHaveLength(downtime.steps.length)
  })

  test('the steps stand as a page section at the reading size, not inside the prose', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Pilot')} presentation="page" />
    )
    const steps = container.querySelector('.su-guide')
    // A child of the page itself, which is what gives it the reading size;
    // the page says it holds a guide, which sets its measure and rhythm.
    expect(steps?.parentElement?.classList.contains('su-entity-page')).toBe(true)
    expect(steps?.parentElement?.classList.contains('su-entity-page--guide')).toBe(true)
    expect(steps?.closest('.su-entity-page__prose')).toBeNull()
    // The introduction still leads, in the prose column.
    expect(container.querySelector('.su-entity-page__prose')?.textContent).toContain(
      'Follow these steps'
    )
  })

  test('a guide whose words are all in its steps opens on them, with no empty lead row', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Salvaging')} presentation="page" />
    )
    expect(container.querySelector('.su-entity-page__main')).toBeNull()
    expect(container.querySelector('.su-guide')).not.toBeNull()
  })

  test('"On this page" lists every section and step, each linking to its anchor', () => {
    const downtime = guide('Crawler Downtime')
    const { container } = render(<ReferenceEntityCard data={downtime} presentation="page" />)
    const rail = container.querySelector('nav.su-guide__rail')
    expect(rail?.getAttribute('aria-label')).toBe('On this page')
    const links = within(rail as HTMLElement).getAllByRole('link')
    const sections = new Set(downtime.steps.flatMap((step) => step.section ?? []))
    expect(links).toHaveLength(downtime.steps.length + sections.size)
    const ids = new Set<string>()
    for (const link of links) {
      const id = link.getAttribute('href')?.slice(1) ?? ''
      expect(container.querySelector(`[id="${id}"]`)).not.toBeNull()
      ids.add(id)
    }
    // Every anchor is unique.
    expect(ids.size).toBe(links.length)
    // The phone's block carries the same list, always open under its slab: no
    // disclosure to fold it.
    const block = container.querySelector('nav.su-guide__toc-block')
    expect(block?.querySelectorAll('a')).toHaveLength(links.length)
    expect(block?.firstElementChild?.textContent).toBe('On this page')
    expect(container.querySelector('.su-guide details, .su-guide summary')).toBeNull()
  })

  test('a card has no rail and no anchors', () => {
    const { container } = render(<ReferenceEntityCard data={guide('Crawler Downtime')} />)
    expect(container.querySelector('.su-guide__rail')).toBeNull()
    expect(container.querySelector('.su-guide__head [id]')).toBeNull()
  })

  test('a "p. N" the surface resolves links to its page; the rest stay text', () => {
    const heat = guide('Heat')
    const overload = SalvageUnionReference.RollTables.getByName('Reactor Overload')
    if (!overload) throw new Error('fixture missing: Reactor Overload')
    const { container } = render(
      <EntitySurfaceProvider
        value={{
          hrefFor: (ref) => `/${ref.schemaName}/${ref.slug}/`,
          pageRefs: {
            235: [
              {
                ref: {
                  schemaName: 'roll-tables',
                  id: overload.id,
                  slug: 'reactor-overload',
                  name: overload.name,
                },
                noun: 'roll table',
              },
            ],
          },
        }}
      >
        <ReferenceEntityCard data={heat} presentation="page" />
      </EntitySurfaceProvider>
    )
    const link = within(container).getByRole('link', { name: 'p. 235' })
    expect(link.getAttribute('href')).toBe('/roll-tables/reactor-overload/')
  })

  test("without an index, a page reference is the book's text", () => {
    const { container } = render(<ReferenceEntityCard data={guide('Heat')} presentation="page" />)
    expect(within(container).queryByRole('link', { name: 'p. 235' })).toBeNull()
    expect(container.textContent).toContain('Reactor Overload Table p. 235')
  })

  test("a step's options are contentful Tokens in the masonry grid (owner, 2026-10-20)", () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Mech')} presentation="page" />
    )
    const grid = container.querySelector('ul.su-token-grid[aria-label="Craft your Systems"]')
    expect(grid).not.toBeNull()
    const items = grid?.querySelectorAll(':scope > li') ?? []
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item.querySelector(':scope > .su-entity-token[data-contentful]')).not.toBeNull()
    }
  })

  test('a wide step table scrolls in its own box', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Pilot')} presentation="page" />
    )
    expect(container.querySelectorAll('.su-guide__table').length).toBeGreaterThan(0)
  })

  // The card hands its guide tone to GuideSteps, which hands it to each step
  // table: Create a Pilot (its Callsign columns table among them) bands in
  // pilot and Heat in mech, never the cream a tone-less table falls back to.
  test.each(['Create a Pilot', 'Heat'])('%s bands its step tables in its own tone', (name) => {
    const found = guide(name)
    const tone = entityGuideToneColor(found)
    if (!tone) throw new Error(`fixture has no guide tone: ${name}`)
    const { container } = render(<ReferenceEntityCard data={found} presentation="page" />)
    const tables = [...container.querySelectorAll<HTMLElement>('.su-guide__table .su-roll')]
    expect(tables.length).toBeGreaterThan(0)
    for (const table of tables) {
      expect(table.style.getPropertyValue('--su-roll-band')).toBe(rollBandColor(tone))
      expect(table.style.getPropertyValue('--su-roll-band')).not.toBe('var(--color-band-cream)')
    }
  })

  test('a table the toned entity owns bands in the same tone', () => {
    // No shipped guide owns a table, so this borrows a real one: the card's
    // own table takes the card's tone exactly as a step table does.
    const [rollTable] = SalvageUnionReference.RollTables.all()
    if (!rollTable) throw new Error('the dataset ships no roll tables')
    const heat = guide('Heat')
    const tone = entityGuideToneColor(heat)
    if (!tone) throw new Error('fixture has no guide tone: Heat')
    const owning = malformed<RefMetaEntity>({ ...heat, steps: [], table: rollTable.table })
    const { container } = render(<ReferenceEntityCard data={owning} presentation="page" />)
    const table = container.querySelector<HTMLElement>('.su-roll')
    expect(table).not.toBeNull()
    expect(table?.style.getPropertyValue('--su-roll-band')).toBe(rollBandColor(tone))
  })
})

describe('GuideSteps in a card', () => {
  test('a card keeps the steps in its body, at card size', () => {
    const { container } = render(<ReferenceEntityCard data={guide('Heat')} />)
    const steps = container.querySelector('.su-guide')
    expect(steps).not.toBeNull()
    expect(steps?.closest('.su-entity-page')).toBeNull()
    expect(container.querySelectorAll('li.su-guide__step')).toHaveLength(guide('Heat').steps.length)
  })
})
