/**
 * The header band — ONE anatomy, TWO fills (ruleset §5, board E1).
 *
 * happy-dom performs no layout, so these pin the structure and the style the
 * rules encode rather than pixel widths:
 * - a TONE header carries the title, then the value cells; an INK header adds
 *   the tier numeral before the title and the pennant after the cells;
 * - the speckle rides the band as a background image (ink grain on tone, paper
 *   flecks on ink), and is absent when the card asks for none;
 * - a compact HEAD keeps one row: the title wraps to two lines and clamps,
 *   keeping its full name in a tooltip, and the cells move to the card body.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { StatItem } from '../../../containers/statsBarTypes'
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
        bandColor="var(--color-tl-2)"
        titleSize="31px"
        stats={stats}
        size="large"
        grain="ink"
        ruled
      />
    )
    const header = band('Salvaging Drill')
    expect(header.dataset.fill).toBe('tone')
    expect(header.style.backgroundColor).toBe('var(--color-tl-2)')
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
        bandColor="var(--color-ink)"
        titleSize="26px"
        titleColor="var(--color-paper)"
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
    expect(numeral.style.fontSize).toBe('26px')
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
        bandColor="var(--color-tl-2)"
        titleSize="22px"
        stats={stats}
        size="medium"
      />
    )
    expect(band('Salvaging Drill').dataset.grain).toBeUndefined()
  })
})

describe('EntityCardHeader — the compact head', () => {
  test('one no-wrap row: the title takes the room and clamps at two lines, its name a tooltip', () => {
    render(
      <EntityCardHeader
        title="Electro-Magnetic Shield Projector"
        fill="tone"
        bandColor="var(--color-tl-4)"
        titleSize="22px"
        stats={stats}
        size="medium"
        head
      />
    )
    const title = screen.getByText('Electro-Magnetic Shield Projector')
    expect(title.getAttribute('title')).toBe('Electro-Magnetic Shield Projector')
    expect(title.style.flex).toBe('1 1 0px')
    expect(title.style.minWidth).toBe('0')
    expect(title.style.overflow).toBe('hidden')
    const row = band('Electro-Magnetic Shield Projector')
    expect(row.style.display).toBe('flex')
    expect(row.style.flexWrap).toBe('nowrap')
    // The value cells live in the compact card's body, not the head.
    expect(screen.queryByText('Slots')).toBeNull()
  })

  test('the numeral, pennant and chevron keep their natural width around the name', () => {
    render(
      <EntityCardHeader
        title="Jury Rig"
        fill="ink"
        bandColor="var(--color-ink)"
        titleSize="22px"
        numeral="1"
        stats={[]}
        pennant={<span>2 AP</span>}
        size="medium"
        head
        chevron
      />
    )
    const row = band('Jury Rig')
    expect(row.style.flexWrap).toBe('nowrap')
    const [numeral, title, pennant, chevron] = [...row.children] as HTMLElement[]
    expect(numeral?.style.flex).toBe('0 0 auto')
    expect(title?.style.flex).toBe('1 1 0px')
    expect(pennant?.style.flex).toBe('0 0 auto')
    expect(pennant?.textContent).toBe('2 AP')
    expect((chevron as unknown as SVGElement | undefined)?.style.flex).toBe('0 0 auto')
  })

  test('a head is tight all round: no room is held above the title', () => {
    render(
      <EntityCardHeader
        title="Cargo Pod"
        fill="tone"
        bandColor="var(--color-tl-1)"
        titleSize="22px"
        stats={[]}
        size="medium"
        head
      />
    )
    expect(band('Cargo Pod').style.padding).toBe('6px 10px')
  })

  test('the labels sit right of the title, on its line', () => {
    render(
      <EntityCardHeader
        title="Cargo Pod"
        fill="tone"
        bandColor="var(--color-tl-1)"
        titleSize="22px"
        stats={[]}
        size="medium"
        labels={<span>System</span>}
      />
    )
    const row = band('Cargo Pod')
    // Symmetric: the band holds no room above for a border-riding stamp.
    expect(row.style.padding).toBe('8px 10px')
    const title = screen.getByText('Cargo Pod')
    const labels = title.nextElementSibling as HTMLElement
    expect(labels.textContent).toBe('System')
    expect(title.parentElement?.parentElement).toBe(row)
  })

  test('a full card title wraps and carries no truncation tooltip', () => {
    render(
      <EntityCardHeader
        title="Coolant Flush"
        fill="tone"
        bandColor="var(--color-tl-1)"
        titleSize="22px"
        stats={[]}
        size="medium"
      />
    )
    const title = screen.getByText('Coolant Flush')
    expect(title.getAttribute('title')).toBeNull()
    expect(title.style.whiteSpace).toBe('')
  })
})
