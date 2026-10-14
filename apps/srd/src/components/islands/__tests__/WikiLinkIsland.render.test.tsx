/**
 * The roll is made once, when the island's chunk loads. Each test loads a
 * fresh copy of the module (a distinct query string) under a fixed
 * `Math.random`, as a page load would.
 */

import { describe, expect, spyOn, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { WikiLinkIsland as WikiLinkIslandType } from '../WikiLinkIsland'

async function loadWithRoll(face: number, tag: string): Promise<typeof WikiLinkIslandType> {
  const random = spyOn(Math, 'random').mockReturnValue(face)
  try {
    const specifier = `../WikiLinkIsland?roll=${tag}`
    const mod: { WikiLinkIsland: typeof WikiLinkIslandType } = await import(specifier)
    expect(random).toHaveBeenCalled()
    return mod.WikiLinkIsland
  } finally {
    random.mockRestore()
  }
}

describe('WikiLinkIsland', () => {
  test('on the one load in a hundred, shows a quiet WIKI link to /greembeem', async () => {
    const WikiLinkIsland = await loadWithRoll(0, 'hit')
    render(<WikiLinkIsland />)
    const link = screen.getByRole('link', { name: 'WIKI' })
    expect(link.getAttribute('href')).toBe('/greembeem')
    expect(link.className).toContain('su-union-bar__quiet')
  })

  test('every other load renders nothing, however often it renders', async () => {
    const WikiLinkIsland = await loadWithRoll(0.5, 'miss')
    const { container, rerender } = render(<WikiLinkIsland />)
    expect(container.innerHTML).toBe('')
    rerender(<WikiLinkIsland />)
    expect(container.innerHTML).toBe('')
  })
})
