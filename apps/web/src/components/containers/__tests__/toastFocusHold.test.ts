/**
 * A toast holds while the focus is on it, as under the pointer (chrome K5,
 * r5 C3): the focus coming in and going out reads to the list as the pointer.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { holdToastsOnFocus } from '../toastFocusHold'

let release: (() => void) | undefined

afterEach(() => {
  release?.()
  document.body.innerHTML = ''
})

function toaster() {
  document.body.innerHTML =
    '<button id="out">Out</button><ol data-sonner-toaster><li><button id="undo">Undo</button><button id="close">Close</button></li></ol>'
  const heard: string[] = []
  const list = document.querySelector('[data-sonner-toaster]') as HTMLElement
  list.addEventListener('mouseover', () => heard.push('enter'))
  list.addEventListener('mouseout', () => heard.push('leave'))
  release = holdToastsOnFocus(document)
  const button = (id: string) => document.getElementById(id) as HTMLButtonElement
  return { heard, button }
}

describe('holdToastsOnFocus', () => {
  test('the focus coming onto a toast holds it, and going away lets it go', () => {
    const { heard, button } = toaster()
    button('undo').focus()
    expect(heard).toEqual(['enter'])
    // Moving within the toasts holds on.
    button('close').focus()
    expect(heard).toEqual(['enter'])
    button('out').focus()
    expect(heard).toEqual(['enter', 'leave'])
  })

  test('focus elsewhere on the page says nothing to the toasts', () => {
    const { heard, button } = toaster()
    button('out').focus()
    expect(heard).toEqual([])
  })
})
