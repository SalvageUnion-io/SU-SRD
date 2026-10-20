/**
 * CrewLeadToken — a crawler bay's crew lead as a CONTENTFUL Token (N3):
 * - the head names the NPC, chips the role it holds (`ROLE | Doc`) once it
 *   has a name of its own, and reads its HP live (`HP | 3/4`);
 * - in Edit the head keeps HP, as its stepper (the uses slot), never in the body;
 * - the body holds what the sheet tracks (Keepsake, Motto, Detail, Facts),
 *   each left out in Read when empty;
 * - the group is named for its bay, so several crew leads stay distinguishable.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen, within } from '@testing-library/react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { unitRowModel } from '../../../lib/units/unitModel'
import { CrewLeadToken } from '../CrewLeadToken'

const crew = (name: string) => unitRowModel({ kind: 'npc', name, userMade: true })

const BASE = {
  bayName: 'Med Bay',
  title: 'Doc',
  hp: 3,
  maxHp: 4,
  keepsake: '',
  motto: '',
  detail: '',
  facts: [] as string[],
}

function head(group: HTMLElement): HTMLElement {
  const found = group.querySelector<HTMLElement>('.su-entity-token__head')
  if (!found) throw new Error('no Token head')
  return found
}

describe('CrewLeadToken — the head', () => {
  test('a named crew lead: its role a chip beside its HP, read live', () => {
    render(<CrewLeadToken {...BASE} name="Ambrose" model={crew('Ambrose')} />)
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    const band = head(group)
    // The role rides the head's chips, not a stamp before the name.
    expect(band.querySelector('.su-entity-token__kind')).toBeNull()
    expect(band.querySelector('.su-entity-token__name')?.textContent).toContain('Ambrose')
    expect(within(band).getByText('Role')).toBeTruthy()
    expect(within(band).getByText('Doc')).toBeTruthy()
    expect(band.textContent).toContain('HP')
    expect(band.textContent).toContain('3/4')
    // A contentful Token, never a titled box (N5).
    expect(group.querySelector('.su-entity-token[data-contentful]')).toBeTruthy()
    expect(group.querySelector('.su-box')).toBeNull()
  })

  test('a crew lead with no name of its own chips no role: its title is the role', () => {
    render(<CrewLeadToken {...BASE} name="Doc" model={crew('Doc')} />)
    const band = head(screen.getByRole('group', { name: 'Med Bay crew lead' }))
    expect(within(band).queryByText('Role')).toBeNull()
  })

  test('in Edit the head holds the HP stepper, and the body none', () => {
    render(<CrewLeadToken {...BASE} name="Ambrose" model={crew('Ambrose')} onHpChange={() => {}} />)
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    const band = head(group)
    expect(band.textContent).toContain('3/4')
    expect(within(band).getByRole('button', { name: 'Decrease Med Bay crew HP' })).toBeTruthy()
    const body = group.querySelector<HTMLElement>('.su-entity-token__body')
    expect(body?.textContent ?? '').not.toContain('HP')
  })

  test('a crew lead with no HP to track has no HP chip', () => {
    render(<CrewLeadToken {...BASE} maxHp={0} hp={0} name="Ambrose" model={crew('Ambrose')} />)
    const band = head(screen.getByRole('group', { name: 'Med Bay crew lead' }))
    expect(within(band).queryByText('HP')).toBeNull()
  })

  test("a bay's SRD crew NPC keeps its book HP label, read at the sheet's value", () => {
    const bay = SalvageUnionReference.CrawlerBays.getByName('Med Bay')
    const npc = bay?.npc
    if (!npc) throw new Error('fixture missing: the Med Bay crew NPC')
    render(
      <CrewLeadToken
        {...BASE}
        title={npc.position}
        name=""
        hp={2}
        maxHp={npc.hitPoints}
        entity={{ ...npc, name: npc.position, schemaName: 'npcs' } as unknown as RefMetaEntity}
      />
    )
    const band = head(screen.getByRole('group', { name: 'Med Bay crew lead' }))
    expect(band.textContent).toContain(`2/${npc.hitPoints}`)
    // One HP reading, not the book's beside the sheet's.
    expect(band.textContent?.match(/HP/g)).toHaveLength(1)
  })
})

describe('CrewLeadToken — the body', () => {
  test('Read lists only the lines that hold something', () => {
    render(
      <CrewLeadToken
        {...BASE}
        name="Ambrose"
        model={crew('Ambrose')}
        keepsake="A locket"
        facts={['Hates rain']}
      />
    )
    const group = screen.getByRole('group', { name: 'Med Bay crew lead' })
    const body = group.querySelector<HTMLElement>('.su-entity-token__body')
    if (!body) throw new Error('no Token body')
    expect(within(body).getByText('Keepsake')).toBeTruthy()
    expect(within(body).getByText('A locket')).toBeTruthy()
    expect(within(body).getByText('Hates rain')).toBeTruthy()
    expect(within(body).queryByText('Motto')).toBeNull()
  })
})
