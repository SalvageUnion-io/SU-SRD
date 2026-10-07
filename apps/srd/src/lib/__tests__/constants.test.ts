import { describe, expect, it } from 'bun:test'
import { SITE_URL, THEME_COLOR } from '../constants'

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
