import { describe, expect, mock, test } from 'bun:test'
import { allowScriptUrl, installTrustedTypesPolicy } from '../trustedTypes'

const ORIGIN = 'https://salvageunion.io'

describe('allowScriptUrl', () => {
  test('lets the site worker through, relative or absolute', () => {
    expect(allowScriptUrl('/sw.js', ORIGIN)).toBe('/sw.js')
    expect(allowScriptUrl(`${ORIGIN}/sw.js`, ORIGIN)).toBe(`${ORIGIN}/sw.js`)
  })

  test('refuses any other script URL', () => {
    expect(allowScriptUrl('/assets/app.js', ORIGIN)).toBeNull()
    expect(allowScriptUrl('https://evil.example/sw.js', ORIGIN)).toBeNull()
    expect(allowScriptUrl('/sw.js?v=1', ORIGIN)).toBeNull()
    expect(allowScriptUrl('/build/sw.js', ORIGIN)).toBeNull()
    expect(allowScriptUrl('http://[', ORIGIN)).toBeNull()
  })
})

describe('installTrustedTypesPolicy', () => {
  test('creates the default policy, checking script URLs against this origin', () => {
    const createPolicy = mock(
      (_name: 'default', _rules: { createScriptURL: (input: string) => string | null }) => ({})
    )
    installTrustedTypesPolicy({
      trustedTypes: { defaultPolicy: null, createPolicy },
      location: { origin: ORIGIN },
    })
    expect(createPolicy).toHaveBeenCalledTimes(1)
    const [name, rules] = createPolicy.mock.calls[0] ?? []
    expect(name).toBe('default')
    expect(rules?.createScriptURL('/sw.js')).toBe('/sw.js')
    expect(rules?.createScriptURL('/other.js')).toBeNull()
  })

  test('leaves an existing default policy alone', () => {
    const createPolicy = mock(() => ({}))
    installTrustedTypesPolicy({
      trustedTypes: { defaultPolicy: {}, createPolicy },
      location: { origin: ORIGIN },
    })
    expect(createPolicy).not.toHaveBeenCalled()
  })

  test('does nothing where the browser has no Trusted Types', () => {
    expect(() => installTrustedTypesPolicy({ location: { origin: ORIGIN } })).not.toThrow()
  })
})
