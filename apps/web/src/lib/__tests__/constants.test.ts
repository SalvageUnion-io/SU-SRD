import { describe, expect, it } from 'bun:test'
import { entityTitle, SITE_URL, TITLE_MAX } from '../constants'
import { THEME_COLOR } from '../documentHead'

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
})

describe('entityTitle', () => {
  it('names the kind and the site when they fit', () => {
    expect(entityTitle('Mule', 'Chassis')).toBe('Mule - Chassis · Salvage Union SRD')
  })

  it('drops the kind first when the title would run long', () => {
    expect(entityTitle('Electro-Magnetic Shield Projector', 'Roll Table')).toBe(
      'Electro-Magnetic Shield Projector · Salvage Union SRD'
    )
  })

  it('drops the site last, for a name that needs the whole line', () => {
    const name = 'Salvage Cache Table (Reclamation of the Wastes)'
    expect(entityTitle(name, 'Roll Table')).toBe(name)
  })

  it('never passes TITLE_MAX unless the name alone does', () => {
    for (const name of ['A', 'Relics of a Time Gone By Exterior Encounters', 'x'.repeat(50)]) {
      expect(entityTitle(name, 'Roll Table').length).toBeLessThanOrEqual(TITLE_MAX)
    }
  })
})
