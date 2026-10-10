/**
 * The header band — ONE anatomy, TWO fills (ruleset §5, board E1).
 *
 * happy-dom performs no layout, so these pin the structure and the style the
 * rules encode rather than pixel widths:
 * - a TONE header carries the title, then the value cells; an INK header adds
 *   the tier numeral before the title and the pennant after the cells;
 * - the speckle rides the band as a background image (ink grain on tone, paper
 *   flecks on ink), and is absent when the card asks for none;
 * - a one-line HEAD row never wraps: the title truncates and keeps its full
 *   name in a tooltip.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { StatItem } from '../../../shared/statsBarTypes'
import { EntityCardHeader } from '../EntityCardHeader'

// Real game content: the Salvaging Drill system and the Jury Rig ability.
const stats: StatItem[] = [
  { key: 'tech-level', label: 'TL', value: '2' },
  { key: 'slotsRequired', label: 'Slots', value: 3 },
  { key: 'salvageValue', label: 'SV', value: 2 },
]

const band = (title: string) => {
  const el = screen.getByText(title).closest('[data-fill]')
  if (!(el instanceof HTMLElement)) throw new Error('no header band')
  return el
}

describe('EntityCardHeader — two fills', () => {
  test('a tone header: the tone, ink speckle, the title then the value cells', () => {
    render(
      <EntityCardHeader
        title="Salvaging Drill"
        fill="tone"
        bg="bg-tl-2"
        bgColor={undefined}
        titleClass="text-display-lg"
        stats={stats}
        size="large"
        grain="ink"
        ruled
      />
    )
    const header = band('Salvaging Drill')
    expect(header.dataset.fill).toBe('tone')
    expect(header.className).toContain('bg-tl-2')
    // The speckle rides the band (happy-dom drops the SVG background image
    // itself, so the grain is read off the band's marker).
    expect(header.dataset.grain).toBe('ink')
    // Closed by the 1.5px ink rule.
    expect(header.style.borderBottomStyle).toBe('solid')
    expect(header.style.borderBottomWidth).toBe('var(--bw-chrome)')
    // The title wraps (a full card), the cells follow it.
    expect(header.style.flexWrap).toBe('wrap')
    expect(screen.getByText('Slots')).toBeTruthy()
  })

  test('an ink header: the numeral leads, dimmed, and the pennant closes the row', () => {
    render(
      <EntityCardHeader
        title="Jury Rig"
        fill="ink"
        bg={undefined}
        bgColor="var(--color-ink)"
        titleClass="text-display"
        titleTextClass="text-paper"
        numeral="1"
        stats={[]}
        pennant={<span>2 AP</span>}
        size="large"
        grain="paper"
      />
    )
    const header = band('Jury Rig')
    expect(header.dataset.fill).toBe('ink')
    expect(header.dataset.grain).toBe('paper')
    const numeral = screen.getByText('1')
    // Same type as the title, slightly dimmed.
    expect(numeral.className).toContain('text-display')
    expect(numeral.style.opacity).toBe('0.75')
    // Order: numeral, title, then the pennant.
    const text = header.textContent ?? ''
    expect(text.indexOf('1')).toBeLessThan(text.indexOf('Jury Rig'))
    expect(text.indexOf('Jury Rig')).toBeLessThan(text.indexOf('2 AP'))
  })

  test('no grain when the card asks for none (the Dashboard, a tooltip)', () => {
    render(
      <EntityCardHeader
        title="Salvaging Drill"
        fill="tone"
        bg="bg-tl-2"
        bgColor={undefined}
        titleClass="text-title"
        stats={stats}
        size="medium"
      />
    )
    expect(band('Salvaging Drill').dataset.grain).toBeUndefined()
  })
})

describe('EntityCardHeader — the one-line head row', () => {
  test('never wraps; the title truncates and keeps its full name as a tooltip', () => {
    render(
      <EntityCardHeader
        title="Electro-Magnetic Shield Projector"
        fill="tone"
        bg="bg-tl-4"
        bgColor={undefined}
        titleClass="text-title"
        stats={stats}
        size="medium"
        oneLine
      />
    )
    const title = screen.getByText('Electro-Magnetic Shield Projector')
    expect(title.getAttribute('title')).toBe('Electro-Magnetic Shield Projector')
    expect(title.style.textOverflow).toBe('ellipsis')
    expect(title.style.whiteSpace).toBe('nowrap')
    expect(band('Electro-Magnetic Shield Projector').style.flexWrap).toBe('nowrap')
  })

  test('a full card title wraps and carries no truncation tooltip', () => {
    render(
      <EntityCardHeader
        title="Coolant Flush"
        fill="tone"
        bg="bg-tl-1"
        bgColor={undefined}
        titleClass="text-title"
        stats={[]}
        size="medium"
      />
    )
    const title = screen.getByText('Coolant Flush')
    expect(title.getAttribute('title')).toBeNull()
    expect(title.style.whiteSpace).toBe('')
  })
})
