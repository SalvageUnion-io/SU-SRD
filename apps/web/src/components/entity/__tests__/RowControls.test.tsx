/**
 * A Compact's controls (`controls`): a host's Use, Assign, Unassign or View are
 * the chip group's last slot, after the cost and before a "⋯" (C8, R6). They never nest in
 * the Compact's own control: a link or select Compact lays its surface over the frame
 * as an empty cover and raises the controls above it. A host's labels sit
 * right of the title, after the model's own; its trailing chip (a "⋯" menu)
 * ends the chip group.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Entity } from '../Entity'
import type { EntityFormModel } from '../types'

const MODEL: EntityFormModel = {
  ref: { schemaName: 'classes', id: 'unit/pilot/ace', slug: 'ace', name: 'Ace', synthetic: true },
  title: 'Ace',
  kind: { stamp: 'Pilot', type: 'Pilot', domain: 'pilot', nature: 'have' },
  tone: 'pilot',
  facts: [{ key: 'HP', label: 'HP', short: 'HP', value: '8/10' }],
  traits: [],
  art: { kind: 'none' },
}

const unassign = () => (
  <button type="button" onClick={() => undefined}>
    Unassign
  </button>
)

describe('Compact controls', () => {
  test('read: the controls are the last slot of the chip group, after the chips', () => {
    render(<Entity size="compact" model={MODEL} controls={unassign()} />)
    const button = screen.getByRole('button', { name: 'Unassign' })
    // In the group, never beside it (C8, hard rule R6): the menu lane, last.
    const lane = button.closest('[data-chip-class]')
    expect(lane?.getAttribute('data-chip-class')).toBe('menu')
    expect(button.closest('[data-chip-group]')?.lastElementChild).toBe(lane)
    expect(lane?.closest('.su-entity-compact__head')).not.toBeNull()
    expect(button.closest('[data-chip-group]')?.textContent).toContain('HP8/10')
    // A read Compact has no surface of its own to cover it.
    expect(document.querySelector('.su-entity-compact__cover')).toBeNull()
  })

  test('link: the surface is a cover, and the controls are not inside it', () => {
    render(
      <Entity
        size="compact"
        model={MODEL}
        mode={{ kind: 'link', href: '/pilots/ace' }}
        controls={unassign()}
      />
    )
    const link = screen.getByRole('link', { name: 'Ace' })
    expect(link.className).toContain('su-entity-compact__cover')
    expect(link.querySelector('button')).toBeNull()
    expect(link.closest('.su-entity-compact')?.hasAttribute('data-covered')).toBe(true)
    expect(screen.getByRole('button', { name: 'Unassign' })).toBeTruthy()
  })

  test('link with host labels only: a label that is a button never nests in the link', () => {
    render(
      <Entity
        size="compact"
        model={MODEL}
        mode={{ kind: 'link', href: '/pilots/ace' }}
        labels={
          <button type="button" onClick={() => undefined}>
            Claim
          </button>
        }
      />
    )
    const link = screen.getByRole('link', { name: 'Ace' })
    expect(link.className).toContain('su-entity-compact__cover')
    expect(screen.getByRole('button', { name: 'Claim' }).closest('a')).toBeNull()
  })

  test('link with a trailing chip: it ends the chip group, outside the link', () => {
    render(
      <Entity
        size="compact"
        model={MODEL}
        mode={{ kind: 'link', href: '/pilots/ace' }}
        trailing={
          <button type="button" onClick={() => undefined}>
            More for Ace
          </button>
        }
      />
    )
    const link = screen.getByRole('link', { name: 'Ace' })
    expect(link.className).toContain('su-entity-compact__cover')
    const more = screen.getByRole('button', { name: 'More for Ace' })
    expect(more.closest('a')).toBeNull()
    // The last chip, after the model's own (`HP | 8/10`), on the name's line:
    // the menu lane, the strip's last (C8).
    const lane = more.closest('[data-chip-class]')
    expect(lane?.getAttribute('data-chip-class')).toBe('menu')
    expect(more.closest('.su-chips')?.lastElementChild).toBe(lane)
  })

  test('controls and a trailing chip share the last slot, the "⋯" last', () => {
    render(
      <Entity
        size="compact"
        model={MODEL}
        controls={unassign()}
        trailing={<button type="button">More for Ace</button>}
      />
    )
    const lane = screen.getByRole('button', { name: 'Unassign' }).closest('[data-chip-class]')
    expect(lane?.getAttribute('data-chip-class')).toBe('menu')
    // A bodyless Compact's +MORE (hidden until a chip does not fit, C5) ends it.
    expect([...(lane?.children ?? [])].map((el) => el.textContent)).toEqual([
      'Unassign',
      'More for Ace',
      '+MORE',
    ])
  })

  test('a trailing chip alone still draws the chip group', () => {
    render(
      <Entity
        size="compact"
        model={{ ...MODEL, facts: [] }}
        trailing={<button type="button">More for Ace</button>}
      />
    )
    expect(screen.getByRole('button', { name: 'More for Ace' }).closest('.su-chips')).not.toBeNull()
  })

  test('select: the radio covers the Compact, and pressing a control does not select', () => {
    const picks: number[] = []
    const presses: number[] = []
    render(
      <Entity
        size="compact"
        model={MODEL}
        mode={{ kind: 'select', role: 'radio', selected: true, onSelect: () => picks.push(1) }}
        controls={
          <button type="button" onClick={() => presses.push(1)}>
            Design
          </button>
        }
      />
    )
    const radio = screen.getByRole('radio', { name: 'Ace' })
    expect(radio.querySelector('button')).toBeNull()
    expect(radio.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Design' }))
    expect(presses).toHaveLength(1)
    expect(picks).toHaveLength(0)
    fireEvent.click(radio)
    expect(picks).toHaveLength(1)
    // The pick still wears the seal.
    expect(screen.getByText('Selected')).toBeTruthy()
  })

  test('labels: a host label is the first chip, before the model own', () => {
    render(
      <Entity size="compact" model={{ ...MODEL, userMade: true }} labels={<span>Yours</span>} />
    )
    const chips = screen.getByText('Yours').closest('[data-chip-group]')
    expect(chips?.firstElementChild?.firstElementChild?.textContent).toBe('Yours')
    expect(chips?.firstElementChild?.getAttribute('data-chip-class')).toBe('mark')
    expect(chips?.textContent).toContain('Homebrew')
    expect(chips?.textContent).toContain('HP8/10')
    expect(chips?.textContent?.indexOf('Yours')).toBeLessThan(
      chips?.textContent?.indexOf('Homebrew') ?? -1
    )
  })

  test('labels: a host label is a chip on a Compact with no other chips too', () => {
    render(<Entity size="compact" model={{ ...MODEL, facts: [] }} labels={<span>Yours</span>} />)
    expect(screen.getByText('Yours').closest('[data-chip-group]')).not.toBeNull()
    expect(screen.getByText('Yours').closest('.su-entity-compact__name')).toBeNull()
  })
})
