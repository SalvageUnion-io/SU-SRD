/**
 * ONE ANATOMY, TWO FILLS, LEGIBLE NESTING (boards E1–E4).
 *
 * Rendered through the real card with real SRD data:
 * - have vs do picks the header fill by data shape;
 * - every card wears the type stamp in its header; an ability adds its tree and its
 *   tier numeral;
 * - actions nest as framed ink-headed cards, with no "Action" stamp;
 * - nested entities stack under their own type stamp with no tray label, level 2 is a Token that
 *   opens the entity (N1), and a child hides prose its parent already prints;
 * - below depth 1 actions fold behind a chip;
 * - the user-made flag dashes the frame, the footer rule and the pill;
 * - `texture={false}` flattens the card and every card inside it.
 */
import { describe, expect, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
import { InsidePeekContext } from '../../../entity/peekContext'
import { hideShownProse, proseKey } from '../bodyBlocks'
import { isDoEntity } from '../entityCardTone'
import { ReferenceEntityCard } from '../ReferenceEntityCard'

const need = <T,>(value: T | undefined, label: string): T => {
  if (value === undefined) throw new Error(`fixture missing: ${label}`)
  return value
}
const drill = () => need(SalvageUnionReference.Systems.getByName('Salvaging Drill'), 'drill')
const sestra = () => need(SalvageUnionReference.Chassis.getByName('Little Sestra'), 'sestra')
const juryRig = () => need(SalvageUnionReference.Abilities.getByName('Jury Rig'), 'jury rig')
const auger = () => need(SalvageUnionReference.Actions.getByName('Auger'), 'auger')

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('[data-fill]')].map((el) => el.dataset.fill)

describe('have vs do', () => {
  test('decided by data shape: an ability and an action DO, a system HAS', () => {
    expect(isDoEntity(juryRig())).toBe(true)
    expect(isDoEntity(auger())).toBe(true)
    expect(isDoEntity(drill())).toBe(false)
  })

  test('an ability is an ink banner: tier numeral, its kind read out, its cost last', () => {
    const { container } = render(<ReferenceEntityCard data={juryRig()} />)
    expect(fills(container)[0]).toBe('ink')
    // The kind and tree are never stamped (E9): the title says them to screen readers.
    expect(screen.queryByText('Ability · Forging Tree')).toBeNull()
    expect(container.querySelector('.su-sr-only')?.textContent).toBe(' (Ability, Forging Tree)')
    expect(screen.getByText('1')).toBeTruthy()
    // A read cost is the book's pointy box, last in the chip group.
    expect(container.querySelector('[data-chip-group]')?.textContent).toMatch(/2 AP$/)
  })

  test('a system is a tone header with no kind stamp, nor a kind on its foot (E9: only a Page foot)', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    expect(fills(container)[0]).toBe('tone')
    expect(screen.queryByText('System')).toBeNull()
  })
})

