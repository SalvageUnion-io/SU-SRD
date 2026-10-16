import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import { BreadcrumbTrail } from '../BreadcrumbTrail'

const TRAIL = [
  { name: 'SRD', url: '/' },
  { name: 'Chassis', url: '/chassis/' },
  { name: 'Mule', url: '/chassis/mule/' },
]

describe('BreadcrumbTrail', () => {
  test('the bar form puts `//` between the steps and ends on the current page', () => {
    const { container } = render(<BreadcrumbTrail breadcrumbs={TRAIL} />)
    expect(container.textContent).toBe('SRD//Chassis//Mule')
    expect(container.querySelector('[aria-current="page"]')?.textContent).toBe('Mule')
  })

  test('the plate form shows the ancestors, each followed by `//`, and hides the page', () => {
    const { container } = render(<BreadcrumbTrail breadcrumbs={TRAIL} plate />)
    const shown = [...container.querySelectorAll('li:not(.su-sr-only)')].map((li) => li.textContent)
    expect(shown).toEqual(['SRD', '//', 'Chassis', '//'])
    const here = container.querySelector('[aria-current="page"]')
    expect(here?.textContent).toBe('Mule')
    expect(here?.closest('li')?.classList.contains('su-sr-only')).toBe(true)
    expect([...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual([
      '/',
      '/chassis/',
    ])
  })
})
