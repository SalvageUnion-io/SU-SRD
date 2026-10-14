import { describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { color } from '../../../design/tokens'
import { StatusBadge } from '../../compositions/StatusBadge'
import { EmptyState } from '../../containers/EmptyState'
import { Badge } from '../Badge'
import { Button } from '../Button'
import { ConditionChip, Conditions } from '../Conditions'
import { capsLabel } from '../capsLabel'
import { Field, Select } from '../Field'
import { Glyph } from '../glyphs'
import { Input, Textarea } from '../inputs'
import { INPUT_FOCUS } from '../interaction'
import { ModeDoor } from '../ModeDoor'
import { Panel } from '../Panel'
import { Slab } from '../Slab'
import { StepButton } from '../SmallButtons'

function rootEl(container: Element): HTMLElement {
  const el = container.firstElementChild
  if (!(el instanceof HTMLElement)) throw new Error('expected an HTMLElement root')
  return el
}

describe('Field / Input', () => {
  test('renders label wired to the input, with a required asterisk inside the stamp', () => {
    render(
      <Field label="Name" required htmlFor="name">
        <Input id="name" placeholder="Mara Vex" />
      </Field>
    )
    expect(screen.getByLabelText(/Name/)).toBeTruthy()
    // The required mark rides inside the ink Stamp (white on ink), not a rust glyph.
    expect(screen.getByText('*').closest('.su-badge--on-ink')).not.toBeNull()
  })

  test('input carries the focus ring classes', () => {
    render(<Input aria-label="callsign" />)
    expect(screen.getByLabelText('callsign').className).toContain(INPUT_FOCUS)
  })

  test('numeric opens the digit keypad', () => {
    render(<Input aria-label="qty" type="number" numeric />)
    const el = screen.getByLabelText('qty')
    expect(el.getAttribute('inputmode')).toBe('numeric')
    expect(el.getAttribute('pattern')).toBe('[0-9]*')
    expect(el.getAttribute('enterkeyhint')).toBe('done')
  })

  test('a plain Input sets no keypad hint', () => {
    render(<Input aria-label="plain" />)
    expect(screen.getByLabelText('plain').hasAttribute('inputmode')).toBe(false)
  })

  test('Textarea and Select share the Input skin (paper/ink border, focus ring)', () => {
    render(<Textarea aria-label="motto" />)
    render(<Select aria-label="class" />)
    for (const label of ['motto', 'class']) {
      const el = screen.getByLabelText(label)
      expect(el.className).toContain('su-text-input')
      expect(el.className).toContain(INPUT_FOCUS)
    }
  })

  test('the chevron rung draws a lucide chevron, hidden from assistive tech', () => {
    const { container } = render(<Select aria-label="tier" chevron />)
    const icon = container.querySelector('svg.lucide-chevron-down')
    expect(icon?.getAttribute('aria-hidden')).toBe('true')
    expect(container.textContent).not.toContain('▾')
  })
})

describe('Field — typeset read state', () => {
  test('prints the label over the value, and nothing for an empty one', () => {
    const { container } = render(<Field label="Chassis" value="Mule" />)
    expect(screen.getByText('Chassis')).toBeTruthy()
    expect(screen.getByText('Mule').tagName).toBe('P')
    cleanup()
    const empty = render(<Field label="Chassis" value="" />)
    expect(empty.container.firstChild).toBeNull()
    expect(container).toBeTruthy()
  })

  test('a read value that is a node (a Token) replaces the text; edit keeps the text', () => {
    render(<Field label="Chassis" value="Mule" readValue={<a href="/chassis/mule/">Mule</a>} />)
    expect(screen.getByRole('link', { name: 'Mule' })).toBeTruthy()
    expect(screen.queryByText('Mule', { selector: 'p' })).toBeNull()
    cleanup()
    render(
      <Field
        label="Chassis"
        value="Mule"
        readValue={<a href="/chassis/mule/">Mule</a>}
        onEditClick={() => undefined}
      />
    )
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('button', { name: 'Change chassis' }).textContent).toBe('Mule')
  })
})

