/**
 * Tests for srdEntityExternalLink.
 *
 * The builder is the Cantina's app-wide EntityExternalLinkProvider value: full entity
 * cards + detail modals render its node in their foot band. It must produce a
 * same-tab "View in SRD" link for real catalog entities and nothing for entities whose
 * schema has no srd page.
 */

import { describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import type { RefEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { srdOrigin } from '../../../lib/srdOrigin'
import { must } from '../../__tests__/must'
import { srdEntityExternalLink } from '../srdEntityExternalLink'

describe('srdEntityExternalLink', () => {
  it('builds a same-tab "View in SRD" link for a catalog entity', () => {
    const chassis = must(SalvageUnionReference.Chassis.getByName('Mule'))
    const node = srdEntityExternalLink(chassis)
    expect(node).toBeTruthy()

    const { container } = render(node)
    const link = container.querySelector('a')
    expect(link?.href).toBe(`${srdOrigin()}/chassis/mule/`)
    // Same tab, no arrow: the SRD is not off-site (ruleset §3.11, EDL E5).
    expect(link?.hasAttribute('target')).toBe(false)
    expect(link?.hasAttribute('rel')).toBe(false)
    expect(link?.className).toContain('su-srd-entity-external-link')
    expect(link?.textContent).toBe('View in SRD')
    expect(link?.getAttribute('aria-label')).toContain('Mule')
  })

  it('returns undefined for entities without a schemaName', () => {
    // A complete keyword entity that simply carries no schemaName tag.
    const entity: RefEntity = {
      id: 'x',
      name: 'No Schema',
      source: 'Salvage Union Workshop Manual',
      page: 1,
      blackMarket: false,
    }
    expect(srdEntityExternalLink(entity)).toBeUndefined()
  })

  it('returns undefined for schemas outside the SRD catalog', () => {
    const entity: RefEntity & { schemaName: string } = {
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
