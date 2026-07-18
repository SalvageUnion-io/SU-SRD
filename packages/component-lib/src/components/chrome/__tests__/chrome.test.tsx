import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Field, Input } from '../Field'
import { Pill, Chip } from '../Pill'
import { Panel, Row, Empty } from '../Panel'
import { Slab } from '../Slab'
import { Conditions, ConditionChip } from '../Conditions'
import { Btn } from '../Btn'
import { StepBtn } from '../SmallButtons'
import { TreeSep } from '../TreeSep'
import { StatusBadge } from '../StatusBadge'
import { Badge } from '../Badge'
import { Glyph } from '../glyphs'

afterEach(cleanup)

describe('Field / Input', () => {
  test('renders label wired to the input, with a required asterisk inside the stamp', () => {
    render(
      <Field label="Name" required htmlFor="name">
        <Input id="name" placeholder="Mara Vex" />
      </Field>
    )
    expect(screen.getByLabelText(/Name/)).toBeTruthy()
    // The required mark rides inside the ink Stamp (white on ink), not a rust glyph.
    expect(screen.getByText('*').closest('.bg-ink')).not.toBeNull()
  })

  test('input carries the rust focus ring classes', () => {
    render(<Input aria-label="callsign" />)
    expect(screen.getByLabelText('callsign').className).toContain('focus:ring-')
  })
})

describe('Pill / Chip', () => {
  test('kind fills: crawler is white-on-pink, pilot is ink-on-orange', () => {
    render(<Pill tone="crawler">Crawler</Pill>)
    expect(screen.getByText('Crawler').className).toContain('text-paper')
    cleanup()
    render(<Pill tone="pilot">Pilot</Pill>)
    expect(screen.getByText('Pilot').className).toContain('bg-su-orange')
  })

  test('status fills match border to fill', () => {
    render(<Pill tone="warn">Damaged</Pill>)
    const pill = screen.getByText('Damaged')
    expect(pill.className).toContain('bg-status-warn')
    expect(pill.className).toContain('border-status-warn')
  })

  test('chip renders a quiet keyword chip', () => {
    render(<Chip>Uses</Chip>)
    expect(screen.getByText('Uses')).toBeTruthy()
  })
})

describe('Panel / Row / Empty', () => {
  test('panel defaults to ink border, soft swaps to faint', () => {
    const { container } = render(<Panel>content</Panel>)
    expect(container.firstElementChild?.className).toContain('border-ink')
    cleanup()
    const { container: soft } = render(<Panel soft>content</Panel>)
    expect(soft.firstElementChild?.className).toContain('border-wk-faint')
  })

  test('row renders name, meta and trailing actions', () => {
    render(
      <Row
        name="Mara Vex"
        meta='"Wrench" · Engineer'
        actions={<button type="button">Sheet</button>}
      />
    )
    expect(screen.getByText('Mara Vex')).toBeTruthy()
    expect(screen.getByText('"Wrench" · Engineer')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sheet' })).toBeTruthy()
  })

  test('empty renders a dashed frame with message and CTA', () => {
    const { container } = render(
      <Empty message="No pilots yet">
        <button type="button">Create</button>
      </Empty>
    )
    expect(container.firstElementChild?.className).toContain('border-dashed')
    expect(screen.getByText('No pilots yet')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Create' })).toBeTruthy()
  })
})

describe('Slab', () => {
  test('slab renders label, count and dashed leader', () => {
    render(<Slab label="Systems" count="2" />)
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })
})

describe('Conditions', () => {
  test('renders active chips with remove buttons and a + Add chip', () => {
    const onRemove = mock((c: string) => c)
    const onAdd = mock(() => {})
    render(<Conditions conditions={['Burning', 'Stunned']} onRemove={onRemove} onAdd={onAdd} />)
    expect(screen.getByText('Burning')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Remove Stunned'))
    expect(onRemove).toHaveBeenLastCalledWith('Stunned')
    fireEvent.click(screen.getByRole('button', { name: '+ Add' }))
    expect(onAdd).toHaveBeenCalled()
  })

  test('inactive condition chip is paper, active is warn', () => {
    const { container } = render(<ConditionChip label="Burning" active={false} />)
    expect(container.firstElementChild?.className).toContain('bg-paper')
    cleanup()
    const { container: active } = render(<ConditionChip label="Burning" />)
    expect(active.firstElementChild?.className).toContain('bg-status-warn')
  })
})

describe('StepBtn / Btn xs', () => {
  test('stepbtn is a 24px square button', () => {
    render(<StepBtn aria-label="Increase HP">+</StepBtn>)
    const btn = screen.getByLabelText('Increase HP')
    expect(btn.className).toContain('h-6')
    expect(btn.className).toContain('w-6')
  })

  test('Btn size="xs" renders the compact uppercase action (former MiniBtn)', () => {
    render(<Btn size="xs">⇄ Swap</Btn>)
    expect(screen.getByRole('button', { name: '⇄ Swap' }).className).toContain('uppercase')
  })
})

describe('TreeSep', () => {
  test('renders the tree-name tag and the ghost TREE tag between rules', () => {
    render(<TreeSep name="Engineering" />)
    expect(screen.getByText('Engineering')).toBeTruthy()
    expect(screen.getByText('Tree')).toBeTruthy()
    expect(screen.getByRole('separator')).toBeTruthy()
  })
})

describe('Stamp', () => {
  test('on-ink is the default surface; text is condensed uppercase', () => {
    render(<Badge shape="stamp">Mule</Badge>)
    const stamp = screen.getByText('Mule')
    expect(stamp.className).toContain('bg-ink')
    expect(stamp.className).toContain('text-paper')
    expect(stamp.className).toContain('uppercase')
    expect(stamp.className).toContain('tracking-caps-tight')
  })

  test('inverse surface flips to paper-on-ink; seam rides the border', () => {
    const { container } = render(
      <Badge shape="stamp" surface="inverse" seam>
        SP
      </Badge>
    )
    const stamp = container.firstElementChild as HTMLElement
    expect(stamp.className).toContain('bg-paper')
    expect(stamp.className).toContain('text-ink')
    // StampSeam: self-height-centred over the top border.
    expect(stamp.className).toContain('-translate-y-1/2')
  })
})

describe('Glyph', () => {
  test('is decorative (aria-hidden) with no title', () => {
    const { container } = render(<Glyph name="gear" />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('aria-hidden')).toBe('true')
    expect(svg?.querySelector('path')).toBeTruthy()
  })

  test('a title makes it an accessible image', () => {
    render(<Glyph name="pennant" title="1 AP" />)
    expect(screen.getByRole('img', { name: '1 AP' })).toBeTruthy()
  })
})

describe('StatusBadge', () => {
  test('renders the status label with the matching fill', () => {
    const { container } = render(<StatusBadge status="damaged" />)
    expect(screen.getByText('Damaged')).toBeTruthy()
    expect(container.firstElementChild?.className).toContain('bg-status-warn')
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
        name: 'Plasma Torch status: Intact — click to change',
      })
    ).toBeTruthy()
  })
})
