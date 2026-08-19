import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_ITUN_WEB_URL,
  itunSettings,
  normaliseWebUrl,
  setItunSettings,
} from '../itunSettings.js'

/**
 * Transport-neutral ITUN settings.
 *
 * `normaliseWebUrl` is not defensive programming for its own sake:
 * `EmbedBuilder.setURL` **throws** on a relative or malformed URL, so a blank or
 * scheme-less value here would not degrade — it would break every Game command
 * with a generic error, in a way that looks like a bug in the command rather
 * than a typo in configuration. Falling back to the canonical origin is always
 * better than taking the surface down over a bad env var.
 */

describe('normaliseWebUrl', () => {
  test('keeps an absolute http(s) URL', () => {
    expect(normaliseWebUrl('https://intheunionnow.com')).toBe('https://intheunionnow.com')
    expect(normaliseWebUrl('http://localhost:5173')).toBe('http://localhost:5173')
  })

  test('trims surrounding whitespace', () => {
    expect(normaliseWebUrl('  https://example.com  ')).toBe('https://example.com')
  })

  for (const [label, value] of [
    ['undefined', undefined],
    ['empty', ''],
    ['whitespace only', '   '],
  ] as const) {
    test(`falls back to the canonical origin when ${label}`, () => {
      expect(normaliseWebUrl(value)).toBe(DEFAULT_ITUN_WEB_URL)
    })
  }

  test('rejects a relative path — the case that would throw in setURL', () => {
    expect(normaliseWebUrl('/games/123')).toBe(DEFAULT_ITUN_WEB_URL)
  })

  test('rejects a non-http scheme', () => {
    // `new URL` parses these happily, so the protocol check is what catches
    // them; without it a `javascript:` value would reach an embed.
    expect(normaliseWebUrl('javascript:alert(1)')).toBe(DEFAULT_ITUN_WEB_URL)
    expect(normaliseWebUrl('ftp://example.com')).toBe(DEFAULT_ITUN_WEB_URL)
  })

  test('rejects an unparseable value', () => {
    expect(normaliseWebUrl('not a url at all')).toBe(DEFAULT_ITUN_WEB_URL)
  })
})

describe('settings installation', () => {
  test('an uninstalled default is Solo with the canonical web URL', () => {
    // Solo is the deliberate default: a deploy given no credentials must degrade
    // to "reference commands work, Game commands say not connected", never crash.
    const current = itunSettings()
    expect(current.webUrl).toBe(DEFAULT_ITUN_WEB_URL)
  })

  test('an entrypoint can install settings, and later reads see them', () => {
    const previous = itunSettings()
    try {
      setItunSettings({
        siteUrl: 'https://dep.convex.site',
        botSecret: 'secret',
        webUrl: 'https://example.test',
      })
      expect(itunSettings().siteUrl).toBe('https://dep.convex.site')
      expect(itunSettings().webUrl).toBe('https://example.test')
    } finally {
      // Restored because this module is process-global; leaving it set would
      // hand the fake to every file that runs afterwards.
      setItunSettings(previous)
    }
  })
})
