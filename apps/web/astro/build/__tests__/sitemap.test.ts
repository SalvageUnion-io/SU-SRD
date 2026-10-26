import { describe, expect, it } from 'bun:test'
import { SITE_URL } from '../../../src/lib/constants'
import { passesSitemapFilter } from '../sitemap'

describe('passesSitemapFilter', () => {
  it('lists a page', () => {
    expect(passesSitemapFilter(`${SITE_URL}/chassis/mule/`)).toBe(true)
    expect(passesSitemapFilter(`${SITE_URL}/`)).toBe(true)
  })

  it('keeps the named pages out', () => {
    for (const route of ['/404/', '/og-card/', '/build/'])
      expect(passesSitemapFilter(`${SITE_URL}${route}`)).toBe(false)
  })

  it('keeps an image route, an unfurl image or an og-card-ish page out even when unnamed', () => {
    expect(passesSitemapFilter(`${SITE_URL}/chassis/mule/image/`)).toBe(false)
    expect(passesSitemapFilter(`${SITE_URL}/chassis/mule.og.png`)).toBe(false)
    expect(passesSitemapFilter(`${SITE_URL}/og-card/chassis/`)).toBe(false)
  })
})
