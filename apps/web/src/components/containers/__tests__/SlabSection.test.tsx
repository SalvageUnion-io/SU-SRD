/**
 * SlabSection — the one section (ruleset §6.4, hard rule R1): a Slab, one
 * gap, its body; the fold and the count its props.
 */

import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SlabSection } from '../SlabSection'

describe('SlabSection', () => {
  test('a named region: its Slab heads it, flush, over its body', () => {
    render(
      <SlabSection as="h2" id="crew" title="Crew">
        <p>Bonesaw</p>
      </SlabSection>
    )
    const region = screen.getByRole('region', { name: 'Crew' })
    expect(region.tagName).toBe('SECTION')
    // The one gap is the section's class (8px; `--page` 12px), never the Slab's margin.
    expect(region.className).toContain('su-slab-section')
    expect(region.className).not.toContain('su-slab-section--page')
    // The print stylesheet's page-break target.
    expect(region.className).toContain('su-sheet-section')
    const slab = region.querySelector('[data-slab]') as HTMLElement
    expect(slab.style.marginBottom).toBe('0px')
    expect(within(region).getByRole('heading', { level: 2, name: 'Crew' }).id).toBe('crew')
    expect(region.querySelector('.su-slab-section__body')?.textContent).toBe('Bonesaw')
  })

  test('on a Page, head and body are R17 blocks: the page gap', () => {
    const { container } = render(
      <SlabSection title="Actions" page>
        <p>Act</p>
      </SlabSection>
    )
    expect(container.querySelector('section')?.className).toContain('su-slab-section--page')
  })

  test('an empty body is left out, gap and all', () => {
    const { container } = render(
      <SlabSection title="Systems" count="None">
        {false}
      </SlabSection>
    )
    expect(container.querySelector('.su-slab-section__body')).toBeNull()
    expect(screen.getByText('None')).toBeTruthy()
  })

  test('the one fold: a Compact chevron at the rule end that hides, never unmounts, the body', () => {
    render(
      <SlabSection title="Not on hand" count={3} fold="closed">
        <ul aria-label="Not on hand">
          <li>Drill</li>
        </ul>
      </SlabSection>
    )
    const fold = screen.getByRole('button', { name: 'Expand Not on hand' })
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('list', { name: 'Not on hand' })).toBeNull()
    const panel = document.getElementById(fold.getAttribute('aria-controls') ?? '')
    expect(panel?.hidden).toBe(true)
    fireEvent.click(fold)
    expect(
      screen.getByRole('button', { name: 'Collapse Not on hand' }).getAttribute('aria-expanded')
    ).toBe('true')
    expect(screen.getByRole('list', { name: 'Not on hand' })).toBeTruthy()
  })

  test('fold="open" starts open; actions sit before the chevron', () => {
    render(
      <SlabSection
        title="Systems"
        fold="open"
        actions={
          <button type="button" aria-label="Manage systems">
            Manage
          </button>
        }
      >
        <p>Drill</p>
      </SlabSection>
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons.map((b) => b.getAttribute('aria-label'))).toEqual([
      'Manage systems',
      'Collapse Systems',
    ])
  })
})
