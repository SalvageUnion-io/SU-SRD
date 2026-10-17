/**
 * A Token carries a short chip set after its name, in the stat order (E17):
 * TL, its slots, HP or SP, then its one action's type or how many it lists
 * (`ACTIONS | 3`, its folded self-action not counted), its range's code
 * (`RNG | C`), then the cost box, the same in every context. A chassis drops
 * its SYS and MODS. An ability's tier numeral leads its name instead of a chip.
 *
 * It fills its line (N4). With a `body` it is contentful (N3): the same
 * one-row head, then the entity's text and the host's content, unframed;
 * only the head links and Peeks, and inside a Peek it reads (E16).
 */
import { describe, expect, test } from 'bun:test'
import { render } from '@testing-library/react'
import type { RefMetaEntity } from 'salvageunion-reference'
import { SalvageUnionReference, toEntityModel } from 'salvageunion-reference'
import { readPackageStylesheet } from '../../../styles/__tests__/packageStylesheet'
import { Entity } from '../Entity'
import { Token } from '../forms/Token'
import { InsidePeekContext } from '../peekContext'

const get = (schema: string, name: string) => {
  const entity = SalvageUnionReference.getByNameIn(schema as never, name)
  if (!entity) throw new Error(`fixture missing: ${schema} ${name}`)
  return entity as RefMetaEntity
}

