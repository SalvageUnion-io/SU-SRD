/**
 * A Token carries the chip budget its container's context names
 * (`chips-and-actions.md`, C3 and C4): its rank (TL), the one fact the
 * context carries (a loadout's Slots or SP, play's action type or
 * `ACTIONS | 3`, a roster's vital), then the cost box. An ability's tier
 * numeral leads its name instead of a chip. The model's `tokenChips` is pinned
 * in salvageunion-reference; this file pins the drawing.
 *
 * It fills its line (N4). With a `body` it is contentful (N3): the same
 * one-row head, then the entity's text and the host's content, held by a border in its tone;
 * only the head links and Peeks, and inside a Peek it reads (E16).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { ChipContext, RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'
import { Entity } from '../Entity'
import { InsidePeekContext } from '../peekContext'

const get = (schema: string, name: string) => {
  const entity = SalvageUnionReference.getByNameIn(schema as never, name)
  if (!entity) throw new Error(`fixture missing: ${schema} ${name}`)
  return entity as RefMetaEntity
}

/** Each chip's text, and the cost box's, in order. */
const chipsOf = (schema: string, name: string, context: ChipContext = 'loadout') => {
  const { container } = render(<Entity form="token" context={context} entity={get(schema, name)} />)
  const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
  return Array.from(chips?.querySelectorAll(':scope > .su-chip-lane > *') ?? []).map((chip) =>
    (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
  )
}

describe('Token chips', () => {
  test('in a loadout: TL, then what it takes, label first, then the cost box last', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector')).toEqual([
      'TL3',
      'Slots2',
      '2 EP',
    ])
    expect(chipsOf('systems', 'Red Laser')).toEqual(['TL1', 'Slots3'])
    const { container } = render(
      <Entity form="token" context="loadout" entity={get('systems', 'Red Laser')} />
    )
    const slots = container.querySelector(
      '.su-entity-token__chips > [data-chip-class="measure"] > :last-child'
    )
    expect(slots?.firstElementChild?.textContent).toBe('Slots')
  })

  test('in play: the action type, or how many actions it lists', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector', 'play')).toEqual([
      'TL3',
      'Reaction',
      '2 EP',
    ])
    expect(chipsOf('systems', 'Fabrication Arm', 'play')).toEqual(['TL3', 'Actions3'])
    expect(chipsOf('npcs', 'Saboteur', 'play')).toEqual(['Actions8'])
  })

  test('in a roster: the lead vital; browsing: the rank alone', () => {
    expect(chipsOf('npcs', 'Saboteur', 'roster')).toEqual(['HP6'])
    expect(chipsOf('systems', 'Red Laser', 'browse')).toEqual(['TL1'])
  })

  test('the range, damage and traits never reach a header-only Token', () => {
    for (const context of ['loadout', 'play', 'inventory', 'roster', 'browse'] as const) {
      expect(chipsOf('systems', 'Red Laser', context).some((chip) => chip.startsWith('RNG'))).toBe(
        false
      )
    }
  })

  test('an ability sets its tier numeral before its name, never a tree chip', () => {
    const { container } = render(
      <Entity form="token" context="play" entity={get('abilities', 'Jury Rig')} />
    )
    const pill = container.querySelector('.su-entity-token__pill')
    const tier = pill?.querySelector('.su-entity-token__tier')
    expect(tier?.textContent).toBe('1')
    expect(tier?.nextElementSibling?.className).toBe('su-entity-token__notch')
    expect(
      chipsOf('abilities', 'Jury Rig', 'play').some((chip) => chip.startsWith('Forging'))
    ).toBe(false)
    // A Legendary has no numeral, as on its band.
    const legendary = render(
      <Entity form="token" context="play" entity={get('abilities', 'Tip Top Shape')} />
    )
    expect(legendary.container.querySelector('.su-entity-token__tier')).toBeNull()
    expect(
      chipsOf('abilities', 'Tip Top Shape', 'play').some((chip) => chip.startsWith('Legendary'))
    ).toBe(false)
  })

  test('a chassis in a loadout shows TL and its SP', () => {
    expect(chipsOf('chassis', 'Mule')).toEqual(['TL1', 'SP12'])
  })

  test("a host's trailing chip comes last, after the cost box", () => {
    const { container } = render(
      <Entity
        form="token"
        context="loadout"
        entity={get('systems', 'Electro-Magnetic Shield Projector')}
        trailing={<span>Damaged</span>}
      />
    )
    const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
    // The cost lane, then the state lane (C8); a line keeps its empty lanes (C6).
    expect(chips?.querySelector('[data-chip-class="cost"]')?.textContent).toBe('2 EP')
    const filled = [...(chips?.children ?? [])].filter((lane) => lane.childElementCount > 0)
    expect(filled.at(-1)?.getAttribute('data-chip-class')).toBe('state')
    expect(filled.at(-1)?.textContent).toBe('Damaged')
  })

  test('a trailing chip alone still draws the chip group', () => {
    const { container } = render(
      <Entity
        form="token"
        context="browse"
        entity={get('crawler-bays', 'Mech Bay')}
        trailing={<span>Damaged</span>}
      />
    )
    const chips = container.querySelector('.su-entity-token__chips')
    expect(chips?.querySelector('[data-chip-class="state"]')?.textContent).toBe('Damaged')
  })
})

