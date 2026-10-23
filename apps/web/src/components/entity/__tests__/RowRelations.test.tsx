/**
 * A Compact's RELATIONS (`chips-and-actions.md` C11): what it is built on or
 * linked to, label first (`CLASS | Engineer`, `PILOT | Bonesaw`), in the one
 * chip group after the traits and before the cost. A book entity Peeks and
 * opens; a player unit opens its sheet; a link-mode Compact with relations is
 * covered, so they link outside its link.
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { unitRowModel } from '../../../lib/units/unitModel'
import { Entity } from '../Entity'
import { EntitySurfaceContext } from '../entitySurfaceContext'
import { relation } from '../parts/tagItems'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}

/** Each chip in the Compact's chip group, as its text. */
const chipTexts = (container: HTMLElement) =>
  Array.from(container.querySelector('[data-chip-group]')?.children ?? []).map((chip) =>
    (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
  )

describe('Compact relations', () => {
  test('come after the traits and before the cost', () => {
    const shield = need(
      SalvageUnionReference.Systems.getByName('Electro-Magnetic Shield Projector'),
      'shield'
    )
    const { container } = render(
      <Entity
        size="compact"
        entity={shield}
        relations={[relation('pilot', 'Pilot', 'Bonesaw', { href: '/pilots/p1' })]}
      />
    )
    const chips = chipTexts(container)
    const pilot = chips.indexOf('PilotBonesaw')
    expect(pilot).toBeGreaterThan(-1)
    expect(chips[pilot + 1]).toBe('2 EP')
    expect(chips.slice(0, pilot).some((chip) => chip.startsWith('Shield'))).toBe(true)
  })

  test("a book entity's relation carries its ref: it Peeks", () => {
    const engineer = need(SalvageUnionReference.Classes.getByName('Engineer'), 'engineer')
    const { ref, title } = toEntityModel(engineer)
    const { container } = render(
      <Entity
        size="compact"
        model={unitRowModel({ kind: 'pilot', name: 'Bonesaw' })}
        relations={[relation('class', 'Class', title, { ref })]}
      />
    )
    const chip = container.querySelector('[data-tag]')
    expect(chip?.textContent?.replace(/\s+/g, '')).toBe('ClassEngineer')
    expect(chip?.getAttribute('data-peek')).toBe(`classes:${ref.id}`)
  })

  test("a unit's relation opens its sheet, through the app's router link", () => {
    const routed: string[] = []
    const RouterLink = ({
      href,
      children,
      ...rest
    }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children?: ReactNode }) => {
      routed.push(href)
      return (
        <a href={href} {...rest}>
          {children}
        </a>
      )
    }
    const { container } = render(
      <EntitySurfaceContext.Provider value={{ linkAs: RouterLink }}>
        <Entity
          size="compact"
          model={unitRowModel({ kind: 'mech', name: 'Scrapper' })}
          relations={[relation('pilot', 'Pilot', 'Bonesaw', { href: '/pilots/p1' })]}
        />
      </EntitySurfaceContext.Provider>
    )
    expect(container.querySelector('a[data-tag]')?.getAttribute('href')).toBe('/pilots/p1')
    expect(routed).toEqual(['/pilots/p1'])
  })

  test('a link-mode Compact is covered: the relation links, outside the Compact’s link', () => {
    const { container } = render(
      <Entity
        size="compact"
        model={unitRowModel({ kind: 'mech', name: 'Scrapper' })}
        mode={{ kind: 'link', href: '/mechs/m1' }}
        relations={[relation('pilot', 'Pilot', 'Bonesaw', { href: '/pilots/p1' })]}
      />
    )
    const chip = container.querySelector('a[data-tag]')
    expect(chip?.getAttribute('href')).toBe('/pilots/p1')
    const cover = container.querySelector('.su-entity-compact__cover')
    expect(cover?.getAttribute('href')).toBe('/mechs/m1')
    expect(cover?.contains(chip ?? null)).toBe(false)
  })
})
