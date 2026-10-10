import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
import { ChapterFoot } from '../ChapterFoot'
import { CHAPTER_BAND_COLOR } from '../chapterBandColor'

/**
 * The foot band (ruleset, "The source": the foot band carries the citation):
 * the chapter's colour again, with its ink speckle, under an ink rule.
 */
describe('ChapterFoot', () => {
  test('carries the citation: the page number at its start, the book at its end', () => {
    render(<ChapterFoot tone="mech" start="p.112" end="Salvage Union Workshop Manual" />)
    expect(screen.getByText('p.112').className).toBe('su-chapter-foot__start')
    expect(screen.getByText('Salvage Union Workshop Manual').className).toBe('su-chapter-foot__end')
  })

  test('wears its chapter’s band colour, as the head band does', () => {
    const { container } = render(<ChapterFoot tone="pilot" start="p.18" />)
    const band = container.firstElementChild as HTMLElement
    expect(band.style.backgroundColor).toBe(CHAPTER_BAND_COLOR.pilot)
    // The speckle lies behind the content.
    expect(band.querySelector('svg filter')).not.toBeNull()
  })

  test('sets text on the colours it reads on: ink on blue, paper on navy', () => {
    const ink = render(<ChapterFoot tone="rules" start="p.1" />).container
      .firstElementChild as HTMLElement
    const paper = render(<ChapterFoot tone="denizen" start="p.1" />).container
      .firstElementChild as HTMLElement
    expect(ink.style.color).toBe(color.ink)
    expect(paper.style.color).toBe(color.paper)
  })

  test('a crawler foot band takes the deeper text-bearing pink, with paper', () => {
    const band = render(<ChapterFoot tone="crawler" start="p.212" />).container
      .firstElementChild as HTMLElement
    expect(band.style.backgroundColor).toBe(color.crawlerBand)
    expect(band.style.color).toBe(color.paper)
  })

  test('is the site footer’s landmark when rendered as a footer', () => {
    render(<ChapterFoot as="footer" start="Licence" />)
    expect(screen.getByRole('contentinfo')).toBeTruthy()
  })

  test('renders nothing for an end it was not given', () => {
    const { container } = render(<ChapterFoot start="p.9" />)
    expect(container.querySelector('.su-chapter-foot__end')).toBeNull()
  })
})