/** Each chip's text, and the cost box's, in order. */
const chipsOf = (schema: string, name: string) => {
  const { container } = render(<Entity form="token" entity={get(schema, name)} />)
  const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
  return Array.from(chips?.children ?? []).map((chip) =>
    (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
  )
}

describe('Token chips', () => {
  test('a system with several actions counts those it lists after its stats, label first (E17)', () => {
    expect(chipsOf('systems', 'Fabrication Arm')).toEqual(['TL3', 'Slots3', 'Actions3'])
    const { container } = render(<Entity form="token" entity={get('systems', 'Fabrication Arm')} />)
    const count = container.querySelector('.su-entity-token__chips > :last-child')
    expect(count?.firstElementChild?.textContent).toBe('Actions')
  })

  test('TL leads, then the stats, the action type, its range, and the cost box last (E17)', () => {
    expect(chipsOf('systems', 'Electro-Magnetic Shield Projector')).toEqual([
      'TL3',
      'Slots2',
      'Reaction',
      'RNGC',
      '2 EP',
    ])
  })

  test('an ability sets its tier numeral before its name, never a tree chip', () => {
    const { container } = render(<Entity form="token" entity={get('abilities', 'Jury Rig')} />)
    const pill = container.querySelector('.su-entity-token__pill')
    const tier = pill?.querySelector('.su-entity-token__tier')
    expect(tier?.textContent).toBe('1')
    expect(tier?.nextElementSibling?.className).toBe('su-entity-token__notch')
    expect(chipsOf('abilities', 'Jury Rig').some((chip) => chip.startsWith('Forging'))).toBe(false)
    // A Legendary has no numeral, as on its band.
    const legendary = render(<Entity form="token" entity={get('abilities', 'Tip Top Shape')} />)
    expect(legendary.container.querySelector('.su-entity-token__tier')).toBeNull()
    expect(chipsOf('abilities', 'Tip Top Shape').some((chip) => chip.startsWith('Legendary'))).toBe(
      false
    )
  })

  test("a range is the book's code", () => {
    expect(chipsOf('systems', 'Red Laser')).toEqual(['TL1', 'Slots3', 'Turn Action', 'RNGC'])
  })

  test("a chassis shows TL, SV, SP, EP: its SYS and MODS are the Row's", () => {
    expect(chipsOf('chassis', 'Mule')).toEqual(['TL1', 'SV7', 'SP12', 'EP4'])
  })

  test('an NPC shows its HP and its action count', () => {
    expect(chipsOf('npcs', 'Saboteur')).toEqual(['HP6', 'Actions8'])
  })

  test("a host's trailing chip comes last, after the cost box", () => {
    const { container } = render(
      <Entity
        form="token"
        entity={get('systems', 'Electro-Magnetic Shield Projector')}
        trailing={<span>Damaged</span>}
      />
    )
    const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
    expect(chips?.children[chips.children.length - 2]?.textContent).toBe('2 EP')
    expect(chips?.lastElementChild?.textContent).toBe('Damaged')
  })

  test("the Dashboard's pennant carries the cost: no cost box repeats it", () => {
    const model = toEntityModel(get('systems', 'Electro-Magnetic Shield Projector'))
    const { container } = render(
      <Token model={model} slots={{ pennant: <button type="button">2 EP</button> }} />
    )
    const chips = container.querySelector('.su-entity-token__pill > .su-entity-token__chips')
    const texts = Array.from(chips?.children ?? []).map((chip) => chip.textContent)
    expect(texts).toEqual(['TL3', 'Slots2', 'Reaction', 'RNGC'])
  })

  test('a trailing chip alone still draws the chip group', () => {
    const { container } = render(
      <Entity
        form="token"
        entity={get('crawler-bays', 'Mech Bay')}
        trailing={<span>Damaged</span>}
      />
    )
    const chips = container.querySelector('.su-entity-token__chips')
    expect(chips?.lastElementChild?.textContent).toBe('Damaged')
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
    const { container } = render(<Entity form="token" entity={get('systems', 'Red Laser')} />)
    const token = container.firstElementChild
    expect(token?.className).toBe('su-entity-token')
    expect(token?.hasAttribute('data-contentful')).toBe(false)
    expect(Array.from(token?.children ?? []).map((child) => child.className)).toEqual([
      'su-entity-token__pill',
    ])
    expect(container.querySelector('.su-entity-token__body')).toBeNull()
  })

  test("a body draws the one-row head, then the entity's text under it, outside the pill", () => {
    const { container } = render(<Entity form="token" entity={shield()} body={{}} />)
    const token = container.querySelector('.su-entity-token[data-contentful]')
    const [head, body] = Array.from(token?.children ?? [])
    expect(head?.className).toContain('su-entity-token__head')
    expect(head?.firstElementChild?.className).toBe('su-entity-token__pill')
    expect(body?.className).toBe('su-entity-token__body')
    // Every paragraph of the action's rules, not only its opening one.
    expect(body?.textContent).toContain('electro-magnetic field')
    expect(body?.textContent).toContain('When you or a target in Close Range is hit')
    expect(head?.textContent).not.toContain('When you or a target')
  })

  test('its head chips run in the stat order: action type, range, traits, then the cost box', () => {
    const { container } = render(<Entity form="token" entity={shield()} body={{}} />)
    const chips = container.querySelector('.su-entity-token__head .su-entity-token__chips')
    expect(
      Array.from(chips?.children ?? []).map((chip) =>
        (chip.textContent ?? '').replace(/\s+/g, ' ').trim()
      )
    ).toEqual(['Reaction', 'RNGC', 'Shield', '2 EP'])
    // Header-only keeps its short set: the traits are the Row's.
    expect(chipsOf('actions', 'Electro-Magnetic Shield Projector')).toEqual([
      'Reaction',
      'RNGC',
      '2 EP',
    ])
  })

  test('the head stays one row (E18): its name keeps the ellipsis and the chips their budget', () => {
    const { container } = render(<Entity form="token" entity={shield()} body={{}} />)
    const pill = container.querySelector('.su-entity-token__head > .su-entity-token__pill')
    expect(pill?.querySelector('.su-entity-token__notch > .su-entity-token__name')).not.toBeNull()
    expect(pill?.querySelector(':scope > .su-entity-token__chips')).not.toBeNull()
    expect(ruleOf('.su-entity-token__pill')).toContain('white-space: nowrap;')
    const name = ruleOf('.su-entity-token__name')
    expect(name).toContain('text-overflow: ellipsis;')
    expect(name).toContain('white-space: nowrap;')
    expect(ruleOf('.su-entity-token__chips')).toContain('max-width: clamp(50%, 100% - 9rem, 65%);')
  })

  test('an entity with no prose of its own reads its lead (an ability its description)', () => {
    const { container } = render(
      <Entity form="token" entity={get('abilities', 'Jury Rig')} body={{}} />
    )
    expect(container.querySelector('.su-entity-token__body')?.textContent).toBe(
      'Craft improvised equipment from everyday items.'
    )
  })

  test("the host's content follows the text; without the text it is the whole body", () => {
    const withText = render(
      <Entity form="token" entity={shield()} body={{ children: <p>Keepsake: a brass key</p> }} />
    ).container.querySelector('.su-entity-token__body')
    expect(withText?.lastElementChild?.textContent).toBe('Keepsake: a brass key')
    expect(withText?.textContent).toContain('electro-magnetic field')
    const alone = render(
      <Entity
        form="token"
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
