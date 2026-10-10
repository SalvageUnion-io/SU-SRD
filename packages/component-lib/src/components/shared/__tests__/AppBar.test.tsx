import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppBar } from '../AppBar'

/**
 * The Union bar (brand refresh P2a, board 05): one lockup, the Reference | Build switcher
 * with "here" as the inverse stamp, breadcrumbs in the bar on desktop and on
 * their own row on a phone, and the paper flecks behind it all.
 */

const CRUMBS = [
  { name: 'SRD', url: 'https://salvageunion.io/' },
  { name: 'Chassis', url: 'https://salvageunion.io/schema/chassis/' },
  { name: 'Gopher', url: 'https://salvageunion.io/schema/chassis/item/gopher/' },
]

describe('AppBar', () => {
  test('one lockup: the mark names the home link; the wordmark is decoration', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="https://itun.example/" />)
    const home = screen.getByRole('link', { name: 'Salvage Union' })
    expect(home.getAttribute('href')).toBe('/')
    expect(home.textContent).toContain('SalvageUnion.io')
  })

  test('the switcher: the product you are in is the current tab; the other is same-tab', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="https://itun.example/" />)
    const tools = within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    expect(tools.getByRole('link', { name: 'Reference' }).getAttribute('aria-current')).toBe('true')
    const build = tools.getByRole('link', { name: 'Build' })
    expect(build.getAttribute('aria-current')).toBeNull()
    expect(build.getAttribute('href')).toBe('https://itun.example/')
    expect(build.getAttribute('target')).toBeNull()
  })

  test('no product nav means no second row', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="/" />)
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })

  test('full density puts the product nav on its own row, quiet links at its end', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="/"
        navItems={[{ label: 'Chassis', href: '/schema/chassis/', active: true }]}
        secondaryItems={[{ label: 'About', href: '/about/' }]}
      />
    )
    const row = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(row.className).toContain('su-union-bar__product-row')
    const chassis = within(row).getByRole('link', { name: 'Chassis' })
    expect(chassis.getAttribute('aria-current')).toBe('page')
    expect(within(row).getByRole('link', { name: 'About' })).toBeTruthy()
  })

  test('compact density puts the nav inline, slots in their place', () => {
    render(
      <AppBar
        product="build"
        referenceHref="https://salvageunion.io"
        buildHref="/"
        density="compact"
        navItems={[
          { label: 'Shelves', href: '/' },
          { id: 'games', node: <button type="button">Games</button> },
          { label: 'Starter Set', href: '/starter/' },
        ]}
      />
    )
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.className).toContain('su-union-bar__nav')
    expect(Array.from(nav.children).map((el) => el.textContent)).toEqual([
      'Shelves',
      'Games',
      'Starter Set',
    ])
    expect(screen.getByRole('banner').getAttribute('data-density')).toBe('compact')
  })

  test('"Buy the game" is an outline link out, in a new tab', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="/"
        buyHref="https://leyline.press/collections/salvage-union"
      />
    )
    const buy = screen.getByRole('link', { name: /buy the game/i })
    expect(buy.getAttribute('target')).toBe('_blank')
    expect(buy.getAttribute('rel')).toBe('noopener noreferrer')
    expect(buy.className).toContain('su-union-bar__buy')
  })

  test('breadcrumbs: in the bar and on the phone row, the current page bold, JSON-LD once', () => {
    const html = renderToStaticMarkup(
      <AppBar product="reference" referenceHref="/" buildHref="/" breadcrumbs={CRUMBS} />
    )
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const trails = doc.querySelectorAll('nav[aria-label="Breadcrumb"]')
    expect(Array.from(trails).map((t) => t.className)).toEqual([
      'su-crumbs su-crumbs--bar',
      'su-crumbs su-crumbs--row',
    ])
    // The bar's trail lives inside the bar; the phone's row sits under it.
    expect(trails[0]?.closest('header')).not.toBeNull()
    expect(trails[1]?.closest('header')).toBeNull()
    for (const trail of trails) {
      expect(trail.querySelector('[aria-current="page"]')?.textContent).toBe('Gopher')
      expect(Array.from(trail.querySelectorAll('a')).map((a) => a.textContent)).toEqual([
        'SRD',
        'Chassis',
      ])
    }
    const ld = doc.querySelectorAll('script[type="application/ld+json"]')
    expect(ld).toHaveLength(1)
    expect(JSON.parse(ld[0]?.textContent ?? '{}').itemListElement).toHaveLength(3)
  })

  test('paper flecks lie behind the bar, hidden from assistive tech', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="/" />)
    const svgs = screen.getByRole('banner').querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) expect(svg.getAttribute('aria-hidden')).toBe('true')
  })
})
