import { afterEach, expect, test } from 'bun:test'
import { drawnAnchor } from '../peekAnchor'

afterEach(() => {
  document.body.replaceChildren()
})

function head(out: boolean) {
  document.body.innerHTML = `
    <div data-chip-overflow-owner>
      <button id="chip" data-peek="term:damage" ${out ? 'data-fill-out' : ''}>DMG 5 SP</button>
    </div>
    <div data-chip-overflow>
      <button data-peek="term:range">RNG Close</button>
      ${out ? '<button id="copy" data-peek="term:damage">DMG 5 SP</button>' : ''}
    </div>`
  return document.getElementById('chip') as HTMLElement
}

// PT4-04: the explanation drew at the screen's top-left, beside nothing.
test('a chip out of its head is anchored at the copy the reader pressed', () => {
  const chip = head(true)
  expect(drawnAnchor(chip)).toBe(document.getElementById('copy') as HTMLElement)
})

test('a chip in its head is its own anchor', () => {
  const chip = head(false)
  expect(drawnAnchor(chip)).toBe(chip)
})
