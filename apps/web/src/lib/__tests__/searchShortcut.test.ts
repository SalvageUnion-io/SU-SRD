import { describe, expect, test } from 'bun:test'
import { correctShortcutHints, isSearchShortcut } from '../searchShortcut'

const key = (init: KeyboardEventInit, target: HTMLElement = document.body) => {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init })
  target.dispatchEvent(event)
  return event
}

describe('isSearchShortcut', () => {
  test('Cmd+K and Ctrl+K anywhere, a field included', () => {
    const field = document.createElement('input')
    document.body.append(field)
    expect(isSearchShortcut(key({ key: 'k', ctrlKey: true }, field))).toBe(true)
    expect(isSearchShortcut(key({ key: 'k', metaKey: true }))).toBe(true)
    expect(isSearchShortcut(key({ key: 'k' }))).toBe(false)
    field.remove()
  })

  test('"/" only where it would not be typed', () => {
    const field = document.createElement('textarea')
    document.body.append(field)
    expect(isSearchShortcut(key({ key: '/' }))).toBe(true)
    expect(isSearchShortcut(key({ key: '/' }, field))).toBe(false)
    expect(isSearchShortcut(key({ key: '/', ctrlKey: true }))).toBe(false)
    field.remove()
  })
})

describe('correctShortcutHints', () => {
  test('the served "⌘K" becomes "Ctrl K" off a Mac, and stays on one', () => {
    const root = document.createElement('div')
    root.innerHTML = '<span class="su-search-field__shortcut"><kbd>⌘K</kbd></span>'
    correctShortcutHints(root, 'MacIntel')
    expect(root.textContent).toBe('⌘K')
    correctShortcutHints(root, 'Linux x86_64')
    expect(root.textContent).toBe('Ctrl K')
  })
})
