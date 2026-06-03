/**
 * crawlerLevel — unit tests for the effective Crawler Tech Level resolver
 * (Slice E). The effective level prefers a linked crawler's techLevel over the
 * pilot's manual fallback, and is undefined when neither is present.
 */

import { describe, expect, test } from 'bun:test'

import { parseCrawlerTechLevel, resolveEffectiveCrawlerLevel } from '../crawlerLevel'

describe('parseCrawlerTechLevel', () => {
  test('parses a "tech-N" slug to its numeric level', () => {
    expect(parseCrawlerTechLevel('tech-3')).toBe(3)
    expect(parseCrawlerTechLevel('tech-6')).toBe(6)
  })

  test('returns undefined for a slug with no digits', () => {
    expect(parseCrawlerTechLevel('tech')).toBeUndefined()
    expect(parseCrawlerTechLevel('')).toBeUndefined()
  })
})

describe('resolveEffectiveCrawlerLevel', () => {
  test('prefers a linked crawler techLevel over the manual fallback', () => {
    const level = resolveEffectiveCrawlerLevel({ crawlerLevel: 2 }, { techLevel: 'tech-5' })
    expect(level).toBe(5)
  })

  test('uses the manual fallback when there is no linked crawler', () => {
    expect(resolveEffectiveCrawlerLevel({ crawlerLevel: 4 }, null)).toBe(4)
    expect(resolveEffectiveCrawlerLevel({ crawlerLevel: 4 }, undefined)).toBe(4)
  })

  test('falls back to manual when the linked crawler techLevel does not parse', () => {
    expect(resolveEffectiveCrawlerLevel({ crawlerLevel: 1 }, { techLevel: 'tech' })).toBe(1)
  })

  test('is undefined when neither a linked crawler nor a manual level exists', () => {
    expect(resolveEffectiveCrawlerLevel({ crawlerLevel: undefined }, null)).toBeUndefined()
  })
})
