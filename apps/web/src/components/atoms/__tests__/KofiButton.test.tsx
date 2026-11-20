/**
 * KofiButton: a plain Ko-fi link first, the widget's own markup once its
 * script has loaded (through `getHTML()`, never `draw()`), and one script tag
 * however many buttons ask for it.
 */

import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, render, screen } from '@testing-library/react'
import { KofiButton } from '../KofiButton'

const SRC = 'https://storage.ko-fi.com/cdn/widget/Widget_2.js'

function widget() {
  return {
    init: mock((_text: string, _color: string, _id: string) => {}),
    getHTML: mock(() => '<a class="kofi-widget">Ko-fi widget</a>'),
    draw: mock(() => {}),
  }
}

afterEach(() => {
  delete window.kofiwidget2
  for (const script of document.querySelectorAll(`script[src="${SRC}"]`)) script.remove()
})

describe('KofiButton', () => {
  test('a plain link to the page until the widget loads, and one script tag', () => {
    render(<KofiButton code="salvage" />)
    const link = screen.getByRole('link', { name: 'Support me on Ko-fi' })
    expect(link.getAttribute('href')).toBe('https://ko-fi.com/salvage')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(document.querySelectorAll(`script[src="${SRC}"]`)).toHaveLength(1)

    render(<KofiButton code="salvage" />)
    expect(document.querySelectorAll(`script[src="${SRC}"]`)).toHaveLength(1)
  })

  test('the widget’s markup replaces the link once its script loads', () => {
    render(<KofiButton code="salvage" />)
    const kofi = widget()
    window.kofiwidget2 = kofi
    act(() => {
      document.querySelector(`script[src="${SRC}"]`)?.dispatchEvent(new Event('load'))
    })
    expect(kofi.init).toHaveBeenCalledWith('Support me on Ko-fi', '#2e66c4', 'salvage')
    expect(kofi.draw).not.toHaveBeenCalled()
    expect(screen.getByText('Ko-fi widget')).toBeTruthy()
  })

  test('a widget already on the page draws at once', () => {
    const kofi = widget()
    window.kofiwidget2 = kofi
    render(<KofiButton code="salvage" />)
    expect(screen.getByText('Ko-fi widget')).toBeTruthy()
    expect(document.querySelectorAll(`script[src="${SRC}"]`)).toHaveLength(0)
  })

  test('an unmounted button ignores a late load', () => {
    const { unmount } = render(<KofiButton code="salvage" />)
    const script = document.querySelector(`script[src="${SRC}"]`)
    unmount()
    const kofi = widget()
    window.kofiwidget2 = kofi
    script?.dispatchEvent(new Event('load'))
    expect(kofi.init).not.toHaveBeenCalled()
  })
})
