/**
 * The pure seams `ReferenceEntityCard` was split along.
 *
 * Each is a pure function, reachable without a full render. The rendered
 * behaviour is pinned by the card's own
 * suites and by the srd output gate; these pin the rules directly, so a change
 * to one fails here, next to the rule, rather than as a text diff on a page.
 */
import { describe, expect, test } from 'bun:test'
import type { RefMetaEntity, RefObjectContentBlock } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { entityFixture } from 'salvageunion-reference/testing'
import { resolveBodyBlocks, resolveBodyLayout } from '../bodyBlocks'
import { bonusCells, buildHeaderStats, resolveTechScaling } from '../cardCells'
import {
  dullBand,
  GREY_HEADER,
  resolveCardColors,
  resolveCardInteraction,
  resolveFrameWidth,
  resolveHeaderHint,
} from '../cardChrome'
import { resolveNestedSections } from '../nestedSections'

const paragraph = (value: string): RefObjectContentBlock => ({ type: 'paragraph', value })

describe('cardCells', () => {
  test('bonusCells drops zero and absent fields', () => {
    expect(bonusCells({ structurePoints: 2, energyPoints: 0 })).toEqual([
      { key: 'bonus-structurePoints', label: 'Structure', bottomLabel: 'Points', value: '+2' },
    ])
  })

  test('the host scaling level wins, floored at the entity base', () => {
    const entity = entityFixture('systems', { content: [] })
    const scalable = [
      { id: 'c', cardinality: { min: 0, max: { scalesWith: 'techLevel' } } },
    ] as never
    expect(resolveTechScaling(entity, 2, scalable, { techLevel: 4 })).toMatchObject({
      effTechLevel: 4,
      techLevelDisplay: 4,
      techLevelModified: true,
    })
    expect(resolveTechScaling(entity, 3, scalable, { techLevel: 1 })).toMatchObject({
      effTechLevel: 3,
      techLevelModified: false,
    })
    // Not TL-scalable: the header keeps showing the base level.
    expect(resolveTechScaling(entity, 2, [], { techLevel: 4 }).techLevelDisplay).toBe(2)
  })

  test('the TL header stat is size-aware, and absent when the card carries no stats', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0]
    if (!chassis) throw new Error('no chassis fixture')
    const base = {
      entity: chassis as RefMetaEntity,
      schemaName: 'chassis' as const,
      techLevel: 2 as const,
      techLevelDisplay: 2 as const,
      techLevelModified: false,
    }
    expect(buildHeaderStats({ ...base, asCompact: true, none: false })[0]).toMatchObject({
      key: 'tech-level',
      label: 'TL',
      value: '2',
    })
    expect(buildHeaderStats({ ...base, asCompact: false, none: false })[0]).toMatchObject({
      label: 'Tech',
      bottomLabel: 'Level',
    })
    expect(buildHeaderStats({ ...base, asCompact: true, none: true })).toEqual([])
  })
})

describe('bodyBlocks', () => {
  test('drops the damaged-effect paragraph and, in a grant context, the lead', () => {
    const { bodyBlocks } = resolveBodyBlocks({
      content: [
        { type: 'paragraph', value: 'Lead.', lead: true },
        paragraph('Body.'),
        paragraph('When damaged, it stops.'),
      ],
      damagedEffect: 'When damaged, it stops.',
      isGrantContext: true,
      selfActionContent: undefined,
      alwaysShow: false,
      isGrantingAbility: false,
    })
    expect(bodyBlocks).toEqual([paragraph('Body.')])
  })

  test("a self-action's prose is appended, and entity blocks it repeats are dropped", () => {
    const { bodyBlocks } = resolveBodyBlocks({
      content: [paragraph('A rifle.'), paragraph('Fires a long-range shot at a target.')],
      damagedEffect: undefined,
      isGrantContext: false,
      selfActionContent: [paragraph('Fires a long-range shot at a target. It is loud.')],
      alwaysShow: false,
      isGrantingAbility: false,
    })
    expect(bodyBlocks).toEqual([
      paragraph('A rifle.'),
      paragraph('Fires a long-range shot at a target. It is loud.'),
    ])
  })

  test('a granting ability shows no body unless the card always shows one', () => {
    const args = {
      content: [paragraph('Grants a thing.')],
      damagedEffect: undefined,
      isGrantContext: false,
      selfActionContent: undefined,
      isGrantingAbility: true,
    }
    expect(resolveBodyBlocks({ ...args, alwaysShow: false }).showBody).toBe(false)
    expect(resolveBodyBlocks({ ...args, alwaysShow: true }).showBody).toBe(true)
  })

  test('aside lead needs artwork, and a pattern takes it on its own identity', () => {
    const layout = (over: Partial<Parameters<typeof resolveBodyLayout>[0]>) =>
      resolveBodyLayout({
        showImage: true,
        isPattern: false,
        asideLeadRequested: false,
        hasTrailingSection: false,
        ...over,
      })
    expect(layout({})).toEqual({ asideLead: false, flat: true })
    expect(layout({ isPattern: true })).toEqual({ asideLead: true, flat: false })
    // Opted in, but with no trailing section there is nothing to lead into.
    expect(layout({ asideLeadRequested: true })).toEqual({ asideLead: false, flat: true })
    expect(layout({ asideLeadRequested: true, hasTrailingSection: true }).asideLead).toBe(true)
    expect(layout({ showImage: false })).toEqual({ asideLead: false, flat: false })
  })
})

