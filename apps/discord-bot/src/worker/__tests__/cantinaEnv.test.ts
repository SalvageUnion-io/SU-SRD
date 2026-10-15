import { describe, expect, test } from 'bun:test'
import { cantinaConfig } from '../cantinaEnv'

describe('cantinaConfig', () => {
  test('reads the CANTINA_* names', () => {
    expect(
      cantinaConfig({ CANTINA_CONVEX_SITE_URL: 'https://a.convex.site', CANTINA_BOT_SECRET: 's' })
    ).toEqual({ siteUrl: 'https://a.convex.site', botSecret: 's' })
  })

  test('falls back to the ITUN_* names while the new ones are unset', () => {
    expect(
      cantinaConfig({ ITUN_CONVEX_SITE_URL: 'https://b.convex.site', ITUN_BOT_SECRET: 'old' })
    ).toEqual({ siteUrl: 'https://b.convex.site', botSecret: 'old' })
  })

  test('prefers the new name when both are set', () => {
    expect(cantinaConfig({ CANTINA_BOT_SECRET: 'new', ITUN_BOT_SECRET: 'old' }).botSecret).toBe(
      'new'
    )
  })

  test('is empty when neither is set', () => {
    expect(cantinaConfig({})).toEqual({ siteUrl: '', botSecret: '' })
  })
})
