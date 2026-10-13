/**
 * The pre-N4 page grammar (`/schema/<schema>/item/<slug>/`) and where each of
 * its paths lives now. The Worker answers a miss with this mapping, so every
 * page the build emits must be reachable from its old address.
 */
import { describe, expect, it } from 'bun:test'
import { itemHref, patternHref, schemaHref } from '../entityHref'
import { currentPathFor, legacyItemHref } from '../legacyPaths'
import { ogImagePath } from '../ogCard'
import { getItemStaticPaths, getPatternStaticPaths, getSchemaStaticPaths } from '../staticPaths'

describe('currentPathFor', () => {
  it('maps every emitted page from its old address to its current one', () => {
    for (const { params } of getSchemaStaticPaths()) {
      expect(currentPathFor(`/schema/${params.schemaId}/`)).toBe(schemaHref(params.schemaId))
    }
    for (const { params } of getItemStaticPaths()) {
      expect(currentPathFor(legacyItemHref(params.schemaId, params.itemId))).toBe(
        itemHref(params.schemaId, params.itemId)
      )
    }
    for (const { params } of getPatternStaticPaths()) {
      const old = `/schema/${params.schemaId}/item/${params.itemId}/pattern/${params.patternId}/`
      expect(currentPathFor(old)).toBe(
        patternHref(params.schemaId, params.itemId, params.patternId)
      )
    }
  })

  it('moves an unfurl with its page', () => {
    expect(currentPathFor('/schema/chassis/item/mule.og.png')).toBe(ogImagePath('chassis', 'mule'))
    expect(currentPathFor('/schema/chassis/item/mule/pattern/hauler.og.png')).toBe(
      ogImagePath('chassis', 'mule', 'hauler')
    )
  })

  it('adds the trailing slash a page wants, so the 301 is the only hop', () => {
    expect(currentPathFor('/schema/chassis/item/mule')).toBe('/chassis/mule/')
    expect(currentPathFor('/schema/chassis')).toBe('/chassis/')
  })

  it('leaves the JSON API and anything else alone', () => {
    for (const path of [
      '/schema/chassis.json',
      '/schema/chassis.schema.json',
      '/schema/chassis/item/mule.json',
      '/schema/',
      '/schema/chassis/item/',
      '/chassis/mule/',
      '/about/',
      '/screen/',
    ]) {
      expect(currentPathFor(path)).toBeUndefined()
    }
  })
})