describe('cardChrome', () => {
  const tone = { domain: 'gear' as const, bg: 'var(--color-x)', bgColor: 'red' }

  test('a tone header reads ink or paper by its own contrast', () => {
    // TL1 is light: ink on its header.
    const tl1 = { domain: 'gear' as const, bg: 'var(--color-tl-1)', bgColor: undefined }
    expect(resolveCardColors({ tone: tl1, isDown: false, fill: 'tone' })).toEqual({
      onBand: 'ink',
      bandColor: 'var(--color-tl-1)',
    })
    // A band it cannot resolve reads paper, the solid-tone case; a guide's
    // own colour wins over the domain tone.
    expect(resolveCardColors({ tone, isDown: false, fill: 'tone' })).toEqual({
      onBand: 'paper',
      bandColor: 'red',
    })
  })

  test('an ink header is the ink banner whatever the tone; a damaged one dulls its band', () => {
    expect(resolveCardColors({ tone, isDown: false, fill: 'ink' })).toEqual({
      onBand: 'paper',
      bandColor: 'var(--color-ink)',
    })
    // Damaged dulls the band toward grey, never replacing it: the ink banner
    // stays dark and keeps paper text.
    const inkDown = resolveCardColors({ tone, isDown: true, fill: 'ink' })
    expect(inkDown.onBand).toBe('paper')
    expect(inkDown.bandColor).toBe(dullBand('var(--color-ink)'))
    expect(inkDown.bandColor).toContain('var(--color-ink) 50%')
  })

  test("a damaged tone header is that tone dulled, with the tone's own foreground", () => {
    const pilot = { domain: 'gear' as const, bg: 'var(--color-pilot)', bgColor: undefined }
    const up = resolveCardColors({ tone: pilot, isDown: false, fill: 'tone' })
    const down = resolveCardColors({ tone: pilot, isDown: true, fill: 'tone' })
    expect(down.bandColor).toBe(dullBand('var(--color-pilot)'))
    expect(down.bandColor).toContain('var(--color-pilot) 50%')
    expect(down.onBand).toBe(up.onBand)
  })

  test('a destroyed header is flat grey, whatever its fill', () => {
    for (const fill of ['tone', 'ink'] as const) {
      expect(resolveCardColors({ tone, isDown: 'destroyed', fill })).toEqual({
        onBand: 'ink',
        bandColor: GREY_HEADER,
      })
    }
  })

  test('the frame steps 3 → 2 → 1.5px with size', () => {
    expect(resolveFrameWidth('full')).toBe('var(--bw-entity)')
    expect(resolveFrameWidth('compact')).toBe('var(--bw-entity-compact)')
    expect(resolveFrameWidth('mini')).toBe('var(--bw-chrome)')
  })

  const base = {
    onCardClick: () => {},
    controls: undefined,
    cardClickable: undefined,
    disabled: undefined,
    selectable: undefined,
    className: undefined,
    cardClickLabel: 'Mule',
    frameWidth: 'var(--bw-entity)',
  }

  test('the frame is the subtle ink-40 (R38)', () => {
    const solid = resolveCardInteraction({ ...base, selectionRole: undefined, selected: undefined })
    expect(solid.frameStyle).toMatchObject({
      borderColor: 'var(--color-ink-40)',
      borderStyle: 'solid',
      borderTopWidth: 'var(--bw-entity)',
    })
  })

  test('a whole-card click announces selection by role', () => {
    // A radio is a RadioCard: it carries the name and the checked state, and
    // Base UI's Radio supplies the role.
    const radio = resolveCardInteraction({ ...base, selectionRole: 'radio', selected: true })
    expect(radio.outer.interaction).toEqual({ 'aria-label': 'Mule' })
    expect(radio.outer.radio?.selected).toBe(true)
    expect(radio.frameStyle.boxShadow).toContain('--color-ink')
    const toggle = resolveCardInteraction({ ...base, selectionRole: 'toggle', selected: false })
    expect(toggle.outer.interaction).toMatchObject({ role: 'button', 'aria-pressed': false })
    expect(toggle.outer.radio).toBeUndefined()
    // Read-only: no interaction attributes at all.
    const readOnly = resolveCardInteraction({
      ...base,
      onCardClick: undefined,
      selectionRole: 'radio',
      selected: undefined,
    }).outer
    expect(readOnly.interaction).toEqual({})
    expect(readOnly.radio).toBeUndefined()
  })

  test("the titanic meta-action's intro becomes the hint and leaves the rest as body", () => {
    const entity = Object.assign(
      entityFixture('actions', {
        name: 'Titanic Actions',
        content: [paragraph('Intro.'), paragraph('Option one.')],
      }),
      { schemaName: 'actions' }
    )
    expect(resolveHeaderHint(entity, { isTitanicMeta: true })).toEqual({
      hintText: 'Intro.',
      titanicBodyContent: [paragraph('Option one.')],
    })
  })
})

