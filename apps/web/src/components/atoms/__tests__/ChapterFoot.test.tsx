import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { ChapterFoot } from '../ChapterFoot'

/**
 * The foot band (ruleset, "The source" 2): the site footer's one band, in the
 * colour of the page's leading band, which the stylesheet sets (`footerMatchCss`).
 */
describe('ChapterFoot', () => {
  test('carries its two ends: the citation and licence at its start, the links at its end', () => {
    render(<ChapterFoot start="Workshop Manual · p.112" end="Changelog" />)
    expect(screen.getByText('Workshop Manual · p.112').className).toBe('su-chapter-foot__start')
    expect(screen.getByText('Changelog').className).toBe('su-chapter-foot__end')
  })

  // The foot wears the leading band's ground, foreground
  // and grain, so it draws no colour of its own and serves both grains.
  test('draws no colour of its own, and serves both grains for the band to pick', () => {
    const { container } = render(<ChapterFoot start="p.18" />)
    const band = container.firstElementChild as HTMLElement
    expect(band.style.backgroundColor).toBe('')
    expect(band.style.color).toBe('')
    expect(band.querySelector('.su-chapter-foot__grain--paper svg filter')).not.toBeNull()
    expect(band.querySelector('.su-chapter-foot__grain--ink svg filter')).not.toBeNull()
  })

  test('has no ink rule: the band runs edge to edge on every page', () => {
    const band = render(<ChapterFoot start="p.1" />).container.firstElementChild as HTMLElement
    expect(band.style.borderTopStyle).toBe('')
    expect(band.style.borderTopWidth).toBe('')
  })

  test('renders nothing for an end it was not given', () => {
    const { container } = render(<ChapterFoot start="p.9" />)
    expect(container.querySelector('.su-chapter-foot__end')).toBeNull()
  })
})
