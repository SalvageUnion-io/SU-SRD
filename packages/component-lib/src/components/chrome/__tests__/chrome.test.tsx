import { describe, test, expect, afterEach, mock } from 'bun:test'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { Field, Input, Textarea, Select } from '../Field'
import { KvRow } from '../KvRow'
import { ModeDoor } from '../ModeDoor'
import { Panel, Row } from '../Panel'
import { EmptyState } from '../EmptyState'
import { Slab } from '../Slab'
import { Conditions, ConditionChip } from '../Conditions'
import { Button } from '../Button'
import { StepButton } from '../SmallButtons'
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

  test('Textarea and Select share the Input skin (paper/ink border, rust ring)', () => {
    render(<Textarea aria-label="motto" />)
    render(<Select aria-label="class" />)
    for (const label of ['motto', 'class']) {
      const el = screen.getByLabelText(label)
      expect(el.className).toContain('border-ink')
      expect(el.className).toContain('focus:ring-')
    }
  })
})

describe('KvRow', () => {
  test('renders the label rail and value', () => {
    render(<KvRow label="Callsign" value="Ace" />)
    expect(screen.getByText('Callsign')).toBeTruthy()
    expect(screen.getByText('Ace')).toBeTruthy()
  })

  test('an empty value renders the muted "required" placeholder — never rust (§3.1)', () => {
    render(<KvRow label="Motto" value={null} />)
    const placeholder = screen.getByText('required')
    expect(placeholder.className).toContain('text-ink-50')
    expect(placeholder.className).not.toContain('text-rust')
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

  test('blank variant is the dashed paper escape hatch', () => {
    render(
      <ModeDoor variant="blank" tab="✎" headline="Blank">
        Empty sheet.
      </ModeDoor>
    )
    expect(screen.getByRole('button').className).toContain('border-dashed')
  })
})

describe('Badge tone / quiet preset', () => {
  test('kind fills: crawler is white-on-pink, pilot is ink-on-orange', () => {
    render(
      <Badge surface="tone" tone="crawler">
        Crawler
      </Badge>
    )
    expect(screen.getByText('Crawler').className).toContain('text-paper')
    cleanup()
    render(
      <Badge surface="tone" tone="pilot">
        Pilot
      </Badge>
    )
    expect(screen.getByText('Pilot').className).toContain('bg-pilot')
  })

  test('status fills match border to fill', () => {
    render(
      <Badge surface="tone" tone="warn">
        Damaged
      </Badge>
    )
    const pill = screen.getByText('Damaged')
    expect(pill.className).toContain('bg-status-warn')
    expect(pill.className).toContain('border-status-warn')
  })

  test('the quiet preset renders a borderless keyword chip', () => {
    render(<Badge surface="quiet">Uses</Badge>)
    expect(screen.getByText('Uses')).toBeTruthy()
  })
})

describe('Panel / Row', () => {
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
})

describe('EmptyState', () => {
  test('stamp default renders the dashed frame with a stamp headline', () => {
    const { container } = render(<EmptyState headline="No pilots yet" />)
    expect(container.firstElementChild?.className).toContain('border-dashed')
    const stamp = screen.getByText('No pilots yet')
    expect(stamp.className).toContain('bg-ink')
  })

  test('quiet variant renders the centered faint dashed placeholder with message and CTA', () => {
    const { container } = render(
      <EmptyState
        variant="quiet"
        body="No pilots yet"
        action={<button type="button">Create</button>}
      />
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain('border-dashed')
    expect(root.className).toContain('border-wk-faint')
    expect(root.className).toContain('text-center')
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
    fireEvent.click(screen.getByLabelText('Remove condition Stunned'))
    expect(onRemove).toHaveBeenLastCalledWith('Stunned')
    fireEvent.click(screen.getByRole('button', { name: 'Add condition' }))
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

describe('StepButton / Button xs', () => {
  test('stepbtn is a 24px square button', () => {
    render(<StepButton aria-label="Increase HP">+</StepButton>)
    const btn = screen.getByLabelText('Increase HP')
    expect(btn.className).toContain('h-6')
    expect(btn.className).toContain('w-6')
  })

  test('Button size="mini" renders the compact uppercase action (former MiniBtn)', () => {
    render(<Button size="mini">⇄ Swap</Button>)
    expect(screen.getByRole('button', { name: '⇄ Swap' }).className).toContain('uppercase')
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
