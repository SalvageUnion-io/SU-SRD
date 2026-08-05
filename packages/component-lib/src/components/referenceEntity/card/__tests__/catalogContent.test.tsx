/**
 * CATALOG CONTENT — the guarantee that an index tile is never blank, and never
 * padded out with authorship or a sentence it already said.
 *
 * `extent="catalog"` suppresses every nested element (grants, actions, patterns,
 * chassis abilities, roll-table rows) so a listing page reads uniformly. For a
 * whole family of entities that suppression removed ALL of their substance —
 * a Bio-Maw, a Green Laser Turret, an Adrenal Glands module and a Chimerium
 * Mutant Squad carry no prose of their own, only actions — and their tiles
 * rendered as a bare strip of paper under the stat band.
 */
import { describe, expect, test } from 'bun:test'
import { render, screen } from '@testing-library/react'
import type { SURefEntity } from 'salvageunion-reference'
import { getSchemaCatalog, SalvageUnionReference, SchemaToModelMap } from 'salvageunion-reference'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

/** Text the tile renders, with the entity's own name removed — what a reader
 * learns from the tile beyond the label they clicked. */
function contentBeyondName(entity: SURefEntity): string {
  const { container } = render(<ReferenceEntityCard data={entity} size="medium" extent="catalog" />)
  const text = container.textContent ?? ''
  return text.split(entity.name).join('').trim()
}

function findByName(model: string, name: string): SURefEntity {
  const found = (
    SalvageUnionReference[model as keyof typeof SalvageUnionReference] as unknown as {
      all: () => SURefEntity[]
    }
  )
    .all()
    .find((entity) => entity.name === name)
  if (!found) throw new Error(`fixture missing: ${model} / ${name}`)
  return found
}

describe('catalog tiles always carry content', () => {
  // The whole-dataset sweep. Every schema with a listing page (`meta: false` is
  // what gives a schema a `/schema/<id>/` index in srd) renders a grid of these
  // tiles, so the guarantee has to hold for the entire dataset, not a fixture.
  const listingSchemas = getSchemaCatalog()
    .schemas.filter((schema) => !schema.meta)
    .map((schema) => schema.id)

  test.each(listingSchemas)('every %s tile says something beyond its name', (schemaId) => {
    const model = SchemaToModelMap[schemaId as keyof typeof SchemaToModelMap]
    const all = (
      SalvageUnionReference[model as keyof typeof SalvageUnionReference] as unknown as {
        all: () => SURefEntity[]
      }
    ).all()
    expect(all.length).toBeGreaterThan(0)

    const blank = all.filter((entity) => contentBeyondName(entity).length === 0)
    expect(blank.map((entity) => entity.name)).toEqual([])
  })

  test('an entity whose substance is its ACTIONS borrows their opening line', () => {
    // Bio-Maw is a system with no content of its own — everything it means lives
    // in the Bite / Consume actions the tile suppresses.
    const bioMaw = findByName('Systems', 'Bio-Maw')
    expect('content' in bioMaw ? (bioMaw.content?.length ?? 0) : 0).toBe(0)

    render(<ReferenceEntityCard data={bioMaw} size="medium" extent="catalog" />)
    expect(screen.getByText('You have a mouth, and it must eat.')).toBeTruthy()
  })

  test('a grant-equipment ability borrows the GRANTED entity, not its own action', () => {
    // Holo Companion grants the Holo Companion equipment AND has an action.
    // Grants win: the granted thing is what the ability is for.
    const holo = findByName('Abilities', 'Holo Companion')

    render(<ReferenceEntityCard data={holo} size="medium" extent="catalog" />)
    expect(
      screen.getByText(
        'You have created an intelligent, holographic, A.I. companion that only you can use.'
      )
    ).toBeTruthy()
    // The granted CARD itself stays suppressed — only its opening line is borrowed.
    expect(screen.queryByText('Grants')).toBeNull()
  })

  test('the borrowed lead is ONE paragraph, not every suppressed action', () => {
    // Adrenal Glands grants Burst AND Power. Printing both concatenates two
    // unlabelled sentences — the action names that made them make sense are
    // exactly what catalog mode suppressed.
    const adrenal = findByName('Modules', 'Adrenal Glands')

    render(<ReferenceEntityCard data={adrenal} size="medium" extent="catalog" />)
    expect(screen.getByText(/can move an additional Range band/)).toBeTruthy()
    expect(screen.queryByText(/can make an additional Turn Action/)).toBeNull()
  })

  test('an entity with prose of its own borrows nothing', () => {
    // A tile only borrows when it would otherwise be blank. Bio-Rifle equipment
    // has NO prose and so borrows its action's; the Bio-Titan Chimerium Chosen
    // NPC carries its own, so the same action text must NOT be pulled in.
    const borrowed = 'This handheld Bio-Titan gun fires fleshy spikes that pin a target down.'

    const rifle = findByName('Equipment', 'Bio-Rifle')
    const borrowing = render(<ReferenceEntityCard data={rifle} size="medium" extent="catalog" />)
    expect(borrowing.container.textContent ?? '').toContain(borrowed)
    borrowing.unmount()

    const chosen = SalvageUnionReference.NPCs.all().find((npc) => npc.name === 'Chimerium Chosen')
    if (!chosen) throw new Error('Chimerium Chosen fixture missing')
    expect(chosen.content?.length ?? 0).toBeGreaterThan(0)
    // It wields the Bio-Rifle (Chimerium Chosen) action, whose prose opens the
    // same way — and it must render its OWN description instead.
    const { container } = render(
      <ReferenceEntityCard data={chosen} size="medium" extent="catalog" />
    )
    expect(container.textContent ?? '').not.toContain(borrowed)
  })

  test('a tile with nothing to borrow renders no empty body strip', () => {
    // The lead resolver borrows; it never invents. A Steel Billy Club is TL and
    // nothing else, so the body box is dropped rather than hung under the band
    // as bare paper. `min-h-[2.5rem]` is what would have reserved that strip.
    const club = findByName('Equipment', 'Steel Billy Club')

    const { container } = render(<ReferenceEntityCard data={club} size="medium" extent="catalog" />)
    expect(container.querySelector('[class*="min-h-[2.5rem]"]')).toBeNull()
    // It still says what it does have.
    expect(contentBeyondName(club)).toContain('TL')
  })
})

