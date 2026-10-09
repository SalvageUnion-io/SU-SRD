/**
 * Ref resolution: stored refs are slugs, and only slugs resolve.
 * Uses real reference data: preloaded via the shared test preload.
 */
import { describe, expect, test } from 'bun:test'
import { getEntitySlug, SalvageUnionReference } from '../index.js'
import {
  resolveChassisRef,
  resolveCrawlerBayRef,
  resolveCrawlerRef,
  resolveInstalledRef,
  resolveModuleRef,
  resolveSystemRef,
} from './resolveRefs.js'

const first = <T>(rows: readonly T[]): T => {
  const row = rows[0]
  if (!row) throw new Error('reference data not loaded')
  return row
}

describe('resolveRefs', () => {
  test('every resolver answers its own model row for the slug', () => {
    const chassis = first(SalvageUnionReference.Chassis.all())
    const system = first(SalvageUnionReference.Systems.all())
    const mechModule = first(SalvageUnionReference.Modules.all())
    const crawler = first(SalvageUnionReference.Crawlers.all())
    const bay = first(SalvageUnionReference.CrawlerBays.all())
    expect(resolveChassisRef(getEntitySlug(chassis))?.id).toBe(chassis.id)
    expect(resolveSystemRef(getEntitySlug(system))?.id).toBe(system.id)
    expect(resolveModuleRef(getEntitySlug(mechModule))?.id).toBe(mechModule.id)
    expect(resolveInstalledRef(getEntitySlug(mechModule))?.id).toBe(mechModule.id)
    expect(resolveCrawlerRef(getEntitySlug(crawler))?.id).toBe(crawler.id)
    expect(resolveCrawlerBayRef(getEntitySlug(bay))?.id).toBe(bay.id)
  })

  test('an id or a display name is not a ref', () => {
    const chassis = first(SalvageUnionReference.Chassis.all())
    const bay = first(SalvageUnionReference.CrawlerBays.all())
    expect(resolveChassisRef(chassis.id)).toBeNull()
    expect(resolveChassisRef(chassis.name)).toBeNull()
    expect(resolveCrawlerBayRef(bay.id)).toBeNull()
    expect(resolveCrawlerBayRef(bay.name)).toBeNull()
  })

  test('returns null for unresolvable refs instead of throwing', () => {
    expect(resolveChassisRef('no-such-chassis-xyz')).toBeNull()
    expect(resolveInstalledRef('')).toBeNull()
  })
})
