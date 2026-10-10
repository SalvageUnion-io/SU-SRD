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

  test('the ink band (Shelves, board S1) wears paper flecks, not ink speckle', () => {
    const html = renderToStaticMarkup(<ChapterBand tone="ink">Shelves</ChapterBand>)
    expect(html).toContain(`background-color:${color.ink}`)
    // One fleck layer in the page-ground colour; no ink blot or speck.
    expect(Array.from(html.matchAll(/<filter id="su-fleck/g))).toHaveLength(1)
    expect(html).not.toContain('su-blot')
    expect(html).not.toContain('su-speck')
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

  test('a canon band is solid: no hatch, no dashed notch', () => {
    const { container } = render(<ChapterBand tone="mech">Gopher</ChapterBand>)
    const band = container.firstElementChild as HTMLElement
    expect(band.style.backgroundImage).toBe('')
    expect(screen.getByRole('heading', { name: 'Gopher' }).style.borderTopStyle).toBe('')
  })

  test('a user-made band is hatched over its chapter colour, its notch framed in dashes', () => {
    const { container } = render(
      <ChapterBand tone="mech" userMade eyebrow={<span>User-made pattern</span>}>
        Tow Rig
      </ChapterBand>
    )
    const band = container.firstElementChild as HTMLElement
    // The chapter colour still names the chapter; the hatch rides over it.
    expect(band.style.backgroundColor).toBe(color.mech)
    expect(band.style.backgroundImage).toContain('repeating-linear-gradient(135deg')
    expect(band.dataset.userMade).toBe('true')
    const title = screen.getByRole('heading', { level: 1, name: 'Tow Rig' })
    for (const side of ['Top', 'Left', 'Right'] as const) {
      expect(title.style[`border${side}Style`]).toBe('dashed')
    }
    // Flush on the band's foot: the fourth side is the band.
    expect(title.style.borderBottomWidth).toBe('0px')
    expect(screen.getByText('User-made pattern')).toBeTruthy()
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