describe('catalog tiles carry no authorship', () => {
  test('the identity footer — source, booklet, page, type — is dropped', () => {
    const chassis = SalvageUnionReference.Chassis.all().find((c) => !!c.source && !!c.page)
    if (!chassis) throw new Error('no sourced chassis in fixtures — the probe is vacuous')

    // Full extent DOES print the provenance — proves the fixture is a real probe.
    const full = render(<ReferenceEntityCard data={chassis} />)
    expect(screen.getByText(new RegExp(`p\\.${chassis.page}`))).toBeTruthy()
    full.unmount()

    const { container } = render(
      <ReferenceEntityCard data={chassis} size="medium" extent="catalog" />
    )
    const text = container.textContent ?? ''
    expect(text).not.toContain(String(chassis.source))
    expect(text).not.toContain(`p.${chassis.page}`)
    // …and not the entity TYPE either: every tile in a listing grid is the same
    // type, so the label is the same word repeated down the page.
    expect(text).not.toContain('Chassis')
  })

  test('a borrowed lead is never the sentence the header already showed', () => {
    // An ability's description renders as the header's flavour hint. If the
    // thing it grants opens with that same sentence, the tile would say it
    // twice — the redundancy guard drops the duplicate.
    const ability = SalvageUnionReference.Abilities.all().find((a) => {
      const granted = SalvageUnionReference.Equipment.all().find(
        (e) => e.name === a.grants?.[0]?.name
      )
      const lead = granted?.content?.find((block) => block?.type === 'paragraph')?.value
      return !!a.description && typeof lead === 'string' && lead.trim() === a.description.trim()
    })
    // No such collision exists in the current dataset; assert the guard directly
    // instead of skipping, so this test can't silently pass on a vacuous find.
    expect(ability).toBeUndefined()

    const holo = findByName('Abilities', 'Holo Companion')
    const { container } = render(<ReferenceEntityCard data={holo} size="medium" extent="catalog" />)
    const description = 'Construct an intelligent, holographic A.I. companion'
    const occurrences = (container.textContent ?? '').split(description).length - 1
    expect(occurrences).toBe(1)
  })
})
