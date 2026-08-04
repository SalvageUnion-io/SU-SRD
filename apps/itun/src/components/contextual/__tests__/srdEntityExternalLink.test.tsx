/**
 * Tests for srdEntityExternalLink (design review P-3).
 *
 * The builder is ITUN's app-wide EntityExternalLinkProvider value: full entity
 * cards + detail modals render its node in their foot band. It must produce a
 * ViewInSRDLink for real catalog entities and nothing for entities whose
 * schema has no srd page.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { must } from '../../__tests__/must'
import { srdEntityExternalLink } from '../srdEntityExternalLink'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('srdEntityExternalLink', () => {
  it('builds a "View in SRD →" link for a catalog entity', () => {
    const chassis = must(SalvageUnionReference.Chassis.find((c) => c.name === 'Mule'))
    const node = srdEntityExternalLink(chassis)
    expect(node).toBeTruthy()

    const { container } = render(node)
    const link = container.querySelector('a')
    expect(link?.href).toBe('https://salvageunion.io/schema/chassis/item/mule')
    expect(link?.target).toBe('_blank')
    expect(link?.textContent).toBe('View in SRD →')
    expect(link?.getAttribute('aria-label')).toContain('Mule')
  })

  it('returns undefined for entities without a schemaName', () => {
    // A complete keyword entity that simply carries no schemaName tag.
    const entity: SURefEntity = {
      id: 'x',
      name: 'No Schema',
      source: 'Salvage Union Workshop Manual',
      page: 1,
      blackMarket: false,
    }
    expect(srdEntityExternalLink(entity)).toBeUndefined()
  })

  it('returns undefined for schemas outside the SRD catalog', () => {
    const entity: SURefEntity & { schemaName: string } = {
      id: 'x',
      name: 'Ghost',
      source: 'Salvage Union Workshop Manual',
      page: 1,
      blackMarket: false,
      schemaName: 'not-a-schema',
    }
    expect(srdEntityExternalLink(entity)).toBeUndefined()
  })
})
