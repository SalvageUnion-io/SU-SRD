import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { CiteLine } from '../CiteLine'

/**
 * A foot's citation line (ruleset Source 2): the printings, a bold `//`
 * between, each one with a book page linked to it (Source 3).
 */
describe('CiteLine', () => {
  const LINE = 'Workshop Manual · p.100 // Starter Set (PC) · p.12'

  test('reads as the one line, the separator in bold', () => {
    const { container } = render(<CiteLine text={LINE} />)
    expect(container.textContent).toBe(LINE)
    expect((screen.getByText('//') as HTMLElement).style.fontWeight).not.toBe('')
  })

  test('links each printing with a page, and leaves one without as text', () => {
    render(<CiteLine text={LINE} hrefs={['/sources/workshop-manual/']} />)
    const links = screen.getAllByRole('link')
    expect(links.map((a) => a.textContent)).toEqual(['Workshop Manual · p.100'])
    expect(links[0]?.getAttribute('href')).toBe('/sources/workshop-manual/')
  })

  // A link broken over two lines is two pieces whose middle is its
  // neighbour's text: a press there missed it (K14). Each is one box.
  test('a linked printing is one box, so the line breaks only between printings', () => {
    render(<CiteLine text={LINE} hrefs={['/a/', '/b/']} />)
    for (const link of screen.getAllByRole('link')) {
      expect((link as HTMLElement).style.display).toBe('inline-block')
    }
  })
})
