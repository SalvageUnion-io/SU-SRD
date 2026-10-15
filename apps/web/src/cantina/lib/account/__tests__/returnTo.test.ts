import { describe, expect, test } from 'bun:test'
import { returnTo } from '../returnTo'

const HERE = 'https://salvageunion.io/build/sign-out?to=x'

describe('returnTo', () => {
  test('follows a path on the site', () => {
    expect(returnTo('/chassis/mule/?q=1#top', HERE)).toBe(
      'https://salvageunion.io/chassis/mule/?q=1#top'
    )
  })

  test("follows an address on the page's own origin (a preview or dev)", () => {
    expect(returnTo('http://localhost:4321/about/', 'http://localhost:4321/build/sign-out')).toBe(
      'http://localhost:4321/about/'
    )
  })

  test('refuses another port on the same host', () => {
    expect(returnTo('http://localhost:5173/', 'http://localhost:4321/build/sign-out')).toBe(
      'http://localhost:4321/'
    )
  })

  test("refuses anybody else's site, however it is spelled", () => {
    for (const raw of [
      'https://evil.example/',
      '//evil.example/x',
      '/\\evil.example',
      'javascript:alert(1)',
    ]) {
      expect(returnTo(raw, HERE)).toBe('https://salvageunion.io/')
    }
  })

  test("nothing lands on the SRD's home", () => {
    expect(returnTo(undefined, HERE)).toBe('https://salvageunion.io/')
    expect(returnTo('', HERE)).toBe('https://salvageunion.io/')
  })
})