describe('one chassis chip set in every form', () => {
  test('a chassis keeps TL, SV, SP, EP, SYS, MODS; Cargo and Heat are its Page’s', () => {
    const model = toEntityModel(get('chassis', 'Mule'))
    expect(model.facts.map((fact) => fact.short)).toEqual(['TL', 'SV', 'SP', 'EP', 'SYS', 'MODS'])
    expect(model.bookStats.map((fact) => fact.short)).toEqual([
      'TL',
      'SV',
      'SP',
      'EP',
      'Heat',
      'SYS',
      'MODS',
      'Cargo',
    ])
  })
})

describe('a down Token', () => {
  const pill = (condition?: 'damaged' | 'destroyed') =>
    render(
      <Entity
        form="token"
        context="loadout"
        entity={get('systems', 'Red Laser')}
        instance={condition ? { condition } : undefined}
      />
    ).container

  test('tells its Peek how it is down, so the Peek paints the same way', () => {
    expect(pill().querySelector('[data-peek]')?.getAttribute('data-peek-down')).toBeNull()
    expect(pill('damaged').querySelector('[data-peek]')?.getAttribute('data-peek-down')).toBe(
      'damaged'
    )
    expect(pill('destroyed').querySelector('[data-peek]')?.getAttribute('data-peek-down')).toBe(
      'destroyed'
    )
  })
})

/** The text of a rule's declarations in the package stylesheet, comments stripped. */
const ruleOf = (selector: string) => {
  const css = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
  const at = css.indexOf(`\n${selector} {`)
  if (at < 0) throw new Error(`rule missing: ${selector}`)
  return css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at))
}

describe('a Token fills its line (N4)', () => {
  test("in its own rule, not its callers': the Token and its pill grow to the line", () => {
    const token = ruleOf('.su-entity-token,\n.su-entity-token__head')
    expect(token).toContain('display: flex;')
    expect(token).toContain('flex: 1 1 auto;')
    expect(token).toContain('min-width: 0;')
    const pill = ruleOf('.su-entity-token__pill')
    expect(pill).toContain('display: flex;')
    expect(pill).toContain('flex: 1 1 auto;')
  })

  test('no caller holds a Token to its content width', () => {
    const css = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
    expect(css).not.toMatch(/\.su-entity-token\s*\{[^}]*flex: 0 1 auto/)
  })
})

