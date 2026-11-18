import { afterEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { useListingView } from '../listingView'

const ABILITIES_KEY = 'srd:listing-view:abilities'

afterEach(() => {
  window.location.href = 'http://localhost/'
})

describe('useListingView', () => {
  test('every listing opens on its List, with List | Catalog', () => {
    for (const schemaId of ['chassis', 'keywords', 'factions']) {
      expect(renderHook(() => useListingView(schemaId)).result.current).toMatchObject({
        view: 'list',
        views: ['list', 'catalog'],
        fromUrl: false,
      })
    }
  })

  test('the abilities open on their List too, with List | Tree | Catalog', () => {
    expect(renderHook(() => useListingView('abilities')).result.current).toMatchObject({
      view: 'list',
      views: ['list', 'tree', 'catalog'],
    })
  })

  test('a remembered choice wins over the default, and does not ride the URL', () => {
    window.localStorage.setItem(ABILITIES_KEY, 'catalog')
    const { result } = renderHook(() => useListingView('abilities'))
    expect(result.current.view).toBe('catalog')
    expect(result.current.fromUrl).toBe(false)
  })

  test('a ?view= link wins over the remembered choice and rides the URL', () => {
    window.localStorage.setItem(ABILITIES_KEY, 'catalog')
    window.location.href = 'http://localhost/abilities/?view=tree'
    const { result } = renderHook(() => useListingView('abilities'))
    expect(result.current.view).toBe('tree')
    expect(result.current.fromUrl).toBe(true)
  })

  test('a view the listing does not offer is ignored, from the URL or storage', () => {
    window.localStorage.setItem('srd:listing-view:chassis', 'tree')
    window.location.href = 'http://localhost/chassis/?view=grid'
    const { result } = renderHook(() => useListingView('chassis'))
    expect(result.current.view).toBe('list')
    expect(result.current.fromUrl).toBe(false)
  })

  test('a ?view=catalog link opens any listing on its Catalog', () => {
    window.location.href = 'http://localhost/chassis/?view=catalog'
    const { result } = renderHook(() => useListingView('chassis'))
    expect(result.current.view).toBe('catalog')
    expect(result.current.fromUrl).toBe(true)
  })

  test('storage that throws (a private window) falls back to the default, and a choice still takes', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage')
    let reads = 0
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        reads++
        throw new DOMException('denied', 'SecurityError')
      },
    })
    try {
      const { result } = renderHook(() => useListingView('abilities'))
      expect(reads).toBe(1)
      expect(result.current.view).toBe('list')
      act(() => result.current.setView('catalog'))
      expect(reads).toBe(2)
      expect(result.current.view).toBe('catalog')
      expect(result.current.fromUrl).toBe(true)
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor)
      else Reflect.deleteProperty(window, 'localStorage')
    }
  })
})
