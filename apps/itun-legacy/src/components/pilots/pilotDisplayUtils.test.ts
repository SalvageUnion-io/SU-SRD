import { describe, test, expect } from 'bun:test'
import { buildChassisBadgeProps, buildStripeStyle, buildBadgeTextClass } from './pilotDisplayUtils'

describe('buildChassisBadgeProps', () => {
  test('returns null when no chassisName', () => {
    expect(buildChassisBadgeProps(undefined, undefined, false)).toBeNull()
  })
  test('returns chassisName without patternName', () => {
    const result = buildChassisBadgeProps('Iron Mongrel', undefined, false)
    expect(result!.chassisName).toBe('Iron Mongrel')
    expect(result!.patternName).toBeUndefined()
  })
  test('returns correct badgeTextClass when compact', () => {
    expect(buildChassisBadgeProps('Iron Mongrel', undefined, true)!.badgeTextClass).toBe(
      'text-xs font-normal uppercase'
    )
  })
})

describe('buildStripeStyle', () => {
  test('returns undefined when not boarded and not in downtime', () => {
    expect(buildStripeStyle(false, false)).toBeUndefined()
  })
  test('returns boarded stripe when boarded', () => {
    expect(buildStripeStyle(true, false)!.backgroundImage).toContain('rgba(122,151,138')
  })
  test('returns downtime stripe when in downtime', () => {
    expect(buildStripeStyle(false, true)!.backgroundImage).toContain('rgba(206,88,152')
  })
})

describe('buildBadgeTextClass', () => {
  test('returns compact class', () => {
    expect(buildBadgeTextClass(true)).toBe('text-xs font-normal uppercase')
  })
  test('returns full class', () => {
    expect(buildBadgeTextClass(false)).toBe('text-base font-semibold uppercase')
  })
})