describe('the contentful Token (N3)', () => {
  const shield = () => get('actions', 'Electro-Magnetic Shield Projector')

  test('header-only is its head alone, as before: the surface holds the pill and nothing else', () => {
    const { container } = render(
      <Entity form="token" context="loadout" entity={get('systems', 'Red Laser')} />
    )
    const token = container.firstElementChild
    expect(token?.className).toBe('su-entity-token')
    expect(token?.hasAttribute('data-contentful')).toBe(false)
    expect(Array.from(token?.children ?? []).map((child) => child.classList[0])).toEqual([
      'su-entity-token__pill',
    ])
    expect(container.querySelector('.su-entity-token__body')).toBeNull()
  })

  test("a body draws the one-row head, then the entity's text under it, outside the pill", () => {
    const { container } = render(
      <Entity form="token" context="loadout" entity={shield()} body={{}} />
    )
    const token = container.querySelector('.su-entity-token[data-contentful]')
    const [head, body] = Array.from(token?.children ?? [])
    expect(head?.className).toContain('su-entity-token__head')
    expect(head?.firstElementChild?.classList[0]).toBe('su-entity-token__pill')
    expect(body?.className).toBe('su-entity-token__body')
    // Every paragraph of the action's rules, not only its opening one.
    expect(body?.textContent).toContain('electro-magnetic field')
    expect(body?.textContent).toContain('When you or a target in Close Range is hit')
    expect(head?.textContent).not.toContain('When you or a target')
  })

  test("the body is held by a border in the pill's own tone, hung from the pill", () => {
    const { container } = render(
      <Entity form="token" context="loadout" entity={shield()} body={{}} />
    )
    const pill = container.querySelector<HTMLElement>('.su-entity-token__pill')
    const body = container.querySelector<HTMLElement>('.su-entity-token__body')
    expect(pill?.style.backgroundColor).not.toBe('')
    expect(body?.style.borderColor).toBe(pill?.style.backgroundColor ?? '')
    const css = readPackageStylesheet()
    expect(css).toMatch(
      /\.su-entity-token__body \{[^}]*border-top: 0;[^}]*border-width: var\(--bw-chrome\);/
    )
    expect(css).toMatch(/\.su-entity-token\[data-contentful\] \{[^}]*gap: 0;/)
  })

  test('its head chips run in the class order: action type, range, traits, then the cost box', () => {
    const { container } = render(<Entity form="token" context="play" entity={shield()} body={{}} />)
    const chips = container.querySelector('.su-entity-token__head .su-entity-token__chips')
    expect(
      Array.from(chips?.querySelectorAll(':scope > .su-chip-lane > *') ?? []).map((chip) =>
        (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
      )
    ).toEqual(['Reaction', 'RNGC', 'Shield', '2 EP'])
    // Header-only keeps its budget: the range and traits are the Row's.
    expect(chipsOf('actions', 'Electro-Magnetic Shield Projector', 'play')).toEqual([
      'Reaction',
      '2 EP',
    ])
  })

  test('the head stays one row (E18): its name keeps the ellipsis and the chips their whole budget', () => {
    const { container } = render(
      <Entity form="token" context="loadout" entity={shield()} body={{}} />
    )
    const pill = container.querySelector('.su-entity-token__head > .su-entity-token__pill')
    expect(pill?.querySelector('.su-entity-token__notch > .su-entity-token__name')).not.toBeNull()
    expect(pill?.querySelector(':scope > .su-entity-token__chips')).not.toBeNull()
    expect(ruleOf('.su-entity-token__pill')).toContain('white-space: nowrap;')
    const name = ruleOf('.su-entity-token__name')
    expect(name).toContain('text-overflow: ellipsis;')
    expect(name).toContain('white-space: nowrap;')
    // Whole chips on one line, never clamped or clipped (C3, C5): the name gives way.
    const chips = ruleOf('.su-entity-token__chips')
    expect(chips).toContain('flex: none;')
    expect(chips).toContain('flex-wrap: nowrap;')
    expect(chips).not.toContain('overflow')
    expect(chips).not.toContain('max-width')
    expect(chips).not.toContain('max-height')
  })

  test('an entity with no prose of its own reads its lead (an ability its description)', () => {
    const { container } = render(
      <Entity form="token" context="loadout" entity={get('abilities', 'Jury Rig')} body={{}} />
    )
    expect(container.querySelector('.su-entity-token__body')?.textContent).toBe(
      'Craft improvised equipment from everyday items.'
    )
  })

  test("the host's content follows the text; without the text it is the whole body", () => {
    const withText = render(
      <Entity
        form="token"
        context="loadout"
        entity={shield()}
        body={{ children: <p>Keepsake: a brass key</p> }}
      />
    ).container.querySelector('.su-entity-token__body')
    expect(withText?.lastElementChild?.textContent).toBe('Keepsake: a brass key')
    expect(withText?.textContent).toContain('electro-magnetic field')
    const alone = render(
      <Entity
        form="token"
        context="loadout"
        entity={shield()}
        body={{ text: false, children: <p>Keepsake: a brass key</p> }}
      />
    ).container.querySelector('.su-entity-token__body')
    expect(alone?.textContent).toBe('Keepsake: a brass key')
  })

  test('only the head links and Peeks: the body never nests in its link', () => {
    const { container } = render(
      <Entity
        form="token"
        context="loadout"
        entity={get('systems', 'Red Laser')}
        mode={{ kind: 'link', href: '/systems/red-laser/' }}
        body={{ children: <button type="button">Edit</button> }}
      />
    )
    const link = container.querySelector('a')
    expect(link?.className).toContain('su-entity-token__head')
    expect(link?.hasAttribute('data-peek')).toBe(true)
    expect(link?.querySelector('button')).toBeNull()
    expect(container.querySelector('.su-entity-token__body button')).not.toBeNull()
  })

  test('inside a Peek it reads and is terminal (E16): no link, no Peek of its own', () => {
    const { container } = render(
      <InsidePeekContext.Provider value={true}>
        <Entity
          form="token"
          context="loadout"
          entity={get('systems', 'Red Laser')}
          mode={{ kind: 'link', href: '/systems/red-laser/' }}
          body={{}}
        />
      </InsidePeekContext.Provider>
    )
    expect(container.querySelector('a')).toBeNull()
    expect(container.querySelector('[data-peek]')).toBeNull()
    expect(container.querySelector('.su-entity-token__body')).not.toBeNull()
  })
})