describe('actions nest', () => {
  test("a card's actions are contentful Tokens, with no Action stamp (N3)", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    // A card is level 1, so its actions are level 2: no frame inside its own.
    expect(container.querySelectorAll('.su-ec-frame .su-ec-frame')).toHaveLength(0)
    const tokens = container.querySelectorAll('.su-entity-token[data-contentful]')
    expect([...tokens].map((t) => t.querySelector('.su-entity-token__name')?.textContent)).toEqual([
      'Auger (Action)',
      'Drill (Action)',
    ])
    // The card's own tone header is its only band.
    expect(fills(container)).toEqual(['tone'])
    expect(screen.queryByText('Action')).toBeNull()
    // E17: one chip group on each head, no "//" line: the action type in the
    // book's words, every facet (its range as the book's code), its traits.
    expect(container.textContent).not.toContain('//')
    expect(screen.getAllByText('Turn Action').length).toBeGreaterThan(0)
    expect(container.textContent).toContain('RNGC')
    expect(container.textContent).toContain('DMG1 SP')
    expect(screen.getAllByText('Melee').length).toBeGreaterThan(0)
    // Then each one's text, in its body, never in its head.
    const drillToken = tokens[1] as HTMLElement
    const body = drillToken.querySelector('.su-entity-token__body')
    expect(body?.textContent).toContain('tear apart a Mech with surgical precision')
    expect(drillToken.querySelector('.su-entity-token__head')?.textContent).not.toContain(
      'surgical precision'
    )
  })

  test("an action Token's head closes on its ink cost box", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    const heads = [
      ...container.querySelectorAll<HTMLElement>(
        '.su-entity-token[data-contentful] .su-entity-token__chips'
      ),
    ]
    expect(heads).toHaveLength(2)
    for (const chips of heads) {
      const last = [...chips.children].filter((lane) => lane.childElementCount > 0).at(-1)
      const cost = last?.querySelector('.su-cost') ?? last
      expect(cost?.textContent).toContain('1 EP')
    }
  })

  test("on a Page an action's chips are a Card head's, Compact (C1a)", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} presentation="page" />)
    // The drill's own chips ride the page's band; its two actions are cards.
    const groups = [...container.querySelectorAll<HTMLElement>('[data-chip-group]')]
    expect(groups.length).toBe(2)
    for (const group of groups) {
      expect(group.querySelector('.su-stat-plate--compact')).not.toBeNull()
      expect(group.querySelector('.su-stat-plate--full')).toBeNull()
    }
  })

  test('on a Page they stay level-1 framed cards, never Tokens', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} presentation="page" />)
    expect(container.querySelectorAll('.su-entity-token[data-contentful]')).toHaveLength(0)
    expect(fills(container)).toEqual(['ink', 'ink'])
  })

  test('deeper they are still contentful Tokens, never folded behind a chip', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} size="compact" depth={2} />)
    expect(container.querySelectorAll('.su-entity-token[data-contentful]')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: /Show \d+ actions/ })).toBeNull()
    expect(fills(container)).toEqual(['tone'])
  })

  test('inside a Peek an action Token reads: no link, no Peek of its own (E16)', () => {
    const { container } = render(
      <InsidePeekContext.Provider value={true}>
        <ReferenceEntityCard data={drill()} size="mini" />
      </InsidePeekContext.Provider>
    )
    const tokens = container.querySelectorAll('.su-entity-token[data-contentful]')
    expect(tokens).toHaveLength(2)
    for (const token of tokens) {
      expect(token.querySelector('a, button, [data-peek]')).toBeNull()
    }
  })
})

