import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { BreadcrumbTrail } from '../BreadcrumbTrail'

const TRAIL = [
  { name: 'Reference', url: '/' },
  { name: 'Chassis', url: '/chassis/' },
  { name: 'Mule', url: '/chassis/mule/' },
]

describe('BreadcrumbTrail', () => {
  test('owns its nav, dressed for its placement (hard rule R16)', () => {
    const { container } = render(<BreadcrumbTrail breadcrumbs={TRAIL} placement="row" />)
    const nav = container.querySelector('nav[aria-label="Breadcrumb"]')
    expect(nav?.className).toBe('su-crumbs su-crumbs--row')
  })

  test('the bar form puts `//` between the steps and ends on the current page', () => {
    const { container } = render(<BreadcrumbTrail breadcrumbs={TRAIL} placement="bar" />)
    expect(container.textContent).toBe('Reference//Chassis//Mule')
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Mule')
  })

  test('the band form shows the ancestors, each followed by `//`, and hides the page', () => {
    const { container } = render(<BreadcrumbTrail breadcrumbs={TRAIL} placement="band" />)
    const shown = [...container.querySelectorAll('li:not(.su-sr-only)')].map((li) => li.textContent)
    expect(shown).toEqual(['Reference', '//', 'Chassis', '//'])
    const here = container.querySelector('[aria-current="page"]')
    expect(here?.textContent).toBe('Mule')
    expect(here?.closest('li')?.classList.contains('su-sr-only')).toBe(true)
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/chassis/',
    ])
  })

  test('an ancestor renders through `link` (the app passes its router link)', () => {
    function Routed({ href, children }: { href: string; children: ReactNode }) {
      return (
        <a href={href} data-routed="">
          {children}
        </a>
      )
    }
    const { container } = render(
      <BreadcrumbTrail breadcrumbs={TRAIL} placement="band" link={Routed} />
    )
    expect([...container.querySelectorAll('[data-routed]')].map((a) => a.textContent)).toEqual([
      'Reference',
      'Chassis',
    ])
  })
})