describe('ModeDoor', () => {
  test('fires onSelect and renders the headline + body', () => {
    const onSelect = mock(() => {})
    render(
      <ModeDoor variant="guided" tab="▶" headline="Guided" onSelect={onSelect}>
        Step through the rules.
      </ModeDoor>
    )
    expect(screen.getByText('Guided')).toBeTruthy()
    fireEvent.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalled()
  })

  test('joins its variant class and a caller class with cn (no stray space)', () => {
    const { rerender } = render(
      <ModeDoor variant="guided" tab="▶" headline="Guided">
        Body
      </ModeDoor>
    )
    expect(screen.getByRole('button').className).toBe('su-mode-door su-mode-door--guided')
    rerender(
      <ModeDoor variant="guided" tab="▶" headline="Guided" className="extra">
        Body
      </ModeDoor>
    )
    expect(screen.getByRole('button').className).toBe('su-mode-door su-mode-door--guided extra')
  })

  test('guided prints the sheet’s onTone pair, not paper on the bare tone', () => {
    // Paper on `--tone` measured 2.4:1 on pilot; theme.css sets the pair per
    // sheet and contrast.test.ts holds it to onTone.
    render(
      <ModeDoor variant="guided" tab="▶" headline="Guided">
        Step through the rules.
      </ModeDoor>
    )
    const door = screen.getByRole('button')
    expect(door.style.background).toBe('var(--tone-band)')
    expect(door.style.color).toBe('var(--on-tone-band)')
    expect(screen.getByText('Guided').style.color).toBe('')
  })

  test('blank variant is the dashed paper escape hatch', () => {
    render(
      <ModeDoor variant="blank" tab="✎" headline="Blank">
        Empty sheet.
      </ModeDoor>
    )
    expect(screen.getByRole('button').style.borderStyle).toBe('dashed')
  })
})

describe('Badge tone / quiet preset', () => {
  test('kind fills: crawler is white-on-pink, pilot is ink-on-orange', () => {
    render(
      <Badge surface="tone" tone="crawler">
        Crawler
      </Badge>
    )
    expect(screen.getByText('Crawler').className).toContain('su-badge--tone-crawler')
    cleanup()
    render(
      <Badge surface="tone" tone="pilot">
        Pilot
      </Badge>
    )
    expect(screen.getByText('Pilot').className).toContain('su-badge--tone-pilot')
  })

  test('status fills match border to fill', () => {
    render(
      <Badge surface="tone" tone="warn">
        Damaged
      </Badge>
    )
    const pill = screen.getByText('Damaged')
    expect(pill.className).toContain('su-badge--tone')
    expect(pill.className).toContain('su-badge--tone-warn')
  })

  test('the quiet preset renders a borderless keyword chip', () => {
    render(<Badge surface="quiet">Uses</Badge>)
    expect(screen.getByText('Uses')).toBeTruthy()
  })
})

describe('Panel', () => {
  test('panel defaults to ink border, soft swaps to faint', () => {
    const { container } = render(<Panel>content</Panel>)
    expect(rootEl(container).style.borderColor).toBe(color.ink)
    cleanup()
    const { container: soft } = render(<Panel soft>content</Panel>)
    expect(rootEl(soft).style.borderColor).toBe(color.wkFaint)
  })
})

