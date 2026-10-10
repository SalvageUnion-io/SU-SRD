/**
 * ONE ANATOMY, TWO FILLS, LEGIBLE NESTING (#1253, boards E1–E4).
 *
 * Rendered through the real card with real SRD data:
 * - have vs do picks the header fill by data shape;
 * - every card wears the seam type stamp; an ability adds its tree and its
 *   tier numeral;
 * - actions sit inline as flush ink bands, with no "Action" stamp;
 * - nested entities sit in a labelled tray, depth 2 is a one-line row that
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

  test('an ability is an ink banner: tree on the seam, tier numeral, cost pennant', () => {
    const { container } = render(<ReferenceEntityCard data={juryRig()} />)
    expect(fills(container)[0]).toBe('ink')
    expect(screen.getByText('Ability · Forging Tree')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
    expect(screen.getByText('2 AP')).toBeTruthy()
  })

  test('a system is a tone header with the type stamp on its seam at depth 0', () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    expect(fills(container)[0]).toBe('tone')
    // The seam stamp and the footer both name the type.
    expect(screen.getAllByText('System').length).toBe(2)
  })
})

describe('actions sit inline', () => {
  test("a system's actions are flush ink bands, with no Action stamp", () => {
    const { container } = render(<ReferenceEntityCard data={drill()} />)
    // The card's own tone header, then one ink band per action.
    expect(fills(container)).toEqual(['tone', 'ink', 'ink'])
    expect(screen.queryByText('Action')).toBeNull()
    expect(container.textContent).toContain('Turn Action // Range: Close // Damage: 1 SP // Melee')
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
  test('the drone sits in a labelled tray, and hides the prose its parent prints', () => {
    render(<ReferenceEntityCard data={sestra()} />)
    expect(screen.getByText('Drone · 1')).toBeTruthy()
    expect(screen.getByText('Systems · 1')).toBeTruthy()
    // "…comes with a single Sestra Drone…" is printed once — by the Drone
    // Controller ability — not again by the drone it names.
    expect(screen.getAllByText(/comes with a single Sestra Drone/).length).toBe(1)
  })

  test('depth 2 is a one-line row that opens the entity', () => {
    render(<ReferenceEntityCard data={sestra()} />)
    const row = screen.getByRole('button', { name: 'Open Hover Locomotion System' })
    const title = within(row).getByText('Hover Locomotion System')
    expect(title.getAttribute('title')).toBe('Hover Locomotion System')
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
  test('dashes the frame and the footer rule, and stamps the seam', () => {
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

  test('dashes the shortform pill, at the smallest extent', () => {
    const { container } = render(
      <ReferenceEntityCard data={drill()} size="small" extent="head" userMade />
    )
    const pill = container.querySelector<HTMLElement>('[title^="Made by a player"]')
    expect(pill?.style.borderStyle).toBe('dashed')
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
