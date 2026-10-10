/**
 * The pure seams `ReferenceEntityCard` was split along (audit PK-08).
 *
 * Each of these used to be inline in the card's 1,880-line body, reachable only
 * through a full render. The rendered behaviour is pinned by the card's own
 * suites and by the srd output gate; these pin the rules directly, so a change
 * to one fails here, next to the rule, rather than as a text diff on a page.
 */
import { describe, expect, test } from 'bun:test'
import type { SURefMetaEntity, SURefObjectContentBlock } from 'salvageunion-reference'
import { SalvageUnionReference } from 'salvageunion-reference'
import { entityFixture } from 'salvageunion-reference/testing'
import { resolveBodyBlocks, resolveBodyLayout } from '../bodyBlocks'
import { actionCells, bonusCells, buildHeaderStats, resolveTechScaling } from '../cardCells'
import {
  resolveCardColors,
  resolveCardInteraction,
  resolveFrameWidth,
  resolveHeaderHint,
} from '../cardChrome'
import { resolveNestedSections } from '../nestedSections'

const paragraph = (value: string): SURefObjectContentBlock => ({ type: 'paragraph', value })

describe('cardCells', () => {
  test('actionCells leads with the type, then range / damage / traits', () => {
    const cells = actionCells({
      actionType: 'Turn',
      range: ['Close', 'Medium'],
      damage: { amount: 4, damageType: 'SP' },
      traits: [{ type: 'explosive', amount: 1 }],
    })
    expect(cells.map((c) => [c.label, c.value])).toEqual([
      ['Turn Action', undefined],
      ['Range', 'Close / Medium'],
      ['Damage', '4 SP'],
      ['Explosive', '1'],
    ])
  })

  test('a split action type reads Mech first, as the book prints it', () => {
    expect(actionCells({ actionType: 'Short' }, 'Turn').map((c) => c.label)).toEqual([
      'Turn Action (Mech)',
      'Short Action (Pilot)',
    ])
  })

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
      entity: chassis as SURefMetaEntity,
      schemaName: 'chassis' as const,
      primaryOnly: false,
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
        hasNpcAnchor: false,
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
    expect(layout({ showImage: false, hasNpcAnchor: true })).toEqual({
      asideLead: false,
      flat: true,
    })
    expect(layout({ showImage: false })).toEqual({ asideLead: false, flat: false })
  })
})

describe('cardChrome', () => {
  const tone = { domain: 'gear' as const, bg: 'bg-x', bgColor: 'red' }

  test('a tone header reads ink or paper by its own contrast', () => {
    // TL1 is light: ink on its header.
    const tl1 = { domain: 'gear' as const, bg: 'bg-tl-1', bgColor: undefined }
    expect(resolveCardColors({ tone: tl1, isDown: false, fill: 'tone' })).toMatchObject({
      onBandText: 'text-ink',
      headerBg: 'bg-tl-1',
    })
    // A band it cannot resolve reads paper, the solid-tone case.
    expect(resolveCardColors({ tone, isDown: false, fill: 'tone' })).toMatchObject({
      onBandText: 'text-paper',
      headerBg: 'bg-x',
      headerBgColor: 'red',
    })
  })

  test('an ink header is the ink banner whatever the tone; a damaged one is grey', () => {
    expect(resolveCardColors({ tone, isDown: false, fill: 'ink' })).toEqual({
      onBandText: 'text-paper',
      headerBg: undefined,
      headerBgColor: 'var(--color-ink)',
    })
    for (const fill of ['tone', 'ink'] as const) {
      const down = resolveCardColors({ tone, isDown: true, fill })
      expect(down.onBandText).toBe('text-ink')
      expect(down.headerBg).toBeUndefined()
      expect(down.headerBgColor).toContain('color-mix')
    }
  })

  test('the frame steps 3 → 2 → 1.5px with size and depth', () => {
    expect(resolveFrameWidth({ size: 'large', extent: 'full', depth: 0 })).toBe('var(--bw-entity)')
    expect(resolveFrameWidth({ size: 'medium', extent: 'full', depth: 1 })).toBe(
      'var(--bw-entity-compact)'
    )
    expect(resolveFrameWidth({ size: 'medium', extent: 'head', depth: 2 })).toBe('var(--bw-chrome)')
    expect(resolveFrameWidth({ size: 'small', extent: 'full', depth: 0 })).toBe('var(--bw-chrome)')
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
    dashed: false,
  }

  test('the frame is ink, and dashed on a user-made card', () => {
    const solid = resolveCardInteraction({ ...base, selectionRole: undefined, selected: undefined })
    expect(solid.frameStyle).toMatchObject({
      borderColor: 'var(--color-ink)',
      borderStyle: 'solid',
      borderTopWidth: 'var(--bw-entity)',
    })
    const userMade = resolveCardInteraction({
      ...base,
      dashed: true,
      selectionRole: undefined,
      selected: undefined,
    })
    expect(userMade.frameStyle.borderStyle).toBe('dashed')
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
    expect(
      resolveHeaderHint(entity, { isTitanicMeta: true, patternListingContent: undefined })
    ).toEqual({ hintText: 'Intro.', titanicBodyContent: [paragraph('Option one.')] })
  })
})

describe('nestedSections', () => {
  test('a catalog tile and an action expand nothing', () => {
    const chassis = SalvageUnionReference.Chassis.all()[0] as SURefMetaEntity
    const common = {
      entity: chassis,
      pattern: undefined,
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
})
