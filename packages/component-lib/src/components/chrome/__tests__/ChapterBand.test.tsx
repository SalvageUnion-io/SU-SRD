import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { color } from '../../../design/tokens'
import { ChapterBand } from '../ChapterBand'

/**
 * ChapterBand (brand refresh P2a): the page title notched into a band in the chapter's
 * colour, in ink — it replaced PageHeading's ink-stamp page heading.
 */
describe('ChapterBand', () => {
  test('is the page h1 by default, in ink on the page ground — never a knockout', () => {
    render(<ChapterBand>Changelog</ChapterBand>)
    const title = screen.getByRole('heading', { level: 1, name: 'Changelog' })
    expect(title.style.color).toBe(color.ink)
    expect(title.style.backgroundColor).toBe(color.wkBg)
  })

  test('takes the band colour from the book’s colour map', () => {
    const { container } = render(<ChapterBand tone="mech">Gopher</ChapterBand>)
    const band = container.firstElementChild as HTMLElement
    expect(band.style.backgroundColor).toBe(color.mech)
  })

  test('defaults to the rules-blue band', () => {
    const { container } = render(<ChapterBand>Keywords</ChapterBand>)
    expect((container.firstElementChild as HTMLElement).style.backgroundColor).toBe(color.wkLine)
  })

  test('renders the aside on the band and honours `as` and `id`', () => {
    render(
      <ChapterBand as="h2" id="band-title" aside={<span>Mech Chassis</span>}>
        Gopher
      </ChapterBand>
    )
    expect(screen.getByRole('heading', { level: 2, name: 'Gopher' }).id).toBe('band-title')
    expect(screen.getByText('Mech Chassis')).toBeTruthy()
  })

  test('two bands on one page never share a filter id', () => {
    const html = renderToStaticMarkup(
      <>
        <ChapterBand>Rules</ChapterBand>
        <ChapterBand tone="pilot">Pilot Bay</ChapterBand>
      </>
    )
    const ids = Array.from(html.matchAll(/<filter id="([^"]+)"/g), (m) => m[1])
    expect(ids.length).toBe(4)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(html).toContain(`url(#${id})`)
  })
})
