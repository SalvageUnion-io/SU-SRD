import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { sentrySourcemaps, warnUploadFailed } from '../vite'

const original = process.env.SENTRY_AUTH_TOKEN

afterEach(() => {
  if (original === undefined) delete process.env.SENTRY_AUTH_TOKEN
  else process.env.SENTRY_AUTH_TOKEN = original
})

describe('sentrySourcemaps', () => {
  test('is inert without SENTRY_AUTH_TOKEN: no plugins, so Vite emits no maps', () => {
    delete process.env.SENTRY_AUTH_TOKEN
    expect(sentrySourcemaps('dist')).toEqual([])
  })

  test("with a token, builds 'hidden' maps — never a sourceMappingURL to a deleted file", () => {
    process.env.SENTRY_AUTH_TOKEN = 'test-token'
    const plugins = sentrySourcemaps('dist')
    const hidden = plugins.find((p) => p.name === 'observability:hidden-sourcemaps')
    expect(hidden && 'config' in hidden ? hidden.config() : null).toEqual({
      build: { sourcemap: 'hidden' },
    })
    // The Sentry plugins themselves ride along after it.
    expect(plugins.length).toBeGreaterThan(1)
  })
})

test('a failed upload warns instead of failing the deploy', () => {
  const warn = spyOn(console, 'warn').mockImplementation(() => {})
  const error = new Error('401')
  expect(() => warnUploadFailed(error)).not.toThrow()
  expect(warn).toHaveBeenCalledWith(expect.stringContaining('non-fatal'), error)
  warn.mockRestore()
})
