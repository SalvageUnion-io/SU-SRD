import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { CATALOG_QUERY, useListingView } from '../listingView'

const STORAGE_KEY = 'srd:listing-view'

afterEach(() => {
  window.location.href = 'http://localhost/'
})

describe('useListingView', () => {
  test('a remembered choice wins over the viewport', () => {
    window.localStorage.setItem(STORAGE_KEY, 'catalog')
    const { result } = renderHook(() => useListingView('chassis', true))
    expect(result.current.view).toBe('catalog')
    // Remembered, not linked: it does not ride the URL.
    expect(result.current.fromUrl).toBe(false)
  })

  test('a ?view= link wins over the remembered choice and rides the URL', () => {
    window.localStorage.setItem(STORAGE_KEY, 'list')
    window.location.href = 'http://localhost/chassis/?view=catalog'
    const { result } = renderHook(() => useListingView('chassis', true))
    expect(result.current.view).toBe('catalog')
    expect(result.current.fromUrl).toBe(true)
  })

  test('storage that throws (a private window) falls back to the viewport, and a choice still takes', () => {
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
      const { result } = renderHook(() => useListingView('chassis', true))
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

  test('with no media queries at all it keeps the List', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: undefined,
    })
    try {
      const { result } = renderHook(() => useListingView('chassis', true))
      expect(result.current.view).toBe('list')
    } finally {
      if (descriptor) Object.defineProperty(window, 'matchMedia', descriptor)
      else Reflect.deleteProperty(window, 'matchMedia')
    }
  })

  test('follows the viewport across the desktop measure until the reader chooses', () => {
    let wide = false
    const listeners = new Set<() => void>()
    const matchMedia = spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return query === CATALOG_QUERY && wide
          },
          media: query,
          addEventListener: (_: string, l: () => void) => listeners.add(l),
          removeEventListener: (_: string, l: () => void) => listeners.delete(l),
        }) as unknown as MediaQueryList
    )
    try {
      const { result } = renderHook(() => useListingView('chassis', true))
      expect(result.current.view).toBe('list')
      act(() => {
        wide = true
        for (const l of listeners) l()
      })
      expect(result.current.view).toBe('catalog')
      act(() => result.current.setView('list'))
      act(() => {
        for (const l of listeners) l()
      })
      expect(result.current.view).toBe('list')
    } finally {
      matchMedia.mockRestore()
    }
  })

  test('with no choice made, the schema decides: no art is the List, a catalog listing its Catalog, abilities their Tree', () => {
    const wideQuery = spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === CATALOG_QUERY,
          media: query,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    )
    try {
      // Even at a desktop measure, a listing without art keeps the List.
      expect(renderHook(() => useListingView('keywords', false)).result.current).toMatchObject({
        view: 'list',
        views: ['list', 'catalog'],
        fromUrl: false,
      })
      expect(renderHook(() => useListingView('factions', false)).result.current.view).toBe(
        'catalog'
      )
      expect(renderHook(() => useListingView('abilities', false)).result.current).toMatchObject({
        view: 'tree',
        views: ['list', 'catalog', 'tree'],
      })
    } finally {
      wideQuery.mockRestore()
    }
  })

  test('the abilities remember their own choice, apart from every other listing', () => {
    window.localStorage.setItem(STORAGE_KEY, 'list')
    const { result } = renderHook(() => useListingView('abilities', false))
    // The shared choice does not take the abilities off their Tree.
    expect(result.current.view).toBe('tree')
    act(() => result.current.setView('catalog'))
    expect(window.localStorage.getItem(`${STORAGE_KEY}:abilities`)).toBe('catalog')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('list')
  })
})
