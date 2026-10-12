import { describe, expect, it } from 'bun:test'
import { borderColorFromHeaderBg } from '../referenceEntityHelpers'

describe('borderColorFromHeaderBg', () => {
  it('should return headerBgColor when provided', () => {
    expect(borderColorFromHeaderBg('bg-pilot', '#D46A30')).toBe('#D46A30')
  })

  it('should derive CSS var from headerBg when headerBgColor is not provided', () => {
    expect(borderColorFromHeaderBg('bg-pilot')).toBe('var(--color-pilot)')
  })

  it('should return undefined when headerBg is falsy and no headerBgColor', () => {
    expect(borderColorFromHeaderBg('')).toBeUndefined()
    expect(borderColorFromHeaderBg(undefined)).toBeUndefined()
  })

  it('should prefer headerBgColor over headerBg derivation', () => {
    expect(borderColorFromHeaderBg('bg-pilot', '#FF0000')).toBe('#FF0000')
  })
})
