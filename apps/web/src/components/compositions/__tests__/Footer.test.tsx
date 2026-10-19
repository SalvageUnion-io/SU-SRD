import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import type { FooterFoot } from '../Footer'
import { Footer } from '../Footer'

/** The SRD's own pages, as its layout passes them. */
const LINKS = [
  { label: 'Changelog', href: '/changelog/' },
  { label: 'API', href: '/api/' },
  { label: 'Discord', href: '/discord/' },
  { label: 'About', href: '/about/' },
]

const GOPHER: FooterFoot = {
  printings: [
    { book: 'Workshop Manual', page: 112 },
    { book: 'Salvage Union Starter Set (PC)', page: 26 },
  ],
  measure: '75rem',
}

/**
 * The Salvage Union Open Game Licence 1.0b, "Required Legal Text": licensees
 * "must include the following legal text in their products". Every page keeps
 * it word for word, with the artwork notice beside it.
 */
const REQUIRED = [
  'Salvage Union is copyrighted by Leyline Press.',
  'Salvage Union and the “Powered by Salvage” logo are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b.',
  'All Workshop Manual Images are used with special permission from Leyline Press.',
]

const STATES: [string, FooterFoot | undefined][] = [
  ['the rules band', undefined],
  ['a book page’s foot', GOPHER],
]

