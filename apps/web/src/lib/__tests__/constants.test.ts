import { describe, expect, it } from 'bun:test'
import { entityTitle, SITE_URL, TITLE_MAX } from '../constants'
import { SITE_NAME, THEME_COLOR } from '../documentHead'
import { pageTitle } from '../pageTitle'

describe('SITE_URL', () => {
  it('equals the production site URL', () => {
    expect(SITE_URL).toBe('https://salvageunion.io')
  })
})

describe('THEME_COLOR', () => {
  it("equals the web manifest's theme_color", async () => {
    const manifest = await Bun.file(
      new URL('../../../public/site.webmanifest', import.meta.url)
    ).json()
    expect(THEME_COLOR).toBe(manifest.theme_color)
  })

  it("is theme.css's --color-ink-deep, in hex", async () => {
    const theme = await Bun.file(new URL('../../styles/theme.css', import.meta.url)).text()
    const rgb = theme.match(/--color-ink-deep:\s*rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    expect(rgb).not.toBeNull()
    const hex = `#${(rgb ?? [])
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`
    expect(THEME_COLOR).toBe(hex)
  })
})

describe('the site name', () => {
  it("is the web manifest's name, and every title's suffix", async () => {
    const manifest = await Bun.file(
      new URL('../../../public/site.webmanifest', import.meta.url)
    ).json()
    expect(manifest.name).toBe(SITE_NAME)
    expect(manifest.short_name).toBe(SITE_NAME)
    expect(pageTitle('Changelog')).toBe('Changelog · SalvageUnion.io')
    expect(pageTitle()).toBe('SalvageUnion.io')
  })
})

describe('entityTitle', () => {
  it('names the kind and the site when they fit', () => {
    expect(entityTitle('Mule', 'Chassis')).toBe('Mule - Chassis · SalvageUnion.io')
  })

  it('drops the kind first when the title would run long', () => {
    expect(entityTitle('Electro-Magnetic Shield Projector Array', 'Roll Table')).toBe(
      'Electro-Magnetic Shield Projector Array · SalvageUnion.io'
    )
  })

  it('drops the site last, for a name that needs the whole line', () => {
    const name = 'Relics of a Time Gone By Exterior Encounters Table'
    expect(entityTitle(name, 'Roll Table')).toBe(name)
  })

  it('never passes TITLE_MAX unless the name alone does', () => {
    for (const name of ['A', 'Relics of a Time Gone By Exterior Encounters', 'x'.repeat(50)]) {
      expect(entityTitle(name, 'Roll Table').length).toBeLessThanOrEqual(TITLE_MAX)
    }
  })
})
