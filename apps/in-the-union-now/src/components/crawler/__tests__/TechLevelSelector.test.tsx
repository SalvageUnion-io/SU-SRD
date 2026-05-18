import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, mock, test } from 'bun:test'

import { TechLevelSelector } from '../TechLevelSelector'

/** Minimal tech-level entries — matches the Pick<...> prop type. */
const MOCK_TECH_LEVELS = [
  { id: 'tl-1', name: 'Hamlet Crawler', techLevel: 1 },
  { id: 'tl-2', name: 'Village Crawler', techLevel: 2 },
  { id: 'tl-3', name: 'Town Crawler', techLevel: 3 },
  { id: 'tl-4', name: 'City Crawler', techLevel: 4 },
  { id: 'tl-5', name: 'Metropolis Crawler', techLevel: 5 },
  { id: 'tl-6', name: 'Megacity Crawler', techLevel: 6 },
] as const

describe('TechLevelSelector', () => {
  test('renders all 6 tech levels', () => {
    render(
      <TechLevelSelector
        techLevels={[...MOCK_TECH_LEVELS]}
        selectedTechLevel={null}
        onChange={() => undefined}
      />
    )

    for (let tl = 1; tl <= 6; tl++) {
      expect(screen.getByText(`TL ${tl}`)).toBeDefined()
    }
  })

  test('renders tech level names', () => {
    render(
      <TechLevelSelector
        techLevels={[...MOCK_TECH_LEVELS]}
        selectedTechLevel={null}
        onChange={() => undefined}
      />
    )
    expect(screen.getByText('Hamlet Crawler')).toBeDefined()
    expect(screen.getByText('Megacity Crawler')).toBeDefined()
  })

  test('selected tech level has aria-pressed=true', () => {
    render(
      <TechLevelSelector
        techLevels={[...MOCK_TECH_LEVELS]}
        selectedTechLevel={3}
        onChange={() => undefined}
      />
    )
    const button = screen.getByText('TL 3').closest('button')
    expect(button?.getAttribute('aria-pressed')).toBe('true')
  })

  test('unselected tech levels have aria-pressed=false', () => {
    render(
      <TechLevelSelector
        techLevels={[...MOCK_TECH_LEVELS]}
        selectedTechLevel={3}
        onChange={() => undefined}
      />
    )
    const button = screen.getByText('TL 1').closest('button')
    expect(button?.getAttribute('aria-pressed')).toBe('false')
  })

  test('clicking a tech level calls onChange with its number', () => {
    const onChange = mock(() => undefined)
    render(
      <TechLevelSelector
        techLevels={[...MOCK_TECH_LEVELS]}
        selectedTechLevel={null}
        onChange={onChange}
      />
    )
    const tl4Button = screen.getByText('TL 4').closest('button')!
    fireEvent.click(tl4Button)
    expect(onChange).toHaveBeenCalledWith(4)
  })

  test('clicking an already-selected tech level still fires onChange', () => {
    const onChange = mock(() => undefined)
    render(
      <TechLevelSelector
        techLevels={[...MOCK_TECH_LEVELS]}
        selectedTechLevel={2}
        onChange={onChange}
      />
    )
    const tl2Button = screen.getByText('TL 2').closest('button')!
    fireEvent.click(tl2Button)
    expect(onChange).toHaveBeenCalledWith(2)
  })

  test('no buttons render when techLevels array is empty', () => {
    render(
      <TechLevelSelector techLevels={[]} selectedTechLevel={null} onChange={() => undefined} />
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
})
