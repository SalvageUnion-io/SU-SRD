/**
 * ONE ANATOMY, TWO FILLS, LEGIBLE NESTING (boards E1–E4).
 *
 * Rendered through the real card with real SRD data:
 * - have vs do picks the header fill by data shape;
 * - every card wears the type stamp in its header; an ability adds its tree and its
 *   tier numeral;
 * - actions sit inline as flush ink bands, with no "Action" stamp;
 * - nested entities stack under their own type stamp with no tray label, depth 2 is a one-line row that
 *   opens the entity, and a child hides prose its parent already prints;
 * - below depth 1 actions fold behind a chip;
 * - the user-made flag dashes the frame, the footer rule and the pill;
 * - `texture={false}` flattens the card and every card inside it;
 * - a `pennant` control turns the cost pennant into the action button.
 */
import { describe, expect, mock, test } from 'bun:test'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SalvageUnionReference } from 'salvageunion-reference'
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
    // A read cost is the book's pointy box, last in the chip group: no pennant.
    expect(container.querySelector('.su-pennant')).toBeNull()
    expect(container.querySelector('[data-chip-group]')?.textContent).toMatch(/2 AP$/)
  })

  test('a system is a tone header with no kind stamp: only the footer names the type', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    expect(fills(container)[0]).toBe('tone')
    expect(screen.getAllByText('System')).toHaveLength(1)
  })
})

describe('actions sit inline', () => {
  test("a system's actions are flush ink bands, with no Action stamp", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    // The card's own tone header, then one ink band per action.
    expect(fills(container)).toEqual(['tone', 'ink', 'ink'])
    expect(screen.queryByText('Action')).toBeNull()
    // E17: one chip group per band: the action type in the book's words,
    // the facts, the traits. No "//" line.
    expect(container.textContent).not.toContain('//')
    expect(screen.getAllByText('Turn Action').length).toBeGreaterThan(0)
    expect(container.textContent).toContain('RNGClose')
    expect(container.textContent).toContain('DMG1 SP')
    expect(screen.getAllByText('Melee').length).toBeGreaterThan(0)
  })

  test("an action's chips are the entity's own: the same plates and the ink cost box", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    const groups = [...container.querySelectorAll<HTMLElement>('[data-chip-group]')]
    const [host, ...actions] = groups
    const plates = (group: HTMLElement | undefined) =>
      [...(group?.querySelectorAll('.su-stat-plate--label') ?? [])].map((el) =>
        el.classList.contains('su-badge--inverse')
      )
    expect(actions).toHaveLength(2)
    // Every label plate is ink on the host's tone band and on each ink band alike.
    expect(plates(host).every((inverse) => !inverse)).toBe(true)
    for (const group of actions) {
      expect(plates(group).length).toBeGreaterThan(0)
      expect(plates(group).every((inverse) => !inverse)).toBe(true)
      // The cost is last: the ink pointy box, edged in paper so it clears the band.
      const edge = group.lastElementChild
      expect(edge?.classList.contains('su-cost-edge')).toBe(true)
      expect(edge?.querySelector('.su-cost')?.textContent).toBe('1 EP')
    }
  })

  test("on a Page an action's chips take the page's rung, as the host's own do", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} presentation="page" />)
    const groups = [...container.querySelectorAll<HTMLElement>('[data-chip-group]')]
    expect(groups.length).toBe(3)
    for (const group of groups) {
      expect(group.querySelector('.su-stat-plate--full')).not.toBeNull()
      expect(group.querySelector('.su-stat-plate--compact')).toBeNull()
    }
  })

  test('below depth 1 they fold behind a "Show N actions" chip', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} size="medium" depth={2} />)
    expect(fills(container)).toEqual(['tone'])
    fireEvent.click(screen.getByRole('button', { name: 'Show 2 actions' }))
    expect(fills(container)).toEqual(['tone', 'ink', 'ink'])
    expect(screen.getByRole('button', { name: 'Hide 2 actions' })).toBeTruthy()
  })
})

describe('nesting legibility', () => {
  test('the drone stacks with no stamp or tray label, and hides the prose its parent prints', () => {
    render(<ReferenceEntityCard data={sestra()} />)
    // No "Drone" stamp (E9: the title reads its kind out) and no "Systems"
    // tray label.
    expect(screen.queryByText('Drone')).toBeNull()
    expect(screen.getAllByText(/\(Drone\)/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Systems')).toBeNull()
    // "…comes with a single Sestra Drone…" is printed once — by the Drone
    // Controller ability — not again by the drone it names.
    expect(screen.getAllByText(/comes with a single Sestra Drone/).length).toBe(1)
  })

  test('depth 2 is a one-line row that opens the entity', () => {
    render(<ReferenceEntityCard data={sestra()} />)
    const row = screen.getByRole('button', { name: 'Open Hover Locomotion System' })
    const title = within(row).getByText('Hover Locomotion System')
    // The full name rides the clamped title (on a TL band, around its paper chip).
    expect(title.closest('[title]')?.getAttribute('title')).toBe('Hover Locomotion System')
    fireEvent.click(row)
    expect(screen.getByRole('dialog')).toBeTruthy()
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
      <ReferenceEntityCard data={drill()} size="small" extent="head" userMade />
    )
    const pill = container.querySelector<HTMLElement>('[title^="Made by a player"]')
    expect(pill?.style.borderStyle).toBe('dashed')
    // The dashes are its only visual cue, so it also says so to assistive tech.
    expect(pill?.textContent?.startsWith('User-made')).toBe(true)
  })
})

describe('contexts', () => {
  test('texture={false} flattens the card and every card nested in it', () => {
    const { container } = render(<ReferenceEntityCard data={sestra()} texture={false} />)
    expect(container.querySelectorAll('[data-grain]').length).toBe(0)
    const textured = render(<ReferenceEntityCard data={sestra()} />)
    expect(textured.container.querySelectorAll('[data-grain]').length).toBeGreaterThan(2)
  })

  test('a pennant control makes the cost pennant the action button', () => {
    const onActivate = mock(() => {})
    render(
      <ReferenceEntityCard
        data={auger()}
        controls={[{ key: 'activate', pennant: true, label: 'Activate', onClick: onActivate }]}
      />
    )
    const button = screen.getByRole('button', { name: 'Activate Auger, spend 1 EP' })
    expect(button.textContent).toBe('1 EP')
    fireEvent.click(button)
    expect(onActivate).toHaveBeenCalledTimes(1)
  })
})
