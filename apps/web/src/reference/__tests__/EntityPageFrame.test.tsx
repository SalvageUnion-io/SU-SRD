/**
 * The entity page's frame: the head cluster (parent link, "Build With This")
 * and, on a creation guide, the foot that ends the page on its exits.
 */

import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { resolveEntityPageMeta } from '../../components/index'
import { appPath } from '../../lib/appBase'
import { buildLinkFor, guideExitsFor, STARTER_SET_HREF } from '../../lib/buildLink'
import { entityPageFoot } from '../../lib/entityPageFoot'
import { EntityPageFrame } from '../EntityPageFrame'

function must<T>(value: T | undefined | null): T {
  if (value === undefined || value === null) throw new Error('fixture not found')
  return value
}

const guide = (name: string) => must(SalvageUnionReference.Guides.getByName(name))

function renderGuide(name: string) {
  const item = guide(name)
  return render(
    <EntityPageFrame
      title={item.name}
      tone="rules"
      meta={resolveEntityPageMeta(item)}
      exits={guideExitsFor('guides', item)}
    >
      <p>Body of {item.name}</p>
    </EntityPageFrame>
  )
}

describe('EntityPageFrame', () => {
  test('a creation guide ends on its exits: build, the next guide, and the Starter Set', () => {
    renderGuide('Create a Pilot')
    const exits = screen.getByRole('navigation', { name: 'Where next' })
    const links = within(exits).getAllByRole('link')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      `${appPath('/pilots/new?mode=guided')}`,
      '/guides/create-a-mech/',
      STARTER_SET_HREF,
    ])
    expect(within(exits).getByRole('link', { name: 'Build a pilot' })).toBeDefined()
    expect(within(exits).getByRole('link', { name: /Next: Create a Mech/ })).toBeDefined()
    expect(within(exits).getByRole('link', { name: 'Or play the Starter Set' })).toBeDefined()
    // The exits follow the body.
    const body = screen.getByText('Body of Create a Pilot')
    expect(body.compareDocumentPosition(exits) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  test('the last creation guide has no next link', () => {
    renderGuide('Create a Crawler')
    const exits = screen.getByRole('navigation', { name: 'Where next' })
    expect(within(exits).getAllByRole('link')).toHaveLength(2)
    expect(within(exits).queryByRole('link', { name: /^Next:/ })).toBeNull()
    expect(within(exits).getByRole('link', { name: 'Build a crawler' })).toBeDefined()
  })

  test('any other page has no exits', () => {
    renderGuide('Heat')
    expect(screen.queryByRole('navigation', { name: 'Where next' })).toBeNull()
  })

  test('a chassis page carries "Build With This" into the mech wizard', () => {
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    render(
      <EntityPageFrame
        title={mule.name}
        tone="mech"
        meta={resolveEntityPageMeta(mule)}
        build={buildLinkFor('chassis', mule)}
      >
        <p>Mule body</p>
      </EntityPageFrame>
    )
    const link = screen.getByRole('link', { name: 'Build With This: a mech' })
    expect(link.getAttribute('href')).toBe(`${appPath('/mechs/new?mode=guided&chassis=mule')}`)
    // Chip-sized on a phone, it reaches 44px under a coarse pointer by its hit area.
    expect(link.className).toContain('su-hit-area')
  })

  test('a pattern page links back to its parent beside the title', () => {
    const mule = must(SalvageUnionReference.Chassis.getByName('Mule'))
    const hauler = must(mule.patterns?.find((p) => p.name === 'Hauler'))
    render(
      <EntityPageFrame
        title={`"${hauler.name}"`}
        tone="mech"
        meta={resolveEntityPageMeta(mule, hauler)}
        parent={{ label: 'Pattern of', entityRef: toEntityModel(mule).ref, href: '/chassis/mule/' }}
      >
        <p>Hauler body</p>
      </EntityPageFrame>
    )
    // The label-first chip (`PATTERN OF | Mule`): it opens the chassis and Peeks it.
    const parent = screen.getByRole('link', { name: 'Pattern of: Mule' })
    expect(parent.getAttribute('href')).toBe('/chassis/mule/')
    expect(parent.getAttribute('data-peek')).toBe(`chassis:${mule.id}`)
    expect(parent.querySelector('.su-stat-plate--label')?.textContent).toBe('Pattern of')
  })

  test('the body is the one page body, on the one measure', () => {
    const item = guide('Heat')
    const { container } = render(
      <EntityPageFrame title="Heat" tone="rules" meta={resolveEntityPageMeta(item)}>
        <p>Heat body</p>
      </EntityPageFrame>
    )
    const body = container.querySelector<HTMLElement>('.su-entity__body')
    expect(body?.classList.contains('su-page-body')).toBe(true)
  })
})

describe('entityPageFoot', () => {
  test('carries the printings from meta, and no kind (ruling 3, 2026-10-19)', () => {
    const meta = resolveEntityPageMeta(guide('Heat'))
    expect(entityPageFoot(meta)).toEqual({ printings: meta.printings })
  })
})
