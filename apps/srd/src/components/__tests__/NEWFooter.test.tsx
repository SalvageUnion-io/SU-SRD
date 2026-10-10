import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { NEWFooterVariant } from '../NEWFooter'
import { NEWFooter } from '../NEWFooter'

const VARIANTS: NEWFooterVariant[] = ['origin', 'chapter', 'ink']
const GOPHER = {
  tone: 'mech',
  page: 112,
  citation: 'Salvage Union Workshop Manual · also in Salvage Union Starter Set (PC) · p.26',
} as const

/**
 * The Salvage Union Open Game Licence 1.0b, "Required Legal Text": licensees
 * "must include the following legal text in their products". Every variant
 * keeps it word for word, and the artwork notice beside it.
 */
const REQUIRED = [
  'Salvage Union is copyrighted by Leyline Press.',
  'Salvage Union and the “Powered by Salvage” logo are used with permission of Leyline Press, under the Salvage Union Open Game Licence 1.0b.',
  'All Workshop Manual Images are used with special permission from Leyline Press.',
]

describe('NEWFooter', () => {
  for (const variant of VARIANTS) {
    describe(variant, () => {
      test('carries the licence’s required legal text and the artwork notice, verbatim', () => {
        const { container } = render(
          <NEWFooter variant={variant} poweredBySalvageUrl="/mark.webp" citation={GOPHER} />
        )
        const text = container.querySelector('.srd-footer-new__legal')?.textContent ?? ''
        for (const sentence of REQUIRED) expect(text).toContain(sentence)
      })

      test('is one contentinfo landmark', () => {
        render(<NEWFooter variant={variant} poweredBySalvageUrl="/mark.webp" citation={GOPHER} />)
        expect(screen.getAllByRole('contentinfo')).toHaveLength(1)
      })

      test('keeps the mark square, with its box declared so nothing reflows', () => {
        render(<NEWFooter variant={variant} poweredBySalvageUrl="/mark.webp" />)
        const mark = screen.getByAltText('Powered by Salvage')
        expect(mark.getAttribute('src')).toBe('/mark.webp')
        expect(mark.getAttribute('width')).toBe('40')
        expect(mark.getAttribute('height')).toBe('40')
      })

      test('links the site pages, and nothing in the legal prose', () => {
        const { container } = render(
          <NEWFooter variant={variant} poweredBySalvageUrl="/mark.webp" />
        )
        const site = within(screen.getByRole('navigation', { name: 'Site' }))
        for (const name of ['Changelog', 'API', 'Discord', 'About']) {
          expect(site.getByRole('link', { name }).getAttribute('target')).toBeNull()
        }
        expect(container.querySelector('.srd-footer-new__legal a')).toBeNull()
      })
    })
  }

  test('B on an entity page closes on the citation, in the chapter’s tone', () => {
    render(<NEWFooter variant="chapter" poweredBySalvageUrl="/mark.webp" citation={GOPHER} />)
    expect(screen.getByText('p.112')).toBeTruthy()
    expect(screen.getByText(GOPHER.citation)).toBeTruthy()
  })

  test('B without a citation (home, listings) is the A band', () => {
    // The speckle's filter ids come from `useId`, so they differ per render.
    const html = (el: Element) => el.innerHTML.replace(/_r_\w+_/g, 'ID')
    const a = render(<NEWFooter variant="origin" poweredBySalvageUrl="/mark.webp" />)
    const aHtml = html(a.container)
    a.unmount()
    const b = render(<NEWFooter variant="chapter" poweredBySalvageUrl="/mark.webp" />)
    expect(html(b.container)).toBe(aHtml)
  })

  test('C reverses the mark to paper on the ink ground', () => {
    render(<NEWFooter variant="ink" poweredBySalvageUrl="/mark.webp" />)
    expect(screen.getByAltText('Powered by Salvage').className).toContain(
      'srd-footer-new__mark--paper'
    )
  })
})