describe('nestedSections', () => {
  test('a catalog tile and an action expand nothing', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0] as RefMetaEntity
    const common = {
      entity: chassis,
      pattern: undefined,
      onPage: false,
      depth: 0,
      isGrantingAbility: false,
      foldedAction: undefined,
      droneLoadout: undefined,
    }
    const tile = resolveNestedSections({ ...common, schemaName: 'chassis', isCatalog: true })
    expect(tile.canExpand).toBe(false)
    expect(tile.patternList).toEqual([])
    expect(tile.chassisAbilityEntities).toEqual([])
    const page = resolveNestedSections({ ...common, schemaName: 'chassis', isCatalog: false })
    expect(page.canExpand).toBe(true)
    expect(page.patternList.length).toBeGreaterThan(0)
  })

  test('the chassis ability resolves only on a page, for a chassis and its pattern', () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Mule') as RefMetaEntity
    const pattern = SalvageUnionReference.Chassis.getByName('Mule')?.patterns?.[0]
    const common = {
      entity: chassis,
      schemaName: 'chassis' as const,
      isCatalog: false,
      depth: 0,
      isGrantingAbility: false,
      foldedAction: undefined,
      droneLoadout: undefined,
    }
    for (const view of [undefined, pattern]) {
      const page = resolveNestedSections({ ...common, pattern: view, onPage: true })
      expect(page.chassisAbilityEntities.length).toBeGreaterThan(0)
      const card = resolveNestedSections({ ...common, pattern: view, onPage: false })
      expect(card.chassisAbilityEntities).toEqual([])
    }
  })

  test('a builder pick (`showChassisAbility`) resolves the chassis ability off the page, never on a tile', () => {
    const chassis = SalvageUnionReference.Chassis.getByName('Mule') as RefMetaEntity
    const common = {
      entity: chassis,
      schemaName: 'chassis' as const,
      pattern: undefined,
      onPage: false,
      showChassisAbility: true,
      depth: 0,
      isGrantingAbility: false,
      foldedAction: undefined,
      droneLoadout: undefined,
    }
    expect(
      resolveNestedSections({ ...common, isCatalog: false }).chassisAbilityEntities.length
    ).toBeGreaterThan(0)
    expect(resolveNestedSections({ ...common, isCatalog: true }).chassisAbilityEntities).toEqual([])
  })
})
