import { describe, expect, test } from 'bun:test'
import { SETTINGS_HREF, SIGN_IN_HREF, signOutHref } from '../accountBar'
import { markSignedIn } from '../accountState'
import { appPath } from '../site'

describe('accountBar', () => {
  test('Sign in, Settings and Sign out are The Cantina’s', () => {
    expect(SIGN_IN_HREF).toBe(`${appPath('/sign-in')}`)
    expect(SETTINGS_HREF).toBe(`${appPath('/settings')}`)
  })

  test('Sign out carries the page it was opened on, encoded', () => {
    expect(signOutHref('https://salvageunion.io/chassis/mule/?q=a&b=c')).toBe(
      `${appPath('/sign-out?to=https%3A%2F%2Fsalvageunion.io%2Fchassis%2Fmule%2F%3Fq%3Da%26b%3Dc')}`
    )
  })

  test('marks the document signed in, then out', () => {
    markSignedIn(document, true)
    expect(document.documentElement.hasAttribute('data-srd-signed-in')).toBe(true)
    markSignedIn(document, false)
    expect(document.documentElement.hasAttribute('data-srd-signed-in')).toBe(false)
  })
})
