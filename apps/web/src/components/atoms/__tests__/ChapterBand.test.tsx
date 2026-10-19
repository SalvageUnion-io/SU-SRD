import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { color } from '../../../design/tokens'
import { ChapterBand } from '../ChapterBand'
import { ChapterBandTrail } from '../ChapterBandTrail'

/**
 * ChapterBand (brand refresh P2a): the page title notched into a band in the chapter's
 * colour, in ink, the page's one h1.
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

  test('the ink band (Hangar, board S1) wears paper flecks, not ink speckle', () => {
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

  test('`asideAt="notch"` marks the band, with the title before the aside in the DOM', () => {
    const { container } = render(
      <ChapterBand tone="mech" asideAt="notch" aside={<span>Chassis</span>}>
        Mule
      </ChapterBand>
    )
    const band = container.firstElementChild as HTMLElement
    expect(band.dataset.aside).toBe('notch')
    const heading = screen.getByRole('heading', { name: 'Mule' })
    const stamp = screen.getByText('Chassis')
    expect(heading.compareDocumentPosition(stamp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test("`action` (a show page's button) follows the aside on the title row, and is absent when unset", () => {
    const { container } = render(
      <ChapterBand
        tone="mech"
        asideAt="notch"
        aside={<span>Chassis</span>}
        action={<a href="/build/">Build With This</a>}
      >
        Mule
      </ChapterBand>
    )
    const band = container.firstElementChild as HTMLElement
    expect(band.dataset.action).toBe('')
    const action = screen.getByRole('link', { name: 'Build With This' })
    expect(action.parentElement?.className).toBe('su-chapter-band__action')
    expect(action.parentElement?.parentElement?.className).toBe('su-chapter-band__row')
    const stamp = screen.getByText('Chassis')
    expect(stamp.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const bare = renderToStaticMarkup(
      <ChapterBand asideAt="notch" aside={<span>Chassis</span>}>
        Mule
      </ChapterBand>
    )
    expect(bare).not.toContain('data-action')
    expect(bare).not.toContain('su-chapter-band__action')
  })

  test("a page band sets the layout's trail on the notch's plate, above the title", () => {
    const trail = <nav aria-label="Breadcrumb">{'SRD//NPCs//'}</nav>
    const { container } = render(
      <ChapterBandTrail.Provider value={trail}>
        <ChapterBand tone="denizen">Ace</ChapterBand>
      </ChapterBandTrail.Provider>
    )
    const plate = container.querySelector('.su-chapter-band__plate')
    expect(plate?.parentElement?.classList.contains('su-chapter-band__row')).toBe(true)
    expect(plate?.firstElementChild?.className).toBe('su-chapter-band__trail')
    expect(plate?.lastElementChild?.tagName).toBe('H1')
    // On the cut-out, so in ink whatever the band: never the band's foreground.
    expect((plate as HTMLElement).style.color).toBe(color.ink)
    expect(container.querySelector('.su-chapter-band__eyebrow')).toBeNull()
  })

  test('a user-made band with a trail frames the whole plate in dashes', () => {
    const { container } = render(
      <ChapterBandTrail.Provider value={<nav aria-label="Breadcrumb">{'SRD//'}</nav>}>
        <ChapterBand userMade>Mule</ChapterBand>
      </ChapterBandTrail.Provider>
    )
    const plate = container.querySelector('.su-chapter-band__plate') as HTMLElement
    expect(plate.style.borderTopStyle).toBe('dashed')
    expect((container.querySelector('h1') as HTMLElement).style.borderTopStyle).toBe('')
  })

  test("the trail gives way to a band's own eyebrow, and never rides a link preview", () => {
    const trail = <nav aria-label="Breadcrumb">Contents / Mule</nav>
    const own = renderToStaticMarkup(
      <ChapterBandTrail.Provider value={trail}>
        <ChapterBand eyebrow={<span>Kicker</span>}>Home</ChapterBand>
      </ChapterBandTrail.Provider>
    )
    expect(own).not.toContain('Contents / Mule')
    const og = renderToStaticMarkup(
      <ChapterBandTrail.Provider value={trail}>
        <ChapterBand scale="og">Mule</ChapterBand>
      </ChapterBandTrail.Provider>
    )
    expect(og).not.toContain('Contents / Mule')
  })

  test('`corner` sits above the title row, right-aligned, and is absent when unset', () => {
    const { container } = render(
      <ChapterBand corner={<button type="button">Make a copy</button>}>Bonesaw</ChapterBand>
    )
    const corner = container.querySelector<HTMLElement>('.su-chapter-band__corner')
    expect(corner?.style.justifyContent).toBe('flex-end')
    expect(corner?.nextElementSibling?.className).toBe('su-chapter-band__row')
    expect(screen.getByRole('button', { name: 'Make a copy' })).toBeTruthy()

    const { container: bare } = render(<ChapterBand>Keywords</ChapterBand>)
    expect(bare.querySelector('.su-chapter-band__corner')).toBeNull()
  })

  test('the aside sits at the far end by default', () => {
    const { container } = render(
      <ChapterBand tone="mech" aside={<span>Chassis</span>}>
        Mule
      </ChapterBand>
    )
    expect((container.firstElementChild as HTMLElement).dataset.aside).toBeUndefined()
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

  test('bleeds by default: the band carries the bleed hook and no fixed width', () => {
    const { container } = render(<ChapterBand>Starter Set</ChapterBand>)
    const band = container.firstElementChild as HTMLElement
    expect(band.dataset.layout).toBe('bleed')
    // The bleed's width is the stylesheet's, widened by the shell's gutters.
    expect(band.style.width).toBe('')
  })

  test('a link preview never bleeds: it is a picture at one size', () => {
    const { container } = render(<ChapterBand scale="og">Gopher</ChapterBand>)
    const band = container.firstElementChild as HTMLElement
    expect(band.dataset.layout).toBeUndefined()
    expect(band.style.width).toBe('100%')
  })
})
