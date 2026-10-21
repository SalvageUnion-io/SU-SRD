/**
 * A crawler tech level's Page: the book's block of text, the ladder of the
 * six levels in its sidebar, this one marked and the rest linking.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { CrawlerTechLevelPage } from '../CrawlerTechLevelPage'

function level(name: string) {
  const found = SalvageUnionReference.CrawlerTechLevels.getByName(name)
  if (!found) throw new Error(`no ${name}`)
  return found
}

describe('CrawlerTechLevelPage', () => {
  test('reads the level as the book prints it', () => {
    const { container } = render(<CrawlerTechLevelPage item={level('Hamlet Crawler')} />)
    const lines = [...container.querySelectorAll('.su-tech-level__line')].map((line) => [
      line.querySelector('.su-tech-level__label')?.textContent,
      line.querySelector('.su-tech-level__value')?.textContent,
    ])
    // Its Tech Level and Structure Points ride the page's band; each
    // fact its label, its figure set large.
    expect(lines).toEqual([
      ['Upkeep', '5× Tech 1 Scrap'],
      ['Upgrade', '30× Tech 1 Scrap'],
      ['Approximate Population', '100 – 500'],
    ])
    expect(
      [...container.querySelectorAll('.su-tech-level__figure')].map((f) => f.textContent)
    ).toEqual(['5×', '30×', '100 – 500'])
  })

  test('its text sits in a plain box, its stats on the band', () => {
    const { container } = render(<CrawlerTechLevelPage item={level('Hamlet Crawler')} />)
    const block = container.querySelector('.su-tech-level__block')
    expect(block).not.toBeNull()
    expect(block?.querySelector('h2')).toBeNull()
    expect(block?.textContent).not.toContain('Structure Points')
  })

  test('the highest level cannot be upgraded and has no ceiling on its population', () => {
    const { container } = render(<CrawlerTechLevelPage item={level('Megacity Crawler')} />)
    const text = container.textContent ?? ''
    expect(text).toContain('Tech 6 is the highest level of Union Crawler')
    expect(text).toContain('Approximate Population25,000 +')
  })

  test('the ladder marks this level and links the other five', () => {
    render(<CrawlerTechLevelPage item={level('Town Crawler')} />)
    const ladder = screen.getByRole('complementary', { name: 'Union Crawler Tech Levels' })
    const rungs = within(ladder).getAllByRole('listitem')
    expect(rungs).toHaveLength(6)
    const current = rungs.filter((li) => li.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toContain('Town Crawler')
    expect(within(ladder).getAllByRole('link')).toHaveLength(5)
  })
})
