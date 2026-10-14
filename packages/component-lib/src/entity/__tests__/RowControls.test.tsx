/**
 * A Row's controls (`controls`, the head's trailing mode slot, E7): a host's
 * Assign / Unassign / View sit on the band's right end. They never nest in
 * the Row's own control: a link or select Row lays its surface over the frame
 * as an empty cover and raises the controls above it. A host's labels sit
 * right of the title, after the model's own.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen } from '@testing-library/react'
import { Entity } from '../Entity'
import type { EntityRowModel } from '../types'

const MODEL: EntityRowModel = {
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

describe('Row controls', () => {
  test('read: the controls sit in the head, after the chips', () => {
    render(<Entity form="row" model={MODEL} controls={unassign()} />)
    const button = screen.getByRole('button', { name: 'Unassign' })
    const slot = button.closest('.su-entity-row__controls')
    expect(slot).not.toBeNull()
    expect(slot?.closest('.su-entity-row__head')).not.toBeNull()
    // A read Row has no surface of its own to cover it.
    expect(document.querySelector('.su-entity-row__cover')).toBeNull()
  })

  test('link: the surface is a cover, and the controls are not inside it', () => {
    render(
      <Entity
        form="row"
        model={MODEL}
        mode={{ kind: 'link', href: '/sheet/pilot/ace' }}
        controls={unassign()}
      />
    )
    const link = screen.getByRole('link', { name: 'Ace' })
    expect(link.className).toContain('su-entity-row__cover')
    expect(link.querySelector('button')).toBeNull()
    expect(link.closest('.su-entity-row')?.hasAttribute('data-covered')).toBe(true)
    expect(screen.getByRole('button', { name: 'Unassign' })).toBeTruthy()
  })

  test('link with host labels only: a label that is a button never nests in the link', () => {
    render(
      <Entity
        form="row"
        model={MODEL}
        mode={{ kind: 'link', href: '/sheet/pilot/ace' }}
        labels={
          <button type="button" onClick={() => undefined}>
            Claim
          </button>
        }
      />
    )
    const link = screen.getByRole('link', { name: 'Ace' })
    expect(link.className).toContain('su-entity-row__cover')
    expect(screen.getByRole('button', { name: 'Claim' }).closest('a')).toBeNull()
  })

  test('select: the radio covers the Row, and pressing a control does not select', () => {
    const picks: number[] = []
    const presses: number[] = []
    render(
      <Entity
        form="row"
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

  test('labels: a host label follows the model own, on the name line', () => {
    render(<Entity form="row" model={{ ...MODEL, userMade: true }} labels={<span>Yours</span>} />)
    const labels = screen.getByText('Yours').closest('.su-entity-row__head')
    expect(labels?.textContent).toContain('User-made')
    expect(labels?.textContent?.indexOf('User-made')).toBeLessThan(
      labels?.textContent?.indexOf('Yours') ?? -1
    )
  })
})
