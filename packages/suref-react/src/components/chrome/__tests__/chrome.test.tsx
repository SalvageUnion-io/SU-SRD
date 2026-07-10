import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Field, Input } from '../Field'
import { Pill, Chip } from '../Pill'
import { Panel, Row, Empty } from '../Panel'
import { Slab } from '../Slab'
import { MChip, Spec } from '../MChip'
import { Conditions, ConditionChip } from '../Conditions'
import { StepBtn, MiniBtn } from '../SmallButtons'
import { TreeSep } from '../TreeSep'
import { StatusBadge } from '../StatusBadge'

afterEach(cleanup)

describe('Field / Input', () => {
  test('renders label wired to the input, with rust required asterisk', () => {
    render(
      <Field label="Name" required htmlFor="name">
        <Input id="name" placeholder="Mara Vex" />
      </Field>
    )
    expect(screen.getByLabelText(/Name/)).toBeTruthy()
    expect(screen.getByText('*').className).toContain('text-rust')
  })

  test('input carries the rust focus ring classes', () => {
    render(<Input aria-label="callsign" />)
    expect(screen.getByLabelText('callsign').className).toContain('focus:ring-')
  })
})

describe('Pill / Chip', () => {
  test('kind fills: crawler is white-on-pink, pilot is ink-on-orange', () => {
    render(<Pill tone="crawler">Crawler</Pill>)
    expect(screen.getByText('Crawler').className).toContain('text-su-white')
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

  test('chip renders quiet label + bold value', () => {
    const { container } = render(<Chip value={3}>Uses</Chip>)
    expect(screen.getByText('Uses')).toBeTruthy()
    expect(container.querySelector('b')?.textContent).toBe('3')
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

describe('Slab / MChip / Spec', () => {
  test('slab renders label, count and dashed leader', () => {
    render(<Slab label="Systems" count="2" />)
    expect(screen.getByText('Systems')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  test('mchip renders label tab + value', () => {
    render(<MChip label="Callsign" value='"Wrench"' variant="call" />)
    expect(screen.getByText('Callsign')).toBeTruthy()
    expect(screen.getByText('"Wrench"')).toBeTruthy()
  })

  test('spec renders value with /max; cargo recolors', () => {
    render(<Spec label="SYS" value={5} max={20} />)
    expect(screen.getByText('/20')).toBeTruthy()
    cleanup()
    const { container } = render(<Spec label="CARGO" value={4} cargo />)
    expect(container.firstElementChild?.className).toContain('border-cargo-deep')
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

describe('StepBtn / MiniBtn', () => {
  test('stepbtn is a 24px square button', () => {
    render(<StepBtn aria-label="Increase HP">+</StepBtn>)
    const btn = screen.getByLabelText('Increase HP')
    expect(btn.className).toContain('h-6')
    expect(btn.className).toContain('w-6')
  })

  test('minibtn renders uppercase mini action', () => {
    render(<MiniBtn>⇄ Swap</MiniBtn>)
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
