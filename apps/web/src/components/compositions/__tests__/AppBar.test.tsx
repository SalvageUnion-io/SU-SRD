import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { AppBar } from '../AppBar'

/**
 * The Union bar (ruleset §3.11): one lockup (the mark, the site's front door),
 * the areas as three plain links named for what they are (Reference |
 * Builder | Games) with "here" underlined, each area's rail under it,
 * breadcrumbs in the bar on desktop and on their own row on a phone, and the
 * paper flecks behind it all.
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
        playHref="/games/"
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
        playHref="/games/"
      />
    )
    const tools = within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    expect(tools.getByRole('link', { name: 'Reference' }).getAttribute('aria-current')).toBe('true')
    const build = tools.getByRole('link', { name: 'Builder' })
    expect(build.getAttribute('aria-current')).toBeNull()
    expect(build.getAttribute('href')).toBe('https://app.example/')
    expect(build.getAttribute('target')).toBeNull()
  })

  test('the bar carries its mode, which its colour keys on', () => {
    for (const product of ['reference', 'build', 'play'] as const) {
      const html = renderToStaticMarkup(
        <AppBar product={product} referenceHref="/" buildHref="/build/" playHref="/games/" />
      )
      expect(html).toContain(`data-mode="${product}"`)
    }
  })

  test('Reference carries "Ref" for a phone, its name still Reference', () => {
    render(<AppBar product="reference" referenceHref="/" buildHref="/build/" playHref="/games/" />)
    const tools = within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    const reference = tools.getByRole('link', { name: 'Reference' })
    expect(reference.getAttribute('data-short')).toBe('Ref')
    expect(tools.getByRole('link', { name: 'Builder' }).getAttribute('data-short')).toBeNull()
  })

  test('the area links read Reference | Builder | Games', () => {
    render(<AppBar product="play" referenceHref="/" buildHref="/build/" playHref="/games/" />)
    const tools = () => within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    expect(
      tools()
        .getAllByRole('link')
        .map((tab) => tab.textContent)
    ).toEqual(['Reference', 'Builder', 'Games'])
    expect(tools().getByRole('link', { name: 'Games' }).getAttribute('aria-current')).toBe('true')
    expect(tools().getByRole('link', { name: 'Builder' }).getAttribute('aria-current')).toBeNull()
    // Every tab is a site path, whichever is current.
    expect(tools().getByRole('link', { name: 'Builder' }).getAttribute('href')).toBe('/build/')
    expect(tools().getByRole('link', { name: 'Games' }).getAttribute('href')).toBe('/games/')
  })

  test('one geometry for every tool: the area links, then each area’s rail; no density', () => {
    render(<AppBar product="build" referenceHref="/" buildHref="/" playHref="/games/" />)
    const navs = screen.getAllByRole('navigation').map((nav) => nav.getAttribute('aria-label'))
    expect(navs[0]).toBe('Salvage Union tools')
    // Every other nav is an area's rail ("In …"), served for all three areas.
    expect(navs.slice(1)).toHaveLength(3)
    for (const label of navs.slice(1)) expect(label).toMatch(/^In /)
    const banner = screen.getByRole('banner')
    expect(banner.hasAttribute('data-density')).toBe(false)
    // The same lockup in both tools: the mark, never a wordmark.
    expect(banner.querySelector('.su-union-bar__mark')).not.toBeNull()
    expect(banner.querySelector('.su-union-bar__wordmark')).toBeNull()
  })

  test('the front door is in no area: no link is current', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/reference/"
        buildHref="/build/"
        playHref="/games/"
        noCurrent
      />
    )
    const tools = within(screen.getByRole('navigation', { name: 'Salvage Union tools' }))
    for (const link of tools.getAllByRole('link'))
      expect(link.getAttribute('aria-current')).toBeNull()
  })

  test('"Buy the game" is an outline link out, in a new tab', () => {
    render(
      <AppBar
        product="reference"
        referenceHref="/"
        buildHref="/"
        playHref="/games/"
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
        playHref="/games/"
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
    render(<AppBar product="reference" referenceHref="/" buildHref="/" playHref="/games/" />)
    const svgs = screen.getByRole('banner').querySelectorAll('svg')
    expect(svgs.length).toBeGreaterThan(0)
    for (const svg of svgs) expect(svg.getAttribute('aria-hidden')).toBe('true')
  })
})