describe('EmptyState', () => {
  test('stamp default renders the dashed frame with a stamp headline', () => {
    const { container } = render(<EmptyState headline="No pilots yet" />)
    expect((container.firstElementChild as HTMLElement | null)?.style.borderStyle).toBe('dashed')
    const stamp = screen.getByText('No pilots yet')
    expect(stamp.className).toContain('su-badge--on-ink')
  })

  test('quiet variant renders the centered faint dashed placeholder with message and CTA', () => {
    const { container } = render(
      <EmptyState
        variant="quiet"
        body="No pilots yet"
        action={<button type="button">Create</button>}
      />
    )
    const root = rootEl(container)
    expect(root.style.borderStyle).toBe('dashed')
    expect(root.style.borderColor).toBe('rgb(167, 180, 189)')
    expect(root.style.textAlign).toBe('center')
    expect(screen.getByText('No pilots yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
  })

  test('the quiet message is muted, or takes the ground ink with bodyInk="inherit"', () => {
    render(<EmptyState variant="quiet" body="Muted" />)
    expect(screen.getByText('Muted').style.color).toBe(color.wkMuted)
    render(<EmptyState variant="quiet" body="On the card" bodyInk="inherit" />)
    expect(screen.getByText('On the card').style.color).toBe('currentcolor')
  })
})

describe('Slab', () => {
  test('slab renders label, count and dashed leader', () => {
    render(<Slab label="Systems" count="2" />)
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  test('the count is muted, or takes the ground ink with countInk="inherit"', () => {
    render(<Slab variant="solid" label="Classes" count="Choose 1" />)
    expect(screen.getByText('Choose 1').style.color).toBe(color.wkMuted)
    render(<Slab variant="solid" label="Types" count="Pick one" countInk="inherit" />)
    expect(screen.getByText('Pick one').style.color).toBe('currentcolor')
  })

  test('a value count is a label-first Stat chip, not trailing text', () => {
    const { container } = render(
      <Slab variant="solid" label="Systems" count={{ label: 'Slots', value: 3, max: 6 }} />
    )
    const chip = container.querySelector('.su-stat-cell')
    expect(chip).not.toBeNull()
    expect(chip?.querySelector('.su-stat-plate--label')?.textContent).toBe('Slots')
    expect(chip?.querySelector('.su-stat-plate--value')?.textContent).toBe('3/6')
    expect(screen.queryByText(/slots$/)).toBeNull()
  })

  test('an over-cap value count rides the critical border, its note after the chip', () => {
    const { container } = render(
      <Slab
        label="Systems"
        count={{ label: 'Slots', value: 7, max: 6, state: 'critical', note: 'as printed' }}
      />
    )
    expect(container.querySelector('.su-stat-cell--critical')).not.toBeNull()
    expect(screen.getByText('as printed').style.color).toBe(color.wkMuted)
  })
})

describe('Conditions', () => {
  test('renders active chips with remove buttons and a + Add chip', () => {
    const onRemove = mock((c: string) => c)
    const onAdd = mock(() => {})
    render(<Conditions conditions={['Burning', 'Stunned']} onRemove={onRemove} onAdd={onAdd} />)
    expect(screen.getByText('Burning')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Remove condition Stunned'))
    // The index rides along with the value so a row of repeatable strings
    // (NPC facts) can remove by position.
    expect(onRemove).toHaveBeenLastCalledWith('Stunned', 1)
    // The remove mark is lucide's X, not a typed character.
    expect(
      screen.getByLabelText('Remove condition Burning').querySelector('svg.lucide-x')
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }))
    expect(onAdd).toHaveBeenCalled()
  })

  test('addLabel renames the + Add chip for a non-condition row', () => {
    render(<Conditions conditions={[]} onAdd={() => {}} addLabel="Add Command Bay crew fact" />)
    expect(screen.getByRole('button', { name: 'Add Command Bay crew fact' })).toBeTruthy()
  })

  test('quiet tone is the neutral, prose-cased chip (no warn fill)', () => {
    const { container } = render(<ConditionChip label="Owes a debt" tone="quiet" />)
    expect(rootEl(container).style.textTransform).toBe('none')
    const className = container.firstElementChild?.className ?? ''
    expect(className).not.toContain('su-badge--tone-warn')
  })

  test('a condition chip is the warn fill', () => {
    const { container } = render(<ConditionChip label="Burning" />)
    expect(container.firstElementChild?.className).toContain('su-badge--tone-warn')
  })
})

describe('StepButton / Button xs', () => {
  test('stepbtn is a 24px square button', () => {
    render(<StepButton aria-label="Increase HP">+</StepButton>)
    const btn = screen.getByLabelText('Increase HP')
    expect(btn.style.height).toBe('24px')
    expect(btn.style.width).toBe('24px')
  })

  test('Button size="mini" renders the compact uppercase action (former MiniBtn)', () => {
    render(<Button size="mini">⇄ Swap</Button>)
    // The condensed-caps treatment is the `capsLabel` recipe, which emits
    // `.su-*` names. Asked of the recipe rather than spelled, so a
    // rename moves this for free.
    expect(screen.getByRole('button', { name: '⇄ Swap' }).className).toContain(
      capsLabel({ weight: 'inherit', tracking: 'inherit' })
    )
  })
})

describe('Stamp', () => {
  test('on-ink is the default surface; text is condensed uppercase', () => {
    render(<Badge shape="stamp">Mule</Badge>)
    const stamp = screen.getByText('Mule')
    expect(stamp.className).toContain('su-badge--on-ink')
    // One assertion, on the recipe's own output for the rungs a stamp uses,
    // where there were two on utility spellings (`uppercase`, then
    // `tracking-caps-tight`). Both were describing the same fact — that a stamp
    // is the condensed-caps label at its default tracking — and the recipe is
    // the thing that decides it, so asking the recipe is both shorter and
    // rename-proof.
    expect(stamp.className).toContain(capsLabel({ size: undefined }))
  })

  test('inverse surface flips to paper-on-ink; seam rides the border', () => {
    const { container } = render(
      <Badge shape="stamp" surface="inverse" seam>
        SP
      </Badge>
    )
    const stamp = rootEl(container)
    expect(stamp.className).toContain('su-badge--inverse')
    // StampSeam: self-height-centred over the top border.
    expect(stamp.className).toContain('su-stamp-seam')
  })
})

describe('Glyph', () => {
  test('is a decorative (aria-hidden) currentColor stroke', () => {
    const { container } = render(<Glyph name="plus" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.getAttribute('stroke')).toBe('currentColor')
    expect(svg?.querySelector('path')).toBeTruthy()
  })
})

describe('StatusBadge', () => {
  test('renders the status label with the matching fill', () => {
    const { container } = render(<StatusBadge status="damaged" />)
    expect(screen.getByText('Damaged')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('su-badge--tone-warn')
  })

  test('becomes a button when a cycle handler is provided', () => {
    const onClick = mock(() => {})
    render(<StatusBadge status="intact" onClick={onClick} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalled()
  })

  test('subject disambiguates the accessible name', () => {
    render(<StatusBadge status="intact" onClick={() => {}} subject="Plasma Torch" />)
    expect(
      screen.getByRole('button', {
        name: 'Plasma Torch status: Intact. Activate to mark Damaged',
      })
    ).toBeTruthy()
  })

  test('the label names the state activation leads to, around the cycle', () => {
    const { rerender } = render(<StatusBadge status="damaged" onClick={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Status: Damaged. Activate to mark Destroyed' })
    ).toBeTruthy()
    rerender(<StatusBadge status="destroyed" onClick={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'Status: Destroyed. Activate to mark Intact' })
    ).toBeTruthy()
  })

  test('announces the new state politely once the write lands, not before', () => {
    const { rerender } = render(
      <StatusBadge status="damaged" onClick={() => {}} subject="Plasma Torch" />
    )
    const region = screen.getByRole('status')
    expect(region.getAttribute('aria-live')).toBe('polite')
    expect(region.textContent).toBe('')
    fireEvent.click(screen.getByRole('button'))
    // The handler may be async: nothing is announced until the status changes.
    expect(region.textContent).toBe('')
    rerender(<StatusBadge status="destroyed" onClick={() => {}} subject="Plasma Torch" />)
    expect(screen.getByRole('status').textContent).toBe('Plasma Torch status: Destroyed')
  })

  test('a status change this control did not make is not announced', () => {
    const { rerender } = render(<StatusBadge status="intact" onClick={() => {}} />)
    rerender(<StatusBadge status="damaged" onClick={() => {}} />)
    expect(screen.getByRole('status').textContent).toBe('')
  })
})
