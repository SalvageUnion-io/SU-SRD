import { describe, expect, test } from 'bun:test'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import type { ScreenTable } from '../../../lib/screenPage'
import { screenPanels } from '../../../lib/screenPage'
import { ScreenTableView } from '../../ScreenView'
import { ScreenTableIsland } from '../ScreenTableIsland'

const coreMechanic = (): ScreenTable => {
  const panel = screenPanels().find((p) => p.title === 'Core Mechanic')
  if (panel?.kind !== 'table') throw new Error('fixture missing: Core Mechanic')
  return panel
}

/** A die that shows these faces in turn, served the way `dieForTable` serves one. */
const dice = (...faces: number[]) => {
  let i = 0
  const die = () => faces[i++ % faces.length] ?? 1
  return async () => die
}

async function roll(name: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name }))
  })
}

describe('a Mediator Screen table, before a roll (the server markup)', () => {
  test('prints every band, its section, its page and a link to the table', () => {
    render(<ScreenTableView panel={coreMechanic()} roll={null} />)
    const panel = screen.getByRole('region', { name: 'Core Mechanic' })
    expect(within(panel).getByText('Core resolution')).toBeTruthy()
    expect(within(panel).getByText('p.232')).toBeTruthy()
    const link = within(panel).getByRole('link', { name: 'Core Mechanic' })
    expect(link.getAttribute('href')).toBe('/roll-tables/core-mechanic/')
    const rows = within(panel).getByRole('list', { name: 'Core Mechanic table' })
    expect(within(rows).getAllByRole('listitem')).toHaveLength(5)
    expect(within(rows).getByText('11–19')).toBeTruthy()
  })

  test('its Roll is inert until the island mounts', () => {
    render(<ScreenTableView panel={coreMechanic()} roll={null} />)
    const button = screen.getByRole('button', { name: 'Roll on Core Mechanic' })
    expect(button.hasAttribute('disabled')).toBe(true)
  })
})

describe('ScreenTableIsland', () => {
  test('Roll marks the row it lands on and reads the result beside the button', async () => {
    render(<ScreenTableIsland panel={coreMechanic()} dieFor={dice(14, 1)} />)
    await roll('Roll on Core Mechanic')

    const rows = screen.getByRole('list', { name: 'Core Mechanic table' })
    const marked = within(rows)
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'true')
    expect(marked).toHaveLength(1)
    expect(marked[0]?.textContent).toContain('Success')
    expect(screen.getByText('14')).toBeTruthy()

    await roll('Roll on Core Mechanic')
    const again = within(rows)
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'true')
    expect(again[0]?.textContent).toContain('Cascade Failure')
  })
})
