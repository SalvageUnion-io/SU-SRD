import { describe, expect, test } from 'bun:test'
import { renderHook } from '@testing-library/react'
import { useTabTitle } from '../useTabTitle'

describe('useTabTitle', () => {
  test('names the tab, and follows a rename', () => {
    const { rerender } = renderHook(({ title }) => useTabTitle(title), {
      initialProps: { title: 'Bonesaw · Play' as string | null },
    })
    expect(document.title).toBe('Bonesaw · Play')
    rerender({ title: 'Sawbones · Play' })
    expect(document.title).toBe('Sawbones · Play')
  })

  test('a name that has not answered leaves the title standing', () => {
    document.title = 'Game · The Cantina'
    renderHook(() => useTabTitle(null))
    expect(document.title).toBe('Game · The Cantina')
  })
})