describe('nesting legibility', () => {
  test('the drone stacks with no stamp or tray label, and hides the prose its parent prints', () => {
    // On a Page the drone is a level-1 card (N1).
    const { container } = render(<ReferenceEntityCard data={sestra()} presentation="page" />)
    const drone = [...container.querySelectorAll<HTMLElement>('.su-ec-frame')].find((frame) =>
      frame.textContent?.includes('Hover Locomotion System')
    )
    if (!drone) throw new Error('no drone card')
    // No "Drone" stamp (E9: the title reads its kind out) and no "Systems"
    // tray label.
    expect(within(drone).queryByText('Drone')).toBeNull()
    expect(within(drone).getAllByText(/\(Drone\)/).length).toBeGreaterThan(0)
    expect(within(drone).queryByText('Systems')).toBeNull()
    // "…comes with a single Sestra Drone…" is printed once — by the Drone
    // Controller ability — not again by the drone it names.
    expect(screen.getAllByText(/comes with a single Sestra Drone/).length).toBe(1)
  })

  test('level 2 is a Token that opens the entity (N1)', () => {
    // Page → drone card (level 1) → its system, a Token (level 2).
    render(<ReferenceEntityCard data={sestra()} presentation="page" />)
    const token = screen.getByRole('button', { name: 'Open Hover Locomotion System' })
    expect(token.classList.contains('su-entity-token')).toBe(true)
    fireEvent.click(token)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  test('a card that is not a Page nests Tokens: the drone, not its card (N1)', () => {
    const { container } = render(<ReferenceEntityCard data={sestra()} />)
    const drone = screen.getByRole('button', { name: 'Open Sestra Drone' })
    expect(drone.classList.contains('su-entity-token')).toBe(true)
    // Its loadout is its Peek's and its Page's, not nested a level deeper.
    expect(screen.queryByRole('button', { name: 'Open Hover Locomotion System' })).toBeNull()
    expect(container.querySelectorAll('.su-ec-frame')).toHaveLength(1)
  })

  test('proseKey matches the same sentence through the chassis token', () => {
    const parent = proseKey('[(CHASSIS)] comes with a single Sestra Drone.', 'Little Sestra')
    const child = proseKey('The Little Sestra comes with a single Sestra Drone.', undefined)
    expect(child).toBe(parent)
    const kept = hideShownProse(
      [
        { type: 'paragraph', value: 'The Little Sestra comes with a single Sestra Drone.' },
        { type: 'paragraph', value: 'It functions effectively as a Mech, but cannot Push.' },
      ],
      [parent],
      'Little Sestra'
    )
    expect(kept).toHaveLength(1)
  })
})

describe('the user-made flag', () => {
  test('dashes the frame and the footer rule, and stamps the header', () => {
    const chassis = sestra()
    const pattern = need(chassis.patterns?.[0], 'pattern')
    const { container } = render(<ReferenceEntityCard data={chassis} pattern={pattern} userMade />)
    const stamp = screen.getByText('User-made')
    expect(stamp.getAttribute('title')).toBe('Made by a player, not from the Workshop Manual')
    const dashed = [...container.querySelectorAll<HTMLElement>('div')].filter(
      (el) => el.style.borderStyle === 'dashed' || el.style.borderTopStyle === 'dashed'
    )
    // The frame and the footer rule.
    expect(dashed.length).toBeGreaterThanOrEqual(2)
  })

  test('credits the maker in place of the page citation', () => {
    const chassis = sestra()
    const pattern = need(chassis.patterns?.[0], 'pattern')
    const canon = render(<ReferenceEntityCard data={chassis} pattern={pattern} />)
    expect(canon.container.textContent).toContain('p.')
    canon.unmount()

    const { container } = render(
      <ReferenceEntityCard data={chassis} pattern={pattern} userMade madeBy="alxjrvs" />
    )
    expect(screen.getByText('Made by alxjrvs')).toBeTruthy()
    // The chassis it rides on must not lend homebrew a page of the book.
    expect(container.textContent).not.toMatch(/Workshop Manual · p\.\d+/)
  })

  test('madeBy alone, on a canon card, changes nothing', () => {
    const chassis = sestra()
    render(<ReferenceEntityCard data={chassis} madeBy="alxjrvs" />)
    expect(screen.queryByText('Made by alxjrvs')).toBeNull()
  })

  test('a kicker names what a user-made card was built from, as a label in the header', () => {
    render(<ReferenceEntityCard data={sestra()} userMade madeBy="alxjrvs" kicker="From Veteran" />)
    expect(screen.getAllByText('From Veteran')).toHaveLength(1)
  })

  test('dashes the shortform pill, at the smallest extent', () => {
    const { container } = render(
      <ReferenceEntityCard data={drill()} size="mini" extent="head" userMade />
    )
    const pill = container.querySelector<HTMLElement>('[title^="Made by a player"]')
    expect(pill?.style.borderStyle).toBe('dashed')
    // The dashes are its only visual cue, so it also says so to assistive tech.
    expect(pill?.textContent?.startsWith('User-made')).toBe(true)
  })
})

describe('contexts', () => {
  test('texture={false} flattens the card and every card nested in it', () => {
    const { container } = render(
      <ReferenceEntityCard data={sestra()} presentation="page" texture={false} />
    )
    expect(container.querySelectorAll('[data-grain]').length).toBe(0)
    const textured = render(<ReferenceEntityCard data={sestra()} presentation="page" />)
    expect(textured.container.querySelectorAll('[data-grain]').length).toBeGreaterThan(2)
  })
})
