/**
 * Tests for srdEntityExternalLink (design review P-3).
 *
 * The builder is ITUN's app-wide EntityExternalLinkProvider value: full entity
 * cards + detail modals render its node in their foot band. It must produce a
 * ViewInSRDLink for real catalog entities and nothing for entities whose
 * schema has no suref-web page.
 */

import { beforeAll, describe, expect, it } from 'bun:test'
import { render } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import type { SURefEntity } from 'salvageunion-reference'
import { srdEntityExternalLink } from '../srdEntityExternalLink'

beforeAll(async () => {
  await SalvageUnionReference.preload('all')
})

describe('srdEntityExternalLink', () => {
  it('builds a "View in SRD →" link for a catalog entity', () => {
    const chassis = SalvageUnionReference.Chassis.find((c) => c.name === 'Mule')
    const node = srdEntityExternalLink(chassis as unknown as SURefEntity)
    expect(node).toBeTruthy()

    const { container } = render(<>{node}</>)
    const link = container.querySelector('a')
    expect(link?.href).toBe('https://salvageunion.io/schema/chassis/item/mule')
    expect(link?.target).toBe('_blank')
    expect(link?.textContent).toBe('View in SRD →')
    expect(link?.getAttribute('aria-label')).toContain('Mule')
  })

  it('returns undefined for entities without a schemaName', () => {
    const entity = { id: 'x', name: 'No Schema' } as unknown as SURefEntity
    expect(srdEntityExternalLink(entity)).toBeUndefined()
  })

  it('returns undefined for schemas outside the SRD catalog', () => {
    const entity = {
      id: 'x',
      name: 'Ghost',
      schemaName: 'not-a-schema',
    } as unknown as SURefEntity
    expect(srdEntityExternalLink(entity)).toBeUndefined()
  })
})
