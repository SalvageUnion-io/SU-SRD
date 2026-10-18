import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppBar } from '../AppBar'

/**
 * The Union bar (brand refresh P2a, board 05): one lockup, the Reference | Build | Play switcher
 * with "here" as the inverse stamp, breadcrumbs in the bar on desktop and on
 * their own row on a phone, and the paper flecks behind it all.
 */

const CRUMBS = [
  { name: 'SRD', url: 'https://salvageunion.io/' },
  { name: 'Chassis', url: 'https://salvageunion.io/chassis/' },
  { name: 'Gopher', url: 'https://salvageunion.io/chassis/gopher/' },
]

describe('AppBar', () => {
  test('one lockup: the mark alone names the home link, with no wordmark', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://app.example/"
        playHref="/play/"
      />
    )
    const home = screen.getByRole('link', { name: 'Salvage Union' })
    expect(home.getAttribute('href')).toBe('/')
    expect(home.textContent).toBe('')
    expect(home.querySelector('.su-union-bar__wordmark')).toBeNull()
  })

  test('the switcher: the product you are in is the current tab; the other is same-tab', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="https://app.example/"
        playHref="/play/"
      />
    )
    const tools = within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    expect(tools.getByRole('link', { name: 'Reference' }).getAttribute('aria-current')).toBe('true')
    const build = tools.getByRole('link', { name: 'Build' })
    expect(build.getAttribute('aria-current')).toBeNull()
    expect(build.getAttribute('href')).toBe('https://app.example/')
    expect(build.getAttribute('target')).toBeNull()
  })

  test('the bar carries its mode, which its colour keys on', () => {
    for (const product of ['reference', 'build', 'play'] as const) {
      const html = renderToStaticMarkup(
        <AppBar product={product} referenceHref="/" buildHref="/build/" playHref="/build/play/" />
      )
      expect(html).toContain(`data-mode="${product}"`)
    }
  })

  test('the switcher reads Reference | Build | Play', () => {
    render(<AppBar product="play" referenceHref="/" buildHref="/build/" playHref="/build/play/" />)
    const tools = () => within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    expect(
      tools()
        .getAllByRole('link')
        .map((tab) => tab.textContent)
    ).toEqual(['Reference', 'Build', 'Play'])
    expect(tools().getByRole('link', { name: 'Play' }).getAttribute('aria-current')).toBe('true')
    expect(tools().getByRole('link', { name: 'Build' }).getAttribute('aria-current')).toBeNull()
  })

  test('no product nav means no second row', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="/" playHref="/play/" />)
    expect(screen.queryByRole('navigation', { name: 'Main navigation' })).toBeNull()
  })

  test('one geometry for both tools: nav inline, no density', () => {
    render(
      <AppBar
        product="build"
        referenceHref="https://salvageunion.io"
        buildHref="/"
        playHref="/play/"
        navItems={[
          { label: 'Hangar', href: '/', active: true },
          { id: 'games', node: <button type="button">Games</button> },
          { label: 'Starter Set', href: '/starter/' },
        ]}
      />
    )
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    expect(nav.className).toContain('su-union-bar__nav')
    expect(Array.from(nav.children).map((el) => el.textContent)).toEqual([
      'Hangar',
      'Games',
      'Starter Set',
    ])
    expect(within(nav).getByRole('link', { name: 'Hangar' }).getAttribute('aria-current')).toBe(
      'page'
    )
    const banner = screen.getByRole('banner')
    expect(banner.hasAttribute('data-density')).toBe(false)
    // The same lockup in both tools: the mark, never a wordmark.
    expect(banner.querySelector('.su-union-bar__mark')).not.toBeNull()
    expect(banner.querySelector('.su-union-bar__wordmark')).toBeNull()
  })

  test('"Buy the game" is an outline link out, in a new tab', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="/"
        playHref="/play/"
        buyHref="https://leyline.press/collections/salvage-union"
      />
    )
    const buy = screen.getByRole('link', { name: /buy the game/i })
    expect(buy.getAttribute('target')).toBe('_blank')
    expect(buy.getAttribute('rel')).toBe('noopener noreferrer')
    expect(buy.className).toContain('su-union-bar__buy')
  })

  test('breadcrumbs: in the bar and on the phone row, the current page bold, JSON-LD left to the page head', () => {
    const html = renderToStaticMarkup(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="/"
        playHref="/play/"
        breadcrumbs={CRUMBS}
      />
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
    expect(doc.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(0)
  })

  test('paper flecks lie behind the bar, hidden from assistive tech', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="/" playHref="/play/" />)
    const svgs = screen.getByRole('banner').querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) expect(svg.getAttribute('aria-hidden')).toBe('true')
  })
})
