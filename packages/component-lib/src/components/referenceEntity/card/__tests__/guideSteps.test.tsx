/**
 * GUIDE STEPS — a guide's procedure rendered through the real card with real
 * SRD data:
 * - the steps are an ordered list whose every item opens on the how-to banner
 *   (numeral, then name) as a real heading;
 * - a `section` is a solid slab heading over its own list, the steps one
 *   heading level below it, numbering restarting inside it;
 * - page pointers (`hint`) are left-aligned notes, and a run-in head (a
 *   value-only `label`, a sub-`heading`) becomes the stamp over its paragraph;
 * - on a page the steps stand as a page section, not inside the prose column.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefObjectContentBlock } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { chunkGuideStepProse } from '../guideStepProse'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const guide = (name: string) => {
  const found = SalvageUnionReference.Guides.getByName(name)
  if (!found) throw new Error(`fixture missing: ${name}`)
  return found
}

const paragraph = (value: string): SURefObjectContentBlock => ({ type: 'paragraph', value })

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

    const kept: SURefObjectContentBlock[] = [
      { type: 'heading', level: 1, value: 'Downtime' },
      { type: 'label', label: 'EFFECT', value: 'Deals 3 damage.' },
      paragraph('Then roll.'),
    ]
    expect(chunkGuideStepProse(kept)).toEqual([{ kind: 'prose', blocks: kept }])
  })

  test('a trailing label with nothing to head stays as it is', () => {
    const blocks: SURefObjectContentBlock[] = [{ type: 'label', value: 'Off Camera' }]
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
            chunk.kind === 'note'
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
  test('the steps are an ordered list of how-to banners, numbered from 1', () => {
    const pilot = guide('Create a Pilot')
    const { container } = render(<ReferenceEntityCard data={pilot} presentation="page" />)
    const list = container.querySelector('ol.su-guide__steps')
    expect(list).not.toBeNull()
    const items = list?.querySelectorAll(':scope > li.su-guide__step') ?? []
    expect(items).toHaveLength(pilot.steps.length)

    const heads = [...container.querySelectorAll('h2.su-guide__head')]
    expect(heads).toHaveLength(pilot.steps.length)
    expect(heads[0]?.querySelector('.su-guide__num')?.textContent).toBe('1')
    expect(heads[0]?.querySelector('.su-guide__name')?.textContent).toBe(pilot.steps[0]?.name)
  })

  test('an optional step says so on its banner', () => {
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

  test('sections are slab headings over their own lists; steps head one level below', () => {
    const downtime = guide('Crawler Downtime')
    const { container } = render(<ReferenceEntityCard data={downtime} presentation="page" />)
    const sections = [...container.querySelectorAll('section.su-guide__section')]
    const labels = downtime.steps.flatMap((step) => (step.section ? [step.section] : []))
    expect(sections).toHaveLength(labels.length)
    sections.forEach((section, index) => {
      expect(section.querySelector('h2')?.textContent).toBe(labels[index])
      // Numbering restarts in every section.
      expect(section.querySelector('h3.su-guide__head .su-guide__num')?.textContent).toBe('1')
    })
    expect(container.querySelectorAll('h3.su-guide__head')).toHaveLength(downtime.steps.length)
  })

  test('the steps stand as a page section at the reading size, not inside the prose', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Pilot')} presentation="page" />
    )
    const steps = container.querySelector('.su-guide')
    // A child of the page itself, which is what gives it the reading size.
    expect(steps?.parentElement?.className).toBe('su-entity-page')
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

  test('a wide step table scrolls in its own box', () => {
    const { container } = render(
      <ReferenceEntityCard data={guide('Create a Pilot')} presentation="page" />
    )
    expect(container.querySelectorAll('.su-guide__table').length).toBeGreaterThan(0)
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
