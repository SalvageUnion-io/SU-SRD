import { describe, expect, it } from 'bun:test'
import { HASHED_NAMES, unsafeAssetNames, urlSafeName } from '../assetNames'

describe('assetNames', () => {
  it('names a page stylesheet without the `@` Workers Static Assets redirects', () => {
    expect(HASHED_NAMES.assetFileNames({ names: ['index@_@astro.css'] })).toBe(
      'assets/index___astro-[hash][extname]'
    )
  })

  it('keeps an ordinary name as it was', () => {
    expect(HASHED_NAMES.chunkFileNames({ name: 'roll-tables' })).toBe(
      'assets/roll-tables-[hash].js'
    )
    expect(urlSafeName('wizard-DdU3RxKP.css')).toBe('wizard-DdU3RxKP.css')
  })

  it('finds every asset a URL path would have to encode', () => {
    expect(unsafeAssetNames(['app-1.js', 'index@_@astro-2.css', 'a b.css'])).toEqual([
      'index@_@astro-2.css',
      'a b.css',
    ])
  })
})
