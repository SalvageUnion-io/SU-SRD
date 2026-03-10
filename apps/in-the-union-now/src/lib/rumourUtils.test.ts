import { describe, it, expect } from 'bun:test'
import { hasReceivedRumour } from './rumourUtils'
import type { RumourReceipt } from './rumourUtils'

describe('hasReceivedRumour', () => {
  it('returns false for undefined receipt', () => {
    expect(hasReceivedRumour(undefined)).toBe(false)
  })

  it('returns false for empty rumour text', () => {
    const receipt: RumourReceipt = { rumour_text: '' }
    expect(hasReceivedRumour(receipt)).toBe(false)
  })

  it('returns true for non-empty rumour text', () => {
    const receipt: RumourReceipt = { rumour_text: 'There is a hidden cache in the ruins.' }
    expect(hasReceivedRumour(receipt)).toBe(true)
  })

  it('returns true for whitespace-only rumour text', () => {
    const receipt: RumourReceipt = { rumour_text: '   ' }
    expect(hasReceivedRumour(receipt)).toBe(true)
  })
})
