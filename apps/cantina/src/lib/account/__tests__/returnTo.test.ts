import { describe, expect, test } from 'bun:test'
import { returnTo } from '../returnTo'

const HERE = 'https://salvageunion.io/build/sign-out?to=x'
const SRD = 'https://salvageunion.io'

describe('returnTo', () => {
  test('follows a path on the site', () => {
    expect(returnTo('/chassis/mule/?q=1#top', HERE, SRD)).toBe(
      'https://salvageunion.io/chassis/mule/?q=1#top'
    )
  })

  test("follows the SRD's own origin when it differs (a preview or dev)", () => {
    expect(
      returnTo(
        'http://localhost:4321/about/',
        'http://localhost:5173/build/sign-out',
        'http://localhost:4321'
      )
    ).toBe('http://localhost:4321/about/')
  })

  test("refuses anybody else's site, however it is spelled", () => {
    for (const raw of [
      'https://evil.example/',
      '//evil.example/x',
      '/\\evil.example',
      'javascript:alert(1)',
    ]) {
      expect(returnTo(raw, HERE, SRD)).toBe('https://salvageunion.io/')
    }
  })

  test("nothing lands on the SRD's home", () => {
    expect(returnTo(undefined, HERE, SRD)).toBe('https://salvageunion.io/')
    expect(returnTo('', HERE, SRD)).toBe('https://salvageunion.io/')
  })
})
