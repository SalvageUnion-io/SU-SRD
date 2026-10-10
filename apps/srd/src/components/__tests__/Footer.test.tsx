import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { PageFoot } from '../../../ssg/types'
import { Footer } from '../Footer'

const GOPHER: PageFoot = {
  tone: 'mech',
  page: 112,
  citation: 'Salvage Union Workshop Manual · also in Salvage Union Starter Set (PC) · p.26',
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

const STATES: [string, PageFoot | undefined][] = [
  ['the rules band', undefined],
  ['a book page’s foot', GOPHER],
]

describe('Footer', () => {
  for (const [name, foot] of STATES) {
    describe(name, () => {
      test('carries the licence’s required legal text and the artwork notice, verbatim', () => {
        const { container } = render(<Footer poweredBySalvageUrl="/mark.webp" foot={foot} />)
        const text = container.querySelector('.srd-footer__legal')?.textContent ?? ''
        for (const sentence of REQUIRED) expect(text).toContain(sentence)
      })

      test('is the page’s one contentinfo landmark', () => {
        render(<Footer poweredBySalvageUrl="/mark.webp" foot={foot} />)
        expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
      })

      // 48x48 once said 120x48 against a square image, and the footer reflowed on
      // every load: the declared box must keep the source's 1:1 ratio.
      test('keeps the mark square, its box declared so nothing reflows', () => {
        render(<Footer poweredBySalvageUrl="/my-logo.webp" foot={foot} />)
        const mark = screen.getByAltText('Powered by Salvage')
        expect(mark.getAttribute('src')).toBe('/my-logo.webp')
        expect(mark.getAttribute('width')).toBe('40')
        expect(mark.getAttribute('height')).toBe('40')
      })

      // The site's own pages left the Union bar with its second nav row
      // (brand refresh P2a); they live here, same tab. The legal prose has no
      // links: a prose link is an `InlineRef`, which paints rust (ruleset §3.1).
      test('links the site pages, and nothing in the legal prose', () => {
        const { container } = render(<Footer poweredBySalvageUrl="/mark.webp" foot={foot} />)
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
        expect(container.querySelector('.srd-footer__legal a')).toBeNull()
      })

      // At 375px the links once shared a flex row with the licence and left it
      // ~64px wide. The band's row wraps, so the two are separate children.
      test('keeps the licence and the links as separate wrapping children', () => {
        const { container } = render(<Footer poweredBySalvageUrl="/mark.webp" foot={foot} />)
        const rows = container.querySelectorAll('footer .su-chapter-foot__row')
        const [start, end] = Array.from(rows[rows.length - 1]?.children ?? []) as HTMLElement[]
        expect(start?.querySelector('.srd-footer__legal')).not.toBeNull()
        expect(end?.contains(screen.getByRole('navigation', { name: 'Site' }))).toBe(true)
      })
    })
  }

  test('with no foot, ends on the rules-blue band and cites nothing', () => {
    const { container } = render(<Footer poweredBySalvageUrl="/mark.webp" />)
    const bands = container.querySelectorAll('.su-chapter-foot')
    expect(bands).toHaveLength(1)
    expect(container.querySelector('.su-chapter-foot__start')?.textContent).not.toMatch(/^p\.\d/)
  })

  test('a book page ends on its chapter’s band, the citation above the licence', () => {
    const { container } = render(<Footer poweredBySalvageUrl="/mark.webp" foot={GOPHER} />)
    const bands = Array.from(container.querySelectorAll<HTMLElement>('.su-chapter-foot'))
    expect(bands).toHaveLength(2)
    expect(bands[0]?.style.backgroundColor).toBe(bands[1]?.style.backgroundColor)
    expect(within(bands[0] as HTMLElement).getByText('p.112')).toBeTruthy()
    expect(within(bands[0] as HTMLElement).getByText(GOPHER.citation as string)).toBeTruthy()
    for (const band of bands) {
      const row = band.querySelector<HTMLElement>('.su-chapter-foot__row')
      expect(row?.style.maxWidth).toBe('75rem')
    }
  })

  test('a book page with nothing to cite still takes its chapter’s tone', () => {
    const plain = render(<Footer poweredBySalvageUrl="/mark.webp" />).container
    const rules = plain.querySelector<HTMLElement>('.su-chapter-foot')?.style.backgroundColor
    plain.remove()
    const { container } = render(
      <Footer poweredBySalvageUrl="/mark.webp" foot={{ tone: 'mech' }} />
    )
    const bands = container.querySelectorAll<HTMLElement>('.su-chapter-foot')
    expect(bands).toHaveLength(1)
    expect(bands[0]?.style.backgroundColor).not.toBe(rules)
  })

  test('on a band that carries paper text, the mark reverses to paper', () => {
    for (const tone of ['denizen', 'crawler'] as const) {
      const { unmount } = render(<Footer poweredBySalvageUrl="/mark.webp" foot={{ tone }} />)
      expect(screen.getByAltText('Powered by Salvage').className).toContain(
        'srd-footer__mark--paper'
      )
      unmount()
    }
    render(<Footer poweredBySalvageUrl="/mark.webp" foot={GOPHER} />)
    expect(screen.getByAltText('Powered by Salvage').className).not.toContain('--paper')
  })
})