describe("a contentful Token's overflow row (C2b)", () => {
  const meld = () => get('abilities', 'Meld Form')

  test("is its body's first row, drawn empty and hidden until a chip does not fit", () => {
    const { container } = render(
      <Entity
        form="token"
        context="play"
        entity={meld()}
        mode={{ kind: 'link', href: '/abilities/meld-form/' }}
        body={{}}
      />
    )
    const body = container.querySelector('.su-entity-token__body')
    const row = body?.firstElementChild as HTMLElement | null
    expect(row?.hasAttribute('data-chip-overflow')).toBe(true)
    expect(row?.hidden).toBe(true)
    expect(row?.childElementCount).toBe(0)
    // No +MORE on a contentful Token: its body has the room (C5).
    expect(container.querySelector('.su-chip-more, .su-entity-token__more')).toBeNull()
  })

  test('a header-only Token has no overflow row', () => {
    const { container } = render(<Entity form="token" context="play" entity={meld()} />)
    expect(container.querySelector('[data-chip-overflow]')).toBeNull()
  })

  test('a chip that left the head is not drawn there, and a hidden row takes no room', () => {
    const out = ruleOf('.su-chip-more[hidden][hidden][hidden][hidden]')
    expect(out).toContain('display: none;')
    const css = readPackageStylesheet()
    const selectors = css.slice(css.lastIndexOf('\n[data-chip-fill] [data-fill-out]'))
    expect(selectors).toContain('.su-entity-token__chips\n  [data-fill-out]')
    expect(selectors.indexOf('{')).toBeGreaterThan(selectors.indexOf('.su-chip-more[hidden]'))
    expect(ruleOf('.su-chip-overflow[hidden]')).toContain('display: none;')
  })

  test("the out state comes after a fill chip's own display, which is as specific", () => {
    // A Tile's out chips drew in its head as well as in its first row while
    // the fill chips' `display` came later in the file (cceb4a527).
    const css = readPackageStylesheet().replace(/\/\*[\s\S]*?\*\//g, '')
    const fillChip = css.lastIndexOf('> .su-chip-lane\n  > * {')
    const outState = css.indexOf('\n[data-chip-fill] [data-fill-out]')
    expect(fillChip).toBeGreaterThan(0)
    expect(outState).toBeGreaterThan(fillChip)
  })
})