describe('Footer', () => {
  for (const [name, foot] of STATES) {
    describe(name, () => {
      test('carries the licence’s required legal text and the artwork notice, verbatim', () => {
        const { container } = render(
          <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={foot} />
        )
        const text = container.querySelector('.su-footer__legal')?.textContent ?? ''
        for (const sentence of REQUIRED) expect(text).toContain(sentence)
      })

      test('is the page’s one contentinfo landmark', () => {
        render(<Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={foot} />)
        expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
      })

      // 48x48 once said 120x48 against a square image, and the footer reflowed on
      // every load: the declared box must keep the source's 1:1 ratio.
      test('keeps the mark square, its box declared so nothing reflows', () => {
        render(<Footer links={LINKS} poweredBySalvageUrl="/my-logo.webp" foot={foot} />)
        const mark = screen.getByAltText('Powered by Salvage')
        expect(mark.getAttribute('src')).toBe('/my-logo.webp')
        expect(mark.getAttribute('width')).toBe('40')
        expect(mark.getAttribute('height')).toBe('40')
      })

      // The site's own pages left the Union bar with its second nav row
      // (brand refresh P2a); they live here, same tab. The legal prose has no
      // links: a prose link is an `InlineRef`, which paints rust (ruleset §3.1).
      test('links the site pages, and nothing in the legal prose', () => {
        const { container } = render(
          <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={foot} />
        )
        const site = within(screen.getByRole('navigation', { name: 'Site' }))
        for (const [label, href] of [
          ['Changelog', '/changelog/'],
          ['API', '/api/'],
          ['Discord', '/discord/'],
          ['About', '/about/'],
        ] as const) {
          const link = site.getByRole('link', { name: label })
          expect(link.getAttribute('href')).toBe(href)
          expect(link.getAttribute('target')).toBeNull()
        }
        expect(container.querySelector('.su-footer__legal a')).toBeNull()
      })

      // At 375px the links once shared a flex row with the licence and left it
      // ~64px wide. The band's row wraps, so the two are separate children.
      test('keeps the licence and the links as separate wrapping children', () => {
        const { container } = render(
          <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={foot} />
        )
        const rows = container.querySelectorAll('footer .su-chapter-foot__row')
        const [start, end] = Array.from(rows[rows.length - 1]?.children ?? []) as HTMLElement[]
        expect(start?.querySelector('.su-footer__legal')).not.toBeNull()
        expect(end?.contains(screen.getByRole('navigation', { name: 'Site' }))).toBe(true)
      })
    })
  }

  test('with no foot, ends on the licence row alone and cites nothing', () => {
    const { container } = render(<Footer links={LINKS} poweredBySalvageUrl="/mark.webp" />)
    const bands = container.querySelectorAll('.su-chapter-foot')
    expect(bands).toHaveLength(1)
    expect(container.querySelector('.su-footer__citation')).toBeNull()
  })

  // Ruling 4 (2026-10-19): a show page's foot and the app footer are ONE footer.
  test('a show page merges its citation into the one footer, beside the links and licence', () => {
    const { container } = render(
      <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={GOPHER} />
    )
    const bands = Array.from(container.querySelectorAll<HTMLElement>('.su-chapter-foot'))
    expect(bands).toHaveLength(1)
    const band = bands[0] as HTMLElement
    expect(band.querySelector('.su-footer__legal')).not.toBeNull()
    expect(within(band).getByRole('navigation', { name: 'Site' })).toBeTruthy()
    expect(band.querySelector('.su-stat-column, .su-badge-stamp, [data-chip-class]')).toBeNull()
    expect(band.querySelector<HTMLElement>('.su-chapter-foot__row')?.style.maxWidth).toBe('75rem')
  })

  // Ruling 1 (2026-10-19): every printing on ONE line, the book first, `//` between.
  test('cites every printing on one line, with no "Also in"', () => {
    const { container } = render(
      <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={GOPHER} />
    )
    const lines = container.querySelectorAll('.su-footer__citation')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.textContent).toBe(
      'Workshop Manual · p.112 // Salvage Union Starter Set (PC) · p.26'
    )
    expect(container.textContent).not.toContain('Also in')
  })

  // Ruling 3 (2026-10-19): no kind on the foot.
  test('names no kind', () => {
    const { container } = render(
      <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={GOPHER} />
    )
    expect(container.querySelector('.su-footer__kind')).toBeNull()
    expect(container.textContent).not.toContain('Chassis')
  })

  // Rulings 2 and 4: the footer wears the page's leading band, as the Union
  // bar does, through the stylesheet (`footerMatchCss`), never a colour of its own.
  test('wears the leading band through the matched foot, with no colour of its own', () => {
    for (const foot of [undefined, GOPHER]) {
      const { container, unmount } = render(
        <Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={foot} />
      )
      const band = container.querySelector<HTMLElement>('.su-chapter-foot')
      expect(band?.style.backgroundColor).toBe('')
      expect(band?.style.color).toBe('')
      // Both grains are served; the matched rule shows the band's.
      expect(band?.querySelectorAll('.su-chapter-foot__grain')).toHaveLength(2)
      unmount()
    }
  })

  // No footer has an ink rule: the band runs edge to edge.
  test('no footer has an ink rule, a show page or a page with no entity', () => {
    const cited = render(<Footer links={LINKS} poweredBySalvageUrl="/mark.webp" foot={GOPHER} />)
    const citedBand = cited.container.querySelector<HTMLElement>('.su-chapter-foot')
    expect(citedBand?.style.borderTopStyle).toBe('')
    cited.unmount()
    const plain = render(<Footer links={LINKS} poweredBySalvageUrl="/mark.webp" />)
    expect(
      plain.container.querySelector<HTMLElement>('.su-chapter-foot')?.style.borderTopStyle
    ).toBe('')
  })
})

/** The app ends on the same Footer, with its own pages through its router's link. */
describe('Footer in another tool', () => {
  test('routes its links through the injected LinkComponent, with the same licence row', () => {
    function RouterLink({ href, children, ...rest }: { href: string; children: ReactNode }) {
      return (
        <a href={`/build${href}`} data-router="" {...rest}>
          {children}
        </a>
      )
    }
    const { container } = render(
      <Footer
        links={[
          { label: 'About', href: '/about' },
          { label: 'Changelog', href: '/changelog' },
        ]}
        poweredBySalvageUrl="/build/mark.webp"
        LinkComponent={RouterLink}
      />
    )
    const site = within(screen.getByRole('navigation', { name: 'Site' }))
    const about = site.getByRole('link', { name: 'About' })
    expect(about.getAttribute('href')).toBe('/build/about')
    expect(about.hasAttribute('data-router')).toBe(true)
    expect(about.className).toContain('su-footer__link')
    expect(container.querySelector('.su-footer__legal')?.textContent).toContain(
      'Salvage Union is copyrighted by Leyline Press.'
    )
  })
})
